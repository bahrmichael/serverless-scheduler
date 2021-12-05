import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {Message, MessageStatus, TargetType} from "../../types";
import {SQSEvent} from "aws-lambda";
import axios from 'axios';
import {metricScope} from "aws-embedded-metrics";
import axiosRetry from 'axios-retry';

const ddb = new DynamoDB.DocumentClient();
const https = axios.create({
  timeout: 2_000,
});

axiosRetry(https, { retries: 2 });

const {MESSAGES_TABLE} = process.env;

export const main = metricScope(metrics => async (event: SQSEvent) => {
  const {Records: records} = event;
  if (records.length > 1) {
    throw Error('Batch size must be 1. Was ' + records.length);
  }

  const message: Message = JSON.parse(records[0].body) as Message;

  console.log('Releasing message', message);

  const released = new Date();
  const releaseDelay = released.getTime() - new Date(message.sendAt).getTime();
  metrics.setNamespace("DEV/ServerlessScheduler/ReleaseMessage");
  metrics.setProperty("Owner", message.owner);
  metrics.setProperty("MessageId", message.id);
  metrics.putMetric("Messages", 1, "Count");

  try {
    if (message.targetType === TargetType.HTTPS) {
      const headers: any = {};
      if (message.httpAuthorization) {
        headers.Authorization = message.httpAuthorization;
      }
      // todo: error handling, retries
      // example: don't return a status code from the contracts appraisal
      await https.post(message.targetUrl, message.payload, {headers});
    } else {
      console.error('Unhandled targetType', message);
      throw Error('Unhandled targetType.');
    }
    metrics.putMetric("Released", 1, "Count");
    metrics.setProperty("TargetType", message.targetType);

    console.log('Message released', message);

    await ddb.update({
      TableName: MESSAGES_TABLE,
      Key: {
        owner: message.owner,
        id: message.id,
      },
      UpdateExpression: 'set #status = :s, releasedAt = :r, timeToLive = :t',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':s': MessageStatus.SENT,
        ':r': released.toISOString(),
        // Let DynamoDB clean up events ASAP
        ':t': Math.floor(new Date().getTime() / 1_000),
      }
    }).promise();

    // We have to make this call at the end, because we don't want to delay the release.
    // Furthermore we prefer an accurate status over metrics.
    // By doing this in the successful path, we also only emit DelayAfterError once per message.
    // Message that get stuck in the DLQ won't produce this metrics.
    const m: Message = (await ddb.get({
      TableName: MESSAGES_TABLE,
      Key: {
        owner: message.owner,
        id: message.id,
      },
    }).promise()).Item as Message;
    if (!m) {
      console.log('Message has been removed. Skipping further action.', {owner: message.owner, id: message.id});
    } else if (m?.errorCount) {
      metrics.putMetric("DelayAfterError", releaseDelay, "Milliseconds");
    } else {
      metrics.putMetric("Delay", releaseDelay, "Milliseconds");
    }
  } catch (e) {
    metrics.putMetric("Failed", 1, "Count");

    if (e?.response) {
      console.warn(e.response);
    } else {
      console.warn(e);
    }

    const m: Message = (await ddb.get({
      TableName: MESSAGES_TABLE,
      Key: {
        owner: message.owner,
        id: message.id,
      },
    }).promise()).Item as Message;

    if (!m) {
      console.log('Message has been removed. Skipping further action.', {owner: message.owner, id: message.id});
    } else if (!m.errorCount || m.errorCount <= 3) {
      await ddb.update({
        TableName: MESSAGES_TABLE,
        Key: {
          owner: message.owner,
          id: message.id,
        },
        UpdateExpression: 'set errorCount = if_not_exists(errorCount, :c1) + :c2',
        ExpressionAttributeValues: {
          ':c1': 1,
          ':c2': 1,
        }
      }).promise();

      throw e;
    } else {
      m.errorCount += 1;
      m.gsi1pk = `${m.owner}#${MessageStatus.FAILED}`;
      m.gsi1sk = m.id;

      await ddb.put({
        TableName: MESSAGES_TABLE,
        Item: m,
      }).promise();
    }
  }
});


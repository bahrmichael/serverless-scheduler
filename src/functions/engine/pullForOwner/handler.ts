import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as SQS from 'aws-sdk/clients/sqs';
import {Message, MessageStatus, Owner} from "../../types";
import {calculateDelay} from "../../util";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();
const sqs = new SQS();

const {MESSAGES_TABLE, QUEUE_URL} = process.env;

export const main = metricScope(metrics => async (owner: Owner) => {
  console.log('Pulling messages', {owner: owner.owner});
  const in5Minutes = new Date();
  in5Minutes.setSeconds(0, 0);
  in5Minutes.setMinutes(in5Minutes.getMinutes() + 5);

  // todo: is there a poison pill scenario, where one bad message or bug will block future messages from being loaded?
  // yeah, if a message does not transition away from READY
  const messages: Message[] = (await ddb.query({
    TableName: MESSAGES_TABLE,
    /*
    We use a sparse index to only query for READY items. The sparse index gets populated when a message is inserted
    into the table, and the attribute is removed in this function after sending the message.
     */
    IndexName: 'ownerStatusIndex',
    KeyConditionExpression: 'gsi1pk = :pk and gsi1sk < :sk',
    ExpressionAttributeValues: {
      ':pk': `${owner.owner}#${MessageStatus.READY}`,
      // ULIDs are 26 characters. Append 0s to the date to start with the first key from the time range.
      ':sk': `${in5Minutes.toISOString()}#00000000000000000000000000`,
    },
    // do not use projection attributes, because we put the whole message into the queue already
  }).promise()).Items as Message[];

  console.log('Retrieved messages', {owner: owner.owner, count: messages.length});

  metrics.setNamespace("DEV/ServerlessScheduler/PullForOwner");
  metrics.putMetric("Messages", messages.length, "Count");
  metrics.setProperty("Owner", owner.owner);

  if (owner.httpAuthorization) {
    messages
        .filter((m) => m.targetType === 'HTTPS')
        .forEach((m) => m.httpAuthorization = owner.httpAuthorization);
  }

  const promises: Promise<void>[] = [];
  for (const message of messages) {
    // todo: chunk into 10 message chunks
    promises.push(processMessage([message]));
  }
  console.log('Awaiting requests', {owner: owner.owner, count: promises.length});
  await Promise.all(promises);

  /*
  Partitioning idea: When this function runs more than x seconds, add a new partition to the owner.
  This should then even out load on future messages.
   */
});

async function processMessage(messages: Message[]): Promise<void> {
  const entries: {Id: string, MessageBody: string, DelaySeconds: number}[] = messages.map((m) => {
    console.log('Mapping message', m.id);
    return {
      Id: m.id.split("#")[1],
      MessageBody: JSON.stringify(m),
      DelaySeconds: calculateDelay(m.sendAt),
    }
  });
  await sqs.sendMessageBatch({
    QueueUrl: QUEUE_URL,
    Entries: entries,
  }).promise();

  for (const message of messages) {
    await ddb.update({
      TableName: MESSAGES_TABLE,
      Key: {
        owner: message.owner,
        id: message.id,
      },
      UpdateExpression: 'set #status = :s remove gsi1pk, gsi1sk',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':s': MessageStatus.QUEUED,
      }
    }).promise();
  }
}

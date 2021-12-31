import 'source-map-support/register';
import {metricScope} from "aws-embedded-metrics";
import {CloudWatchLogsEvent, CloudWatchLogsLogEvent} from "aws-lambda";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
const ddb = new DynamoDB.DocumentClient();
const {METERING_TABLE} = process.env;

export const main = metricScope(_metrics => async (event: CloudWatchLogsEvent) => {
  const payload = Buffer.from(event.awslogs.data, 'base64');
  const day = new Date().toISOString().split('T')[0];
  const logEvents: CloudWatchLogsLogEvent[] = JSON.parse(payload.toString());
  const records: Map<string, number> = new Map<string, number>();

  for (const {message} of logEvents) {
    console.log({message, t: typeof message});
    const log = JSON.parse(message);
    console.log({log});

    const {Owner: owner, App: app} = log;
    console.log({owner, app, day});

    const id = `${owner}#${app}#${day}`;
    if (records.has(id)) {
      records.set(id, records.get(id) + 1);
    } else {
      records.set(id, 1);
    }
  }

  console.log({records});

  for (const [id, count] of records) {
    const idSplit = id.split('#');
    const owner = idSplit[0];
    const app = idSplit[1];
    const day = idSplit[2];

    await ddb.update({
      TableName: METERING_TABLE,
      Key: {
        owner,
        sk: `${app}#${day}`,
      },
      UpdateExpression: 'set ingestionCount = if_not_exists(ingestionCount, :c1) + :c2',
      ExpressionAttributeValues: {
        ':c1': 1,
        ':c2': count,
      }
    }).promise();
  }
});



import 'source-map-support/register';
import {metricScope} from "aws-embedded-metrics";
import {CloudWatchLogsEvent} from "aws-lambda";

// import * as DynamoDB from 'aws-sdk/clients/dynamodb';
// const ddb = new DynamoDB.DocumentClient();
// const {METERING_TABLE} = process.env;

export const main = metricScope(_metrics => async (event: CloudWatchLogsEvent) => {
  const text = event.awslogs.data;
  console.log({text});
  const data = JSON.parse(text);
  console.log({data});
});



import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as Lambda from 'aws-sdk/clients/lambda';
import {Owner} from "../../types";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();
const lambda = new Lambda();

const {OWNERS_TABLE, PULL_FUNCTION_ARN} = process.env;

export const main = metricScope(metrics => async () => {
  const owners = await getOwners();
  metrics.setNamespace("DEV/ServerlessScheduler/SchedulePull");
  metrics.putMetric("Owners", owners.length, "Count");
  await Promise.all(owners.map(processOwner));
});

async function processOwner(owner: Owner): Promise<void> {
  console.log('Triggering invocation', owner);
  await lambda.invoke({
    FunctionName: PULL_FUNCTION_ARN,
    InvocationType: "Event",
    Payload: JSON.stringify(owner),
  }).promise();
}

async function getOwners(): Promise<Owner[]> {
  return (await ddb.scan({
    TableName: OWNERS_TABLE,
  }).promise()).Items as Owner[];
}

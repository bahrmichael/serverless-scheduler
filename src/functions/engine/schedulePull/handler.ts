import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as Lambda from 'aws-sdk/clients/lambda';
import {App} from "../../types";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();
const lambda = new Lambda();

const {OWNERS_TABLE, PULL_FUNCTION_ARN} = process.env;

export const main = metricScope(metrics => async () => {
  const apps: App[] = await getApps();
  metrics.setNamespace("DEV/ServerlessScheduler/SchedulePull");
  metrics.putMetric("Apps", apps.length, "Count");
  await Promise.all(apps.map(processOwner));
});

async function processOwner(app: App): Promise<void> {
  console.log('Triggering invocation', app);
  await lambda.invoke({
    FunctionName: PULL_FUNCTION_ARN,
    InvocationType: "Event",
    Payload: JSON.stringify(app),
  }).promise();
}

async function getApps(): Promise<App[]> {
  return (await ddb.scan({
    TableName: OWNERS_TABLE,
    FilterExpression: 'begins_with(sk, :s)',
    ExpressionAttributeValues: {
      ':s': 'app#',
    }
  }).promise()).Items as App[];
}

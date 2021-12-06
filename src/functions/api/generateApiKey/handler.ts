import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';

const ddb = new DynamoDB.DocumentClient();

const {OWNERS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const owner = event.requestContext?.authorizer?.claims['cognito:username'];
    const {appId} = JSON.parse(event.body);

    const newApiKey = uuid();

    await ddb.update({
        TableName: OWNERS_TABLE,
        Key: {
            owner: owner,
            sk: `app#${appId}`,
        },
        UpdateExpression: 'set apiKey = :a',
        ExpressionAttributeValues: {
            ':a': newApiKey,
        }
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/GenerateApiKey");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    return {
        statusCode: 200,
        body: {newApiKey, appId},
    }
});
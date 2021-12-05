import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';

const ddb = new DynamoDB.DocumentClient();

const {OWNERS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {
    console.log({requestContext: event.requestContext});

    const owner = event.headers['x-sub'];

    const newApiKey = uuid();

    await ddb.update({
        TableName: OWNERS_TABLE,
        Key: {
            owner: owner,
            sk: 'config',
        },
        UpdateExpression: 'set apiKey = :a',
        ExpressionAttributeValues: {
            ':a': newApiKey,
        }
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/GenerateApiKey");
    metrics.setProperty("Owner", owner);

    return {
        statusCode: 200,
        body: {newApiKey},
    }
});
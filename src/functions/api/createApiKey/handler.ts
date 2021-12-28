import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';

const ddb = new DynamoDB.DocumentClient();

const {APPLICATIONS_TABLE, API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const owner = event.headers.owner;
    const {appId} = event.pathParameters;

    const app = (await ddb.get({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`,
        }
    }).promise()).Item;
    if (!app) {
        return {
            statusCode: 403,
            body: 'app_not_found',
        };
    }

    const apiKey = uuid();

    await ddb.put({
        TableName: API_KEY_TABLE,
        Item: {
            appId,
            apiKey,
            created: new Date().toISOString(),
        }
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/GenerateApiKey");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    return {
        statusCode: 200,
        body: {apiKey},
    }
});
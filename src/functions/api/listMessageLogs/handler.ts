import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {App, MessageLog} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {MESSAGE_LOGS_TABLE, APPLICATIONS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId, messageId} = pathParameters;

    const app: App = (await ddb.get({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`,
        }
    }).promise()).Item as App;
    if (!app) {
        console.log('app_not_found', owner, appId);
        return {
            statusCode: 403,
            body: 'app_not_found',
        };
    }

    const logs: MessageLog[] = (await ddb.query({
        TableName: MESSAGE_LOGS_TABLE,
        KeyConditionExpression: 'messageId = :m',
        FilterExpression: 'owner = :o and appId = :a',
        ExpressionAttributeValues: {
            ':m': messageId,
            ':o': owner,
            ':a': appId,
        },
    }).promise()).Items as MessageLog[] ?? [];

    metrics.setNamespace("DEV/ServerlessScheduler/ListMessageLogs");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("AppId", appId);
    metrics.setProperty("MessageId", messageId);
    metrics.putMetric("LogCount", logs.length);

    return {
        statusCode: 200,
        body: JSON.stringify(logs),
    }
});
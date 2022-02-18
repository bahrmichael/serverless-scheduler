import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {MessageLog} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {MESSAGE_LOGS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner, appId} = requestContext.authorizer;
    const {messageId} = pathParameters;

    const logs: MessageLog[] = (await ddb.query({
        TableName: MESSAGE_LOGS_TABLE,
        KeyConditionExpression: 'messageId = :m',
        FilterExpression: '#owner = :o and appId = :a',
        ExpressionAttributeNames: {
            '#owner': 'owner',
        },
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
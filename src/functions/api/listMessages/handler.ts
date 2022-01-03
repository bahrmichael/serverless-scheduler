import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {Message} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {MESSAGES_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, queryStringParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId} = pathParameters;

    let ExclusiveStartKey = undefined;
    if (queryStringParameters?.startFrom) {
        ExclusiveStartKey = {
            appId,
            messageId: queryStringParameters.startFrom,
        }
    }

    const messages: Message[] = (await ddb.query({
        TableName: MESSAGES_TABLE,
        KeyConditionExpression: 'appId = :a',
        FilterExpression: '#owner = :o',
        ExpressionAttributeNames: {
            '#owner': 'owner',
        },
        ExpressionAttributeValues: {
            ':a': appId,
            ':o': owner,
        },
        ScanIndexForward: false,
        ExclusiveStartKey,
    }).promise()).Items as Message[] ?? [];

    const mappedMessages = messages.map(({messageId, sendAt, status}) => {
        return {
            appId,
            messageId,
            sendAt,
            status,
        };
    });

    metrics.setNamespace("DEV/ServerlessScheduler/ListMessages");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("AppId", appId);
    metrics.putMetric("MessagesCount", mappedMessages.length);

    return {
        statusCode: 200,
        body: JSON.stringify(mappedMessages),
    }
});
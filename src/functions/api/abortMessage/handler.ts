import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {MessageLog, MessageStatus} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {MESSAGES_TABLE, MESSAGE_LOGS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId, messageId} = pathParameters;

    await ddb.update({
        TableName: MESSAGES_TABLE,
        Key: {
            appId,
            messageId,
        },
        UpdateExpression: 'set #status = :s',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#owner': 'owner',
        },
        ExpressionAttributeValues: {
            ':s': MessageStatus.ABORTED,
            ':o': owner,
        },
        ConditionExpression: '#owner = :o'
    }).promise();
    await writeMessageLog({
        owner,
        appId,
        messageId,
        timestamp: new Date().toISOString(),
        data: {status: 200, data: 'Message aborted.'},
    });

    metrics.setNamespace("DEV/ServerlessScheduler/AbortMessage");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("AppId", appId);

    return {
        statusCode: 200,
        body: '',
    }
});

async function writeMessageLog(messageLog: MessageLog): Promise<void> {
    await ddb.put({
        TableName: MESSAGE_LOGS_TABLE,
        Item: messageLog,
    }).promise();
}
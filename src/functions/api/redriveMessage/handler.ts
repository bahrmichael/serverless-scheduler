import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {Message, MessageLog, MessageLogVersion, MessageStatus} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {MESSAGES_TABLE, MESSAGE_LOGS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId, messageId} = pathParameters;

    const message: Message = (await ddb.get({
        TableName: MESSAGES_TABLE,
        Key: {appId, messageId}
    }).promise()).Item as Message;
    if (!message) {
        return {
            statusCode: 404,
            body: 'message_not_found',
        }
    }

    await ddb.update({
        TableName: MESSAGES_TABLE,
        Key: {
            appId,
            messageId,
        },
        UpdateExpression: 'set #status = :s, gsi1pk = :pk, gsi1sk = :sk',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#owner': 'owner',
        },
        ExpressionAttributeValues: {
            ':s': MessageStatus.READY,
            ':o': owner,
            ':pk': `${appId}#${MessageStatus.READY}`,
            ':sk': `${message.sendAt}#${message.messageId}`
        },
        ConditionExpression: '#owner = :o'
    }).promise();
    await writeMessageLog({
        owner,
        appId,
        messageId,
        timestamp: new Date().toISOString(),
        data: {status: 200, data: 'Message re-driven.'},
        version: MessageLogVersion.A,
    });

    metrics.setNamespace("DEV/ServerlessScheduler/RedriveMessage");
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
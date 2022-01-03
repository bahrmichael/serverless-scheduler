import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {MessageStatus} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {MESSAGES_TABLE} = process.env;

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

    metrics.setNamespace("DEV/ServerlessScheduler/AbortMessage");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("AppId", appId);

    return {
        statusCode: 200,
        body: '',
    }
});
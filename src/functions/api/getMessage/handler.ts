import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {App, Message} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {MESSAGES_TABLE, APPLICATIONS_TABLE} = process.env;

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

    const m: Message = (await ddb.get({
        TableName: MESSAGES_TABLE,
        Key: {appId, messageId}
    }).promise()).Item as Message;

    const message = {
        appId: m.appId,
        messageId: m.messageId,
        sendAt: m.sendAt,
        status: m.status,
        created: m.created,
    };

    metrics.setNamespace("DEV/ServerlessScheduler/ListMessages");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("AppId", appId);
    metrics.setProperty("MessageId", message.messageId);

    return {
        statusCode: 200,
        body: JSON.stringify(message),
    }
});
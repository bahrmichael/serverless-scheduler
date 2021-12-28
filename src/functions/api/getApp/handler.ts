import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {App} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {OWNERS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const owner = event.requestContext?.authorizer?.claims['cognito:username'];
    const {appId} = event.pathParameters;

    const app: App = (await ddb.get({
        TableName: OWNERS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`
        }
    }).promise()).Item as App;

    const mappedApp = {
        name: app.name,
        id: app.id,
        created: app.created,
        endpoint: app.endpoint,
        requiresHttpAuthentication: !!app.httpAuthorization,
    }

    metrics.setNamespace("DEV/ServerlessScheduler/GetApp");
    metrics.setProperty("Owner", owner);

    return {
        statusCode: 200,
        body: JSON.stringify(mappedApp),
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
        },
    }
});
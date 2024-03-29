import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {App, HttpAuthorization} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {APPLICATIONS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId} = pathParameters;

    const app: App = (await ddb.get({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`
        }
    }).promise()).Item as App;

    let httpAuthorization: HttpAuthorization = undefined;
    if (app.httpAuthorization) {
        httpAuthorization = {
            headerName: app.httpAuthorization.headerName
        }
    }

    const mappedApp = {
        name: app.name,
        id: app.id,
        description: app.description,
        created: app.created,
        endpoint: app.endpoint,
        type: app.type,
        httpAuthorization,
        sendBackFormat: app.sendBackFormat,
    }

    metrics.setNamespace("DEV/ServerlessScheduler/GetApp");
    metrics.setProperty("Owner", owner);

    return {
        statusCode: 200,
        body: JSON.stringify(mappedApp),
    }
});
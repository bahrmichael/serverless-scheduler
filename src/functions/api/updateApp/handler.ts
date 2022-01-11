import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {App} from "../../types";

const ddb = new DynamoDB.DocumentClient();

const {APPLICATIONS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {body, pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId} = pathParameters;

    // logging the type yielded "INFO typeof body object", but typescript things that the body is a string
    const data: App = typeof body === 'object' ? body : JSON.parse(body);
    console.log({data});
    const {name, description, endpoint, httpAuthorization} = data;

    const app: App = (await ddb.get({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`,
        }
    }).promise()).Item as App;

    if (!app) {
        return {
            statusCode: 404,
            body: 'app_not_found',
        };
    }

    app.name = name ?? app.name;
    app.description = description ?? app.description;
    app.endpoint = endpoint ?? app.description;
    // only update authorization if it was previously enabled
    // this is a dirty hack until the UI is able to enable authorization later on
    if (httpAuthorization && app.httpAuthorization?.headerValue) {
        app.httpAuthorization = {
            headerName: httpAuthorization.headerName,
            headerValue: httpAuthorization.headerValue ?? app.httpAuthorization?.headerValue,
        }
    }
    await ddb.put({
        TableName: APPLICATIONS_TABLE,
        Item: app,
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/UpdateApp");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    return {
        statusCode: 200,
        body: '',
    }
});
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
    console.log({body});
    const data: App = typeof body === 'object' ? body : JSON.parse(body);
    console.log({data});
    const {name, description, endpoint, httpAuthorization} = data;

    const existingApp = (await ddb.get({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`,
        }
    }).promise()).Item;

    if (!existingApp) {
        return {
            statusCode: 404,
            body: 'app_not_found',
        };
    }

    let updateExpression = 'set #name = :n, description = :d, endpoint = :e, httpAuthorization.headerName = :a';
    const values: any = {
        ':n': name,
        ':d': description,
        ':e': endpoint,
        ':a': httpAuthorization.headerName,
    };
    if (httpAuthorization.headerValue) {
        updateExpression += ', httpAuthorization.headerValue = :v';
        values[':v'] = httpAuthorization.headerValue;
    }
    await ddb.update({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
            '#name': 'name',
        },
        ExpressionAttributeValues: values,
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/UpdateApp");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    return {
        statusCode: 200,
        body: '',
    }
});
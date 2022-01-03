import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();

const {APPLICATIONS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {body, pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId} = pathParameters;

    // logging the type yielded "INFO typeof body object", but typescript things that the body is a string
    console.log({body});
    const data = typeof body === 'object' ? body : JSON.parse(body);
    console.log({data});
    const {name, description} = data;

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

    await ddb.update({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`,
        },
        UpdateExpression: 'set #name = :n, description = :d',
        ExpressionAttributeNames: {
            '#name': 'name',
        },
        ExpressionAttributeValues: {
            ':n': name,
            ':d': description,
        }
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/UpdateApp");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    return {
        statusCode: 200,
        body: '',
    }
});
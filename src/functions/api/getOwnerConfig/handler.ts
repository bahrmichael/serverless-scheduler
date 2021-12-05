import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();

const {OWNERS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {
    console.log(event);
    console.log({c: event.requestContext?.authorizer?.claims});
    console.log({a: event.headers?.Authorization});

    const owner = event.requestContext.authorizer.owner;

    const item = (await ddb.get({
        TableName: OWNERS_TABLE,
        Key: {
            owner,
            sk: 'config'
        }
    }).promise()).Item;

    metrics.setNamespace("DEV/ServerlessScheduler/GetOwnerConfig");
    metrics.setProperty("Owner", owner);

    return {
        statusCode: 200,
        body: item,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
        },
    }
});
import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();

const {API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId, apiKeyId} = pathParameters;


    console.log('Loading api keys', {appId, apiKeyId});

    const items = (await ddb.query({
        TableName: API_KEY_TABLE,
        IndexName: 'apiKeyIdIndex',
        KeyConditionExpression: '#id = :a',
        ExpressionAttributeNames: {
            '#id': 'id',
        },
        ExpressionAttributeValues: {
            ':a': apiKeyId
        },
        Limit: 1,
    }).promise()).Items;

    console.log('Number of api keys', {count: items.length, appId, apiKeyId});
    if (items.length === 0) {
        return {
            statusCode: 404,
            body: 'not_found',
        };
    }

    const {active, apiKey} = items[0];

    if (active) {
        await ddb.update({
            TableName: API_KEY_TABLE,
            Key: {
                pk: appId,
                apiKey,
            },
            UpdateExpression: 'set #active = :a',
            ExpressionAttributeNames: {
                '#active': 'active',
            },
            ExpressionAttributeValues: {
                ':a': false,
            }
        }).promise();
    }

    metrics.setNamespace("DEV/ServerlessScheduler/DeactivateApiKey");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    return {
        statusCode: 200,
        body: '',
    }
});
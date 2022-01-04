import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();

const {API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {accessTokenId} = pathParameters;

    console.log('Loading access tokens', {accessTokenId});

    const items = (await ddb.query({
        TableName: API_KEY_TABLE,
        IndexName: 'apiKeyIdIndex',
        KeyConditionExpression: '#id = :a',
        ExpressionAttributeNames: {
            '#id': 'id',
        },
        ExpressionAttributeValues: {
            ':a': accessTokenId,
        },
        Limit: 1,
    }).promise()).Items;

    console.log('Number of access tokens', {count: items.length, accessTokenId});
    if (items.length === 0) {
        return {
            statusCode: 404,
            body: 'not_found',
        };
    }

    const {active, apiKey: accessToken} = items[0];

    if (active) {
        await ddb.update({
            TableName: API_KEY_TABLE,
            Key: {
                pk: owner,
                apiKey: accessToken,
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

    metrics.setNamespace("DEV/ServerlessScheduler/DeactivateAccessToken");
    metrics.setProperty("Owner", owner);

    return {
        statusCode: 200,
        body: '',
    }
});
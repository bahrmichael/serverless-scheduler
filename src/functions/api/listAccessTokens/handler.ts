import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();

const {API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {requestContext} = event;
    const {owner} = requestContext.authorizer;

    const items: any[] = (await ddb.query({
        TableName: API_KEY_TABLE,
        KeyConditionExpression: 'pk = :o',
        FilterExpression: '#type = :t',
        ExpressionAttributeNames: {
            '#type': 'type',
        },
        ExpressionAttributeValues: {
            ':o': owner,
            ':t': 'ACCESS_TOKEN',
        },
    }).promise()).Items ?? [];

    const mappedAccessTokens = items.map(({id, created, active}) => {
        return {
            id,
            created,
            active,
        }
    });

    metrics.setNamespace("DEV/ServerlessScheduler/ListAccessTokens");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("Count", mappedAccessTokens.length);

    return {
        statusCode: 200,
        body: JSON.stringify(mappedAccessTokens),
    }
});
import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();

const {API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId} = pathParameters;

    const items: any[] = (await ddb.query({
        TableName: API_KEY_TABLE,
        KeyConditionExpression: 'pk = :a',
        FilterExpression: '#owner = :o and #type = :t',
        ExpressionAttributeNames: {
            '#owner': 'owner',
            '#type': 'type',
        },
        ExpressionAttributeValues: {
            ':a': appId,
            ':o': owner,
            ':t': 'API_KEY',
        },
    }).promise()).Items ?? [];

    const mappedDataKeys = items.map(({id, created, active}) => {
        return {
            id,
            created,
            active,
        }
    });

    metrics.setNamespace("DEV/ServerlessScheduler/ListDataKeys");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);
    metrics.setProperty("Count", mappedDataKeys.length);

    return {
        statusCode: 200,
        body: JSON.stringify(mappedDataKeys),
    }
});
import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();

const {CONTROL_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {controlKeyId} = pathParameters;

    console.log('Loading control keys', {controlKeyId});

    const items = (await ddb.query({
        TableName: CONTROL_KEY_TABLE,
        IndexName: 'idIndex',
        KeyConditionExpression: '#id = :a',
        ExpressionAttributeNames: {
            '#id': 'id',
        },
        ExpressionAttributeValues: {
            ':a': controlKeyId,
        },
        Limit: 1,
    }).promise()).Items;

    console.log('Number of control keys', {count: items.length, controlKeyId});
    if (items.length === 0) {
        return {
            statusCode: 404,
            body: 'not_found',
        };
    }

    const {active, pk: controlKey} = items[0];

    if (active) {
        await ddb.update({
            TableName: CONTROL_KEY_TABLE,
            Key: {
                pk: controlKey,
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

    metrics.setNamespace("DEV/ServerlessScheduler/DeactivateControlKey");
    metrics.setProperty("Owner", owner);

    return {
        statusCode: 200,
        body: '',
    }
});
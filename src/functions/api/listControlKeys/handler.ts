import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {ControlKeyRecord} from "../../types";

const ddb = new DynamoDB.DocumentClient();

const {CONTROL_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {requestContext} = event;
    const {owner} = requestContext.authorizer;

    const items: ControlKeyRecord[] = (await ddb.query({
        TableName: CONTROL_KEY_TABLE,
        IndexName: 'ownerIndex',
        KeyConditionExpression: '#owner = :o',
        ExpressionAttributeNames: {
            '#owner': 'owner',
        },
        ExpressionAttributeValues: {
            ':o': owner,
        },
    }).promise()).Items as ControlKeyRecord[] ?? [];

    const mappedControlKeys = items.map(({id, created, active}) => {
        return {
            id,
            created,
            active,
        }
    });

    metrics.setNamespace("DEV/ServerlessScheduler/ListControlKeys");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("Count", mappedControlKeys.length);

    return {
        statusCode: 200,
        body: JSON.stringify(mappedControlKeys),
    }
});
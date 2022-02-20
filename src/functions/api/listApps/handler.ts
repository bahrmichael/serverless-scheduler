import 'source-map-support/register';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {App} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {APPLICATIONS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {owner} = event.requestContext.authorizer;

    const apps: App[] = (await ddb.query({
        TableName: APPLICATIONS_TABLE,
        KeyConditionExpression: '#owner = :o and begins_with(sk, :s)',
        ExpressionAttributeNames: {
            '#owner': 'owner',
        },
        ExpressionAttributeValues: {
            ':o': owner,
            ':s': 'app#'
        }
    }).promise()).Items as App[] ?? [];

    const mappedApps = apps.map(({name, id, description, created, endpoint, type, httpAuthorization, sendBackFormat}) => {
        return {
            name,
            id,
            description,
            created,
            endpoint,
            type,
            httpAuthorization,
            sendBackFormat,
        };
    });

    metrics.setNamespace("DEV/ServerlessScheduler/ListApps");
    metrics.setProperty("Owner", owner);
    metrics.putMetric("ApplicationCount", mappedApps.length);

    return {
        statusCode: 200,
        body: JSON.stringify(mappedApps),
    }
});
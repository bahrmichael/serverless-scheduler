import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {PostConfirmationTriggerEvent} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';

const ddb = new DynamoDB.DocumentClient();

const {OWNERS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: PostConfirmationTriggerEvent) => {

    const {userName} = event;
    const {sub} = event.request.userAttributes;

    await ddb.put({
        TableName: OWNERS_TABLE,
        Item: {
            owner: userName,
            sk: 'config',
            apiKey: uuid(),
            sub,
        }
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/PostConfirmation");
    metrics.setProperty("Owner", userName);

    return event;
});

import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {PostConfirmationTriggerEvent} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';

const ddb = new DynamoDB.DocumentClient();

const {OWNERS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: PostConfirmationTriggerEvent) => {

    console.log(event);

    const owner = event.userName;

    await ddb.put({
        TableName: OWNERS_TABLE,
        Item: {
            owner,
            sk: 'config',
            apiKey: uuid()
        }
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/PostConfirmation");
    metrics.setProperty("Owner", owner);

    return event;
});

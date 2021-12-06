import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {PostConfirmationTriggerEvent} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

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
            // Don't set an api key on user signup. We will ask the user to do that manually, and then only show the code once.
            sub,
        }
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/PostConfirmation");
    metrics.setProperty("Owner", userName);

    return event;
});

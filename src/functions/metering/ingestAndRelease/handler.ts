import 'source-map-support/register';
import {metricScope} from "aws-embedded-metrics";
import {DynamoDBStreamEvent} from "aws-lambda";

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {MessageStatus} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const {METERING_TABLE} = process.env;

export const main = metricScope(_metrics => async (event: DynamoDBStreamEvent) => {

    const day = new Date().toISOString().split('T')[0];

    const ingest: Map<string, number> = new Map<string, number>();
    const sent: Map<string, number> = new Map<string, number>();

    event.Records
        .filter((e) => e.eventName === 'INSERT')
        .map((r) => r.dynamodb.NewImage)
        .forEach((ni) => {
            const owner = ni.owner.S;
            const appId = ni.appId.S;

            const id = `${owner}#${appId}#${day}`;
            ingest.set(id, (ingest.has(id) ? ingest.get(id) : 0) + 1);
        });

    event.Records
        .filter((e) => e.eventName === 'MODIFY')
        .map((r) => r.dynamodb.NewImage)
        .forEach((ni) => {
            const owner = ni.owner.S;
            const appId = ni.appId.S;
            const status = ni.status.S;

            if (status === MessageStatus.SENT.valueOf()) {
                const id = `${owner}#${appId}#${day}`;
                sent.set(id, (sent.has(id) ? sent.get(id) : 0) + 1);
            }
        });

    console.log({ingest, sent});

    const promises: Promise<any>[] = [];

    for (const [id, count] of ingest) {
        const idSplit = id.split('#');
        const owner = idSplit[0];
        const app = idSplit[1];
        const day = idSplit[2];

        promises.push(ddb.update({
            TableName: METERING_TABLE,
            Key: {
                owner,
                sk: `${app}#${day}`,
            },
            UpdateExpression: 'set ingestionCount = if_not_exists(ingestionCount, :c1) + :c2',
            ExpressionAttributeValues: {
                ':c1': 1,
                ':c2': count,
            }
        }).promise());
    }

    for (const [id, count] of sent) {
        const idSplit = id.split('#');
        const owner = idSplit[0];
        const app = idSplit[1];
        const day = idSplit[2];

        promises.push(ddb.update({
            TableName: METERING_TABLE,
            Key: {
                owner,
                sk: `${app}#${day}`,
            },
            UpdateExpression: 'set sentCount = if_not_exists(sentCount, :c1) + :c2',
            ExpressionAttributeValues: {
                ':c1': 1,
                ':c2': count,
            }
        }).promise());
    }

    await Promise.all(promises);
});



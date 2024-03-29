import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {
    App,
    AppVersion,
    IntegrationType,
    Message,
    MessageLog,
    MessageLogVersion,
    MessageStatus,
    MessageVersion
} from "../../types";
import {SQSEvent} from "aws-lambda";
import axios from 'axios';
import {metricScope} from "aws-embedded-metrics";
import axiosRetry from 'axios-retry';
import * as SQS from "aws-sdk/clients/sqs";
import {calculateDelay} from "../../util";

const sqs = new SQS();
const ddb = new DynamoDB.DocumentClient();
const https = axios.create({
    timeout: 2_000,
});

axiosRetry(https, {retries: 2});

const {MESSAGES_TABLE, APPLICATIONS_TABLE, MESSAGE_LOGS_TABLE} = process.env;

const DAY = 24 * 60 * 60;

async function setReleased(message: Message, released: Date) {
    await ddb.update({
        TableName: MESSAGES_TABLE,
        Key: {
            appId: message.appId,
            messageId: message.messageId,
        },
        UpdateExpression: 'set #status = :s, releasedAt = :r, timeToLive = :t',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
        ExpressionAttributeValues: {
            ':s': MessageStatus.SENT,
            ':r': released.toISOString(),
            // Let DynamoDB clean up events ASAP
            ':t': Math.floor(new Date().getTime() / 1_000 + DAY * 30),
        }
    }).promise();
    await writeMessageLog({
        owner: message.owner,
        appId: message.appId,
        messageId: message.messageId,
        timestamp: new Date().toISOString(),
        data: {status: 200, data: `Message sent with a delay of ${released.getTime() - new Date(message.sendAt).getTime()} ms.`},
        version: MessageLogVersion.A,
    });
}

async function increaseErrorCount(message: Message) {
    await ddb.update({
        TableName: MESSAGES_TABLE,
        Key: {
            appId: message.appId,
            messageId: message.messageId,
        },
        UpdateExpression: 'set errorCount = if_not_exists(errorCount, :c1) + :c2',
        ExpressionAttributeValues: {
            ':c1': 1,
            ':c2': 1,
        }
    }).promise();
}

async function setFailed(m: Message) {
    m.errorCount = m.errorCount > 0 ? m.errorCount + 1 : 1;
    m.gsi1pk = `${m.appId}#${MessageStatus.FAILED}`;
    m.gsi1sk = m.messageId;
    m.status = MessageStatus.FAILED;

    await ddb.put({
        TableName: MESSAGES_TABLE,
        Item: m,
    }).promise();
}

export const main = metricScope(metrics => async (event: SQSEvent) => {
    const {Records: records} = event;
    if (records.length > 1) {
        throw Error('Batch size must be 1. Was ' + records.length);
    }

    const message: Message = JSON.parse(records[0].body) as Message;

    metrics.setNamespace("DEV/ServerlessScheduler/ReleaseMessage");
    metrics.setProperty("Owner", message.owner);
    metrics.setProperty("App", message.appId);
    metrics.setProperty("MessageId", message.messageId);
    metrics.putMetric("Messages", 1, "Count");

    const app: App = (await ddb.get({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner: message.owner,
            sk: `app#${message.appId}`
        },
    }).promise()).Item as App;
    if (!app) {
        console.log('Cannot find app', {messageId: message.messageId, appId: message.appId});
        await setFailed(message);
        return;
    }

    console.log('releasing_message', {messageId: message.messageId, appId: message.appId});

    const released = new Date();
    const targetRelease = new Date(message.sendAt).getTime();
    const releaseDelay = released.getTime() - targetRelease;

    try {
        if (app.type === IntegrationType.REST) {
            const headers: any = {};
            if (app.httpAuthorization) {
                headers[app.httpAuthorization.headerName] = app.httpAuthorization.headerValue;
            }
            // todo: error handling, retries
            // example: don't return a status code from the contracts appraisal
            if (message.version >= MessageVersion.A && app.version >= AppVersion.A) {
                if (app.sendBackFormat === 'unwrap_json') {
                    await https.post(app.endpoint, message.payload, {headers});
                } else {
                    // This is the old default path. It can be removed when we have no more un-versioned apps and
                    // no more un-versioned messages AND if no one uses the payload_field type anymore AND can't
                    // create apps/messages with that field type.
                    await https.post(app.endpoint, {payload: message.payload}, {headers});
                }
            } else {
                // This is the old default path which can be removed once we have no more un-versioned documents.
                await https.post(app.endpoint, {payload: message.payload}, {headers});
            }
        } else if (app.type === IntegrationType.SQS) {
            const delay = calculateDelay(message.sendAt);
            let body;
            switch (typeof message.payload) {
                case 'object':
                    body = JSON.stringify(message.payload);
                    break;
                case 'string':
                    body = message.payload;
                    break;
                default:
                    body = '' + message.payload;
            }
            console.log('Releasing SQS message with delay:', delay);
            await sqs.sendMessage({
                QueueUrl: app.endpoint,
                MessageBody: body,
                DelaySeconds: delay,
            }).promise();
        } else {
            console.error('Unhandled app type', app.type);
            throw Error('Unhandled app type.');
        }
        metrics.putMetric("Released", 1, "Count");
        metrics.setProperty("Integration", app.type);

        console.log('message_released', {messageId: message.messageId, appId: message.appId, owner: message.owner, type: app.type});

        await setReleased(message, released);

        // We have to make this call at the end, because we don't want to delay the release.
        // Furthermore we prefer an accurate status over metrics.
        // By doing this in the successful path, we also only emit DelayAfterError once per message.
        // Message that get stuck in the DLQ won't produce this metrics.
        const m: Message = (await ddb.get({
            TableName: MESSAGES_TABLE,
            Key: {
                appId: message.appId,
                messageId: message.messageId,
            },
        }).promise()).Item as Message;
        if (!m) {
            console.log('Message has been removed. Skipping further action.', {
                owner: message.owner,
                app: message.appId,
                id: message.messageId
            });
        } else if (m?.errorCount) {
            metrics.putMetric("DelayAfterError", releaseDelay, "Milliseconds");
        } else {
            metrics.putMetric("Delay", releaseDelay, "Milliseconds");
        }
    } catch (e) {
        metrics.putMetric("Failed", 1, "Count");

        if (e?.response) {
            console.warn('response', e.response);
        } else {
            console.warn('full', e);
        }

        const m: Message = (await ddb.get({
            TableName: MESSAGES_TABLE,
            Key: {
                appId: message.appId,
                messageId: message.messageId,
            },
        }).promise()).Item as Message;

        if (!m) {
            console.log('Message has been removed. Skipping further action.', {
                owner: message.owner,
                app: message.appId,
                id: message.messageId
            });
        } else if (!m.errorCount || m.errorCount <= 3) {
            await increaseErrorCount(message);
            // throw an error so that lambda can retry
            throw e;
        } else {
            await setFailed(m);
        }

        try {
            if (e?.response) {
                const {status, data} = e?.response;
                const entry: MessageLog = {
                    messageId: message.messageId,
                    owner: message.owner,
                    appId: message.appId,
                    timestamp: released.toISOString(),
                    data: {status, data},
                    version: MessageLogVersion.A,
                };
                await writeMessageLog(entry);
            } else {
                const entry: MessageLog = {
                    messageId: message.messageId,
                    owner: message.owner,
                    appId: message.appId,
                    timestamp: released.toISOString(),
                    data: {status: 400, data: e.message},
                    version: MessageLogVersion.A,
                };
                await writeMessageLog(entry);
            }
        } catch (e) {
            console.error('Failed to write error logs', e);
        }
    }
});

async function writeMessageLog(messageLog: MessageLog): Promise<void> {
    await ddb.put({
        TableName: MESSAGE_LOGS_TABLE,
        Item: messageLog,
    }).promise();
}


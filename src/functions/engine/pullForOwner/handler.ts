import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as SQS from 'aws-sdk/clients/sqs';
import {App, Message, MessageStatus} from "../../types";
import {calculateDelay} from "../../util";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();
const sqs = new SQS();

const {MESSAGES_TABLE, QUEUE_URL} = process.env;

export const main = metricScope(metrics => async (app: App) => {
    console.log('Pulling messages', {owner: app.owner, app: app.id});
    const in5Minutes = new Date();
    in5Minutes.setSeconds(0, 0);
    in5Minutes.setMinutes(in5Minutes.getMinutes() + 5);

    // todo: is there a poison pill scenario, where one bad message or bug will block future messages from being loaded?
    // yeah, if a message does not transition away from READY
    const messages: Message[] = (await ddb.query({
        TableName: MESSAGES_TABLE,
        /*
        We use a sparse index to only query for READY items. The sparse index gets populated when a message is inserted
        into the table, and the attribute is removed in this function after sending the message.
         */
        IndexName: 'appStatusIndex',
        KeyConditionExpression: 'gsi1pk = :pk and gsi1sk < :sk',
        ExpressionAttributeValues: {
            ':pk': `${app.id}#${MessageStatus.READY}`,
            // ULIDs are 26 characters. Append 0s to the date to start with the first key from the time range.
            ':sk': `${in5Minutes.toISOString()}#00000000000000000000000000`,
        },
        // do not use projection attributes, because we put the whole message into the queue already
    }).promise()).Items as Message[];

    console.log('loaded_messages', {owner: app.owner, app: app.id, count: messages.length});

    metrics.setNamespace("DEV/ServerlessScheduler/PullForOwner");
    metrics.putMetric("Messages", messages.length, "Count");
    metrics.setProperty("Owner", app.owner);
    metrics.setProperty("App", app.id);

    const promises: Promise<void>[] = [];
    for (const message of messages) {
        // todo: chunk into 10 message chunks // BUT WHY? Because of SQS batch size?
        promises.push(processMessage([message], app.owner));
    }
    console.log('Awaiting requests', {owner: app.owner, app: app.id, count: promises.length});
    await Promise.all(promises);

    /*
    Partitioning idea: When this function runs more than x seconds, add a new partition to the owner.
    This should then even out load on future messages.
     */
});

async function processMessage(messages: Message[], owner: string): Promise<void> {
    const entries: { Id: string, MessageBody: string, DelaySeconds: number }[] = messages.map((m) => {
        return {
            // todo: Remove this once all messages have a version field.
            Id: m.messageId.includes('#') ? m.messageId.split("#")[1] : m.messageId,
            MessageBody: JSON.stringify(m),
            DelaySeconds: calculateDelay(m.sendAt),
        }
    });
    console.log('queueing_messages', {owner, messages: messages.map(({messageId, appId}) => {
        return {messageId, appId}
    })});
    await sqs.sendMessageBatch({
        QueueUrl: QUEUE_URL,
        Entries: entries,
    }).promise();

    for (const {appId, messageId} of messages) {
        await ddb.update({
            TableName: MESSAGES_TABLE,
            Key: {
                appId,
                messageId,
            },
            UpdateExpression: 'set #status = :s remove gsi1pk, gsi1sk',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':s': MessageStatus.QUEUED,
            }
        }).promise();
        console.log('mark_message_queued', {appId, messageId, owner});
    }
}

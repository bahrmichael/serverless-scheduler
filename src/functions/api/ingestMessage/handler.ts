import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as SQS from 'aws-sdk/clients/sqs';
import {Message, MessageStatus} from "../../types";
import {APIGatewayProxyEventBase} from "aws-lambda";
import {ulid} from "ulid";
import {calculateDelay} from "../../util";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();
const sqs = new SQS();

const {MESSAGES_TABLE, QUEUE_URL} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {
    console.log({requestContext: event.requestContext});

    const {owner, appId} = event.requestContext.authorizer;

    // todo: input validation
    let message: Message;
    if (event.isBase64Encoded) {
        const decoded = Buffer.from(event.body, 'base64').toString('utf-8');
        console.log({decoded});
        message = JSON.parse(decoded) as Message;
    } else {
        console.log({body: event.body});
        message = JSON.parse(event.body) as Message;
    }

    if (!message.payload) {
        return {
            statusCode: 400,
            body: 'missing_payload',
        };
    }

    message.owner = owner;
    message.appId = appId;
    message.messageId = ulid();
    message.created = new Date().toISOString();

    const in10Minutes = new Date();
    in10Minutes.setMinutes(in10Minutes.getMinutes() + 10);
    if (new Date(message.sendAt) < in10Minutes) {
        console.log('queue_short_term', {messageId: message.messageId, appId, owner});

        await sqs.sendMessage({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(message),
            DelaySeconds: calculateDelay(message.sendAt),
        }).promise();

        message.status = MessageStatus.QUEUED;

        await ddb.put({
            TableName: MESSAGES_TABLE,
            Item: message,
        }).promise();

        metrics.putMetric("ShortTerm", 1, "Count");
        metrics.putMetric("Queued", 1, "Count");
    } else {
        console.log('store_long_term', {messageId: message.messageId, appId, owner});

        message.status = MessageStatus.READY;
        message.gsi1pk = `${appId}#${MessageStatus.READY}`;
        message.gsi1sk = `${message.sendAt}#${message.messageId}`;

        await ddb.put({
            TableName: MESSAGES_TABLE,
            Item: message,
        }).promise();

        metrics.putMetric("LongTerm", 1, "Count");
    }

    metrics.setNamespace("DEV/ServerlessScheduler/Ingest");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);
    metrics.setProperty("MessageId", message.messageId);

    return {
        statusCode: 200,
        body: JSON.stringify({scheduledMessageId: message.messageId}),
    }
});

// todo: can we use a low batch size, or maybe 1 to achieve high isolation?
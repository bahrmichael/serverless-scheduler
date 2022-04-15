import {SNSEvent, SNSHandler} from "aws-lambda";
import {DynamoDB, SNS} from "aws-sdk";

const ddb = new DynamoDB.DocumentClient();
const sns = new SNS();

const {TOPIC, TABLE} = process.env;

export const main: SNSHandler = async (event: SNSEvent) => {
  await Promise.all(event.Records.map(async (record) => {
    const { Message: body } = record.Sns;
    let { Message: message } = JSON.parse(body);

    if (typeof message === 'string') {
      message = JSON.parse(message);
    }

    let successfullySubscribed = false;
    let subscriptionExpired = false;

    if (message.action === 'subscribe-success') {
      successfullySubscribed = true;
    } else if (message.action === 'unsubscribe-pending') {
      await sns.publish({
        TopicArn: TOPIC,
        Subject: 'unsubscribe pending',
        Message: `unsubscribe pending: ${JSON.stringify(message)}`,
      }).promise();
    } else if (message.action === 'subscribe-fail') {
      await sns.publish({
        TopicArn: TOPIC,
        Subject: 'AWS Marketplace Subscription failed',
        Message: `Subscription failed: ${JSON.stringify(message)}`,
      }).promise();
    } else if (message.action === 'unsubscribe-success') {
      subscriptionExpired = true;
    } else {
      console.error('Unhandled action');
      throw new Error(`Unhandled action - msg: ${JSON.stringify(record)}`);
    }

    await ddb.update({
      TableName: TABLE,
      Key: {
        customerIdentifier: message['customer-identifier'],
      },
      UpdateExpression: 'set successfully_subscribed = :sub, subscription_expired = :exp',
      ExpressionAttributeValues: {
        ':sub': { successfullySubscribed },
        ':exp': { subscriptionExpired },
      },
      ReturnValues: 'UPDATED_NEW',
    }).promise();
  }));
};

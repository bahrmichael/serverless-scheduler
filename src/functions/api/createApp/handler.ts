import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';
import {App} from "../../types";

const ddb = new DynamoDB.DocumentClient();

const {OWNERS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const owner = event.headers.owner;
    const {name, endpoint, authentication} = JSON.parse(event.body);

    const id = uuid();

    const app: App = {
        owner,
        name,
        id,
        created: new Date().getTime(),
        endpoint,
        httpAuthorization: authentication,
    };

    await ddb.put({
        TableName: OWNERS_TABLE,
        Item: {
            ...app,
            sk: `app#${id}`
        },
        ConditionExpression: 'attribute_not_exists(sk)',
        // todo: return a proper message on failure
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/CreateApp");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", id);

    return {
        statusCode: 200,
        body: JSON.stringify({}),
    }
});
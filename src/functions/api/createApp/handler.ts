import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';
import {App} from "../../types";

const ddb = new DynamoDB.DocumentClient();

const {APPLICATIONS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const owner = event.headers.owner;
    console.log('typeof body', typeof event.body);
    const {name, description, endpoint, httpAuthorization, type} = JSON.parse(event.body);

    const id = uuid();

    const app: App = {
        owner,
        name,
        description,
        type,
        id,
        created: new Date().getTime(),
        endpoint,
        httpAuthorization,
    };

    await ddb.put({
        TableName: APPLICATIONS_TABLE,
        Item: {
            ...app,
            sk: `app#${id}`,
            owner,
        },
        ConditionExpression: 'attribute_not_exists(sk)',
        // todo: return a proper message on failure
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/CreateApp");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", id);

    return {
        statusCode: 200,
        body: JSON.stringify({id}),
    }
});
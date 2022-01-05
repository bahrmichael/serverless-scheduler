import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as ApiGateway from 'aws-sdk/clients/apigateway';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';
import {App} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const apigw = new ApiGateway();

const {APPLICATIONS_TABLE, API_ID, STAGE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {body, requestContext} = event;
    const {owner} = requestContext.authorizer;

    // logging the type yielded "INFO typeof body object", but typescript things that the body is a string
    console.log({body});
    const data = typeof body === 'object' ? body : JSON.parse(body);
    console.log({data});
    const {name, description, endpoint, httpAuthorization, type} = data;

    const id = uuid();

    const usagePlanId = (await apigw.createUsagePlan({
        name: id,
        description: `App:${id},Owner:${owner}`,
        throttle: {
            rateLimit: 100,
            burstLimit: 500,
        },
        quota: {
            limit: 10_000,
            period: "DAY",
        }
    }).promise()).id;
    await apigw.updateUsagePlan({
        usagePlanId,
        patchOperations: [{
            op: 'add',
            path: '/apiStages',
            value: `${API_ID}:${STAGE}`
        }]
    }).promise();

    const app: App = {
        owner,
        name,
        description,
        type,
        id,
        created: new Date().getTime(),
        endpoint,
        httpAuthorization,
        usagePlanId,
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
    };
});
import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as ApiGateway from 'aws-sdk/clients/apigateway';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';
import {ApiKeyRecord} from "../../types";

const ddb = new DynamoDB.DocumentClient();
const apigw = new ApiGateway();

const {API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {owner} = event.requestContext.authorizer;

    const accessToken = uuid();
    const id = uuid();

    const usagePlanId = (await apigw.createUsagePlan({
        name: id,
        description: `AccessToken,Owner:${owner}`,
        throttle: {
            rateLimit: 10,
            burstLimit: 50,
        },
        quota: {
            limit: 1_000,
            period: "DAY",
        }
    }).promise()).id;
    const apigwApiKey = await apigw.createApiKey({
        enabled: true,
        name: id,
    }).promise();
    try {
        await apigw.createUsagePlanKey({
            usagePlanId: usagePlanId,
            keyType: "API_KEY",
            keyId: apigwApiKey.id,
        }).promise();
    } catch (e) {
        console.log('Failed to associate usage plan', e);
        throw e;
    }

    const apiKeyRecord: ApiKeyRecord = {
        id,
        pk: owner,
        apiKey: accessToken,
        owner,
        apigwApiKeyId: apigwApiKey.id,
        apigwApiKeyValue: apigwApiKey.value,
        active: true,
        created: new Date().toISOString(),
        usagePlanId,
        type: 'ACCESS_TOKEN',
    };

    await ddb.put({
        TableName: API_KEY_TABLE,
        Item: apiKeyRecord
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/CreateAccessToken");
    metrics.setProperty("Owner", owner);

    return {
        statusCode: 200,
        body: JSON.stringify({accessToken}),
    }
});
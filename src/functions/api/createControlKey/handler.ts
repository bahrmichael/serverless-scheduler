import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as ApiGateway from 'aws-sdk/clients/apigateway';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';
import {ControlKeyRecord, ControlKeyRecordVersion} from "../../types";
import {generateToken} from "../../crypto";

const ddb = new DynamoDB.DocumentClient();
const apigw = new ApiGateway();

const {CONTROL_KEY_TABLE, API_ID, STAGE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {owner} = event.requestContext.authorizer;

    const controlKey = await generateToken();
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

    await apigw.updateUsagePlan({
        usagePlanId,
        patchOperations: [{
            op: 'add',
            path: '/apiStages',
            value: `${API_ID}:${STAGE}`
        }]
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

    const controlKeyRecord: ControlKeyRecord = {
        pk: controlKey,
        controlKey,
        owner,
        id,
        apigwApiKeyId: apigwApiKey.id,
        apigwApiKeyValue: apigwApiKey.value,
        active: true,
        created: new Date().toISOString(),
        usagePlanId,
        version: ControlKeyRecordVersion.A
    };

    await ddb.put({
        TableName: CONTROL_KEY_TABLE,
        Item: controlKeyRecord
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/CreateControlKey");
    metrics.setProperty("Owner", owner);

    return {
        statusCode: 200,
        body: JSON.stringify({id, secret: controlKey}),
    }
});
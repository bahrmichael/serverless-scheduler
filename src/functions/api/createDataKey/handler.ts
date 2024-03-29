import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import * as ApiGateway from 'aws-sdk/clients/apigateway';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";
import {v4 as uuid} from 'uuid';
import {ApiKeyRecord, ApiKeyRecordVersion, App} from "../../types";
import {generateToken} from "../../crypto";

const ddb = new DynamoDB.DocumentClient();
const apigw = new ApiGateway();

const {APPLICATIONS_TABLE, API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId} = pathParameters;

    const app: App = (await ddb.get({
        TableName: APPLICATIONS_TABLE,
        Key: {
            owner,
            sk: `app#${appId}`,
        }
    }).promise()).Item as App;
    if (!app) {
        console.log('app_not_found', owner, appId);
        return {
            statusCode: 403,
            body: 'app_not_found',
        };
    }

    const dataKey = await generateToken();
    const id = uuid();

    console.log('Create api key')

    const apigwApiKey = await apigw.createApiKey({
        enabled: true,
        name: id,
    }).promise();
    try {
        console.log('Attach api key to usage plan')
        await apigw.createUsagePlanKey({
            usagePlanId: app.usagePlanId,
            keyType: "API_KEY",
            keyId: apigwApiKey.id,
        }).promise();
    } catch (e) {
        console.log('Failed to associate usage plan', e);
        throw e;
    }

    const apiKeyRecord: ApiKeyRecord = {
        id,
        pk: appId,
        appId,
        apiKey: dataKey,
        owner,
        apigwApiKeyId: apigwApiKey.id,
        apigwApiKeyValue: apigwApiKey.value,
        active: true,
        created: new Date().toISOString(),
        type: 'API_KEY',
        usagePlanId: app.usagePlanId,
        version: ApiKeyRecordVersion.A
    };

    console.log('Store record in ddb')

    await ddb.put({
        TableName: API_KEY_TABLE,
        Item: apiKeyRecord
    }).promise();

    metrics.setNamespace("DEV/ServerlessScheduler/CreateDataKey");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    return {
        statusCode: 200,
        body: JSON.stringify({id, secret: dataKey}),
    }
});
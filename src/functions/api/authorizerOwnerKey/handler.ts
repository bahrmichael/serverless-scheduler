import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {metricScope} from "aws-embedded-metrics";
import {ApiKeyRecord} from "../../types";

const ddb = new DynamoDB.DocumentClient();

const {API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: any) => {
    // instead of just asking for an api key, ask for basic auth with id and secret
    const data = event.authorizationToken;
    const buff = Buffer.from(data, 'base64');
    const decoded = buff.toString('ascii');
    const parts = decoded.split(':');
    const appId = parts[0];
    const apiKey = parts[1];

    const apiKeyRecord: ApiKeyRecord = (await ddb.get({
        TableName: API_KEY_TABLE,
        Key: {appId, apiKey},
    }).promise()).Item as ApiKeyRecord;

    if (!apiKeyRecord?.active) {
        metrics.putMetric("AccessDenied", 1, "Count");
        return generatePolicy('user', 'Deny', event.methodArn);
    }

    metrics.putMetric("AccessGranted", 1, "Count");
    metrics.setProperty("Owner", apiKeyRecord.owner);
    metrics.setProperty("App", apiKeyRecord.appId);
    return generatePolicy('user', 'Allow', event.methodArn, apiKeyRecord.apigwApiKeyValue, {owner: apiKeyRecord.owner, appId: apiKeyRecord.appId});
});

// Help function to generate an IAM policy
function generatePolicy(principalId, effect, resource, internalApiKey?: string, context?: any) {
    const authResponse: any = {};

    authResponse.principalId = principalId;
    if (effect && resource) {
        const policyDocument: any= {};
        policyDocument.Version = '2012-10-17';
        policyDocument.Statement = [];
        const statementOne: any = {};
        statementOne.Action = 'execute-api:Invoke';
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }

    authResponse.context = context;
    authResponse.usageIdentifierKey = internalApiKey;
    return authResponse;
}
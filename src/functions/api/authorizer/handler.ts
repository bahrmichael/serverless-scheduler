import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {metricScope} from "aws-embedded-metrics";
import {ApiKeyRecord} from "../../types";
import {APIGatewayAuthorizerEvent} from "aws-lambda/trigger/api-gateway-authorizer";

const ddb = new DynamoDB.DocumentClient();

const {API_KEY_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayAuthorizerEvent) => {

    metrics.setNamespace("ServerlessScheduler/Authorizer");
    console.log({authType: event.type});

    let authorizationToken;
    if (event.type === 'REQUEST') {
        /*
        Lowercase the headers so that the customer doesn't have to respect casing on
        the authorization header. E.g. insomnia sent a lowercase authorization header.
         */
        for (const key of Object.keys(event.headers)) {
            event.headers[key.toLowerCase()] = event.headers[key];
        }
        authorizationToken = event.headers.authorization;
    } else {
        throw Error(`Unhandled authorizer event type: ${event.type}`);
    }

    metrics.setProperty("Path", event.path);
    metrics.setProperty("Resource", event.pathParameters);
    console.log({authorizationToken});

    if (!authorizationToken) {
        metrics.putMetric("AccessDenied", 1, "Count");
        return generatePolicy('user', 'Deny', event.methodArn);
    }

    let appId;
    let apiKey;
    let owner;
    if (authorizationToken.startsWith('Basic')) {
        console.log('Auth:Basic');
        const data = authorizationToken.split(' ')[1];
        const buff = Buffer.from(data, 'base64');
        const decoded = buff.toString('ascii');
        const parts = decoded.split(':');
        const id  = parts[0];
        const publicApiKey = parts[1];

        const apiKeyRecord: ApiKeyRecord = (await ddb.get({
            TableName: API_KEY_TABLE,
            Key: {pk: id, apiKey: publicApiKey},
        }).promise()).Item as ApiKeyRecord;

        if (!apiKeyRecord?.active || ['/access-token'].includes(event.path)) {
            metrics.putMetric("AccessDenied", 1, "Count");
            return generatePolicy('user', 'Deny', event.methodArn);
        }

        owner = apiKeyRecord.owner;
        apiKey = apiKeyRecord.apigwApiKeyValue;
        appId = apiKeyRecord.appId;
    } else {
        console.log('Auth:ApiGwToken');
        apiKey = authorizationToken;
        owner = event.headers.owner;
        appId = event.headers.appId;
    }

    // todo: authorize that an app/message actually belongs to the owner. better here than in each function individually.

    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    metrics.putMetric("AccessGranted", 1, "Count");
    return generatePolicy('user', 'Allow', event.methodArn, apiKey, {owner, appId});
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
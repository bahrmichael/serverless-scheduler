import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {metricScope} from "aws-embedded-metrics";
import {ApiKeyRecord, ControlKeyRecord} from "../../types";
import {APIGatewayAuthorizerEvent} from "aws-lambda/trigger/api-gateway-authorizer";
import {decode} from 'next-auth/jwt';
import {match} from 'node-match-path';

const ddb = new DynamoDB.DocumentClient();

const {API_KEY_TABLE, CONTROL_KEY_TABLE, APPS_TABLE, MESSAGES_TABLE, NEXTAUTH_SECRET, CORE_API_KEY} = process.env;

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

    const {path, pathParameters, methodArn, headers} = event;

    metrics.setProperty("Path", path);
    metrics.setProperty("Resource", pathParameters);
    console.log({authorizationToken});

    if (!authorizationToken) {
        metrics.putMetric("AccessDenied", 1, "Count");
        return generatePolicy('user', 'Deny', methodArn);
    }

    let appId;
    let apiKey;
    let owner;
    let messageId;

    if (authorizationToken.startsWith('Basic')) {
        console.log('Auth:Basic');

        const allowedRoutes = [{
            method: 'get',
            path: '/messages'
        }, {
            method: 'get',
            path: '/messages/:messageId'
        }, {
            method: 'get',
            path: '/messages/:messageId/logs'
        }, {
            method: 'put',
            path: '/messages/:messageId/abort'
        }, {
            method: 'put',
            path: '/messages/:messageId/redrive'
        }];

        let isAllowed = false;
        for (const allowedRoute of allowedRoutes) {
            if (allowedRoute.method === event.httpMethod.toLowerCase() && match(event.path, allowedRoute.path)) {
                // is allowed to pass
                isAllowed = true;
                break;
            }
        }
        if (!isAllowed) {
            // if no match was found, we deny the request
            metrics.putMetric("AccessDenied", 1, "Count");
            return generatePolicy('user', 'Deny', methodArn);
        }

        const data = authorizationToken.split(' ')[1];
        const buff = Buffer.from(data, 'base64');
        const decoded = buff.toString('ascii');
        const parts = decoded.split(':');
        const id = parts[0];
        const publicApiKey = parts[1];

        const apiKeyRecord: ApiKeyRecord = (await ddb.get({
            TableName: API_KEY_TABLE,
            Key: {pk: id, apiKey: publicApiKey},
        }).promise()).Item as ApiKeyRecord;

        if (!apiKeyRecord?.active || ['/access-token'].includes(path)) {
            metrics.putMetric("AccessDenied", 1, "Count");
            return generatePolicy('user', 'Deny', methodArn);
        }

        owner = apiKeyRecord.owner;
        apiKey = apiKeyRecord.apigwApiKeyValue;
        appId = apiKeyRecord.appId;

        // todo: when the client calls ListApps then this won't work, because there's no single appId

        const appRes = await ddb.get({
            TableName: APPS_TABLE,
            Key: {owner, sk: `app#${appId}`}
        }).promise();
        if (!appRes?.Item) {
            metrics.putMetric("AccessDenied", 1, "Count");
            return generatePolicy('user', 'Deny', methodArn);
        }

        if (pathParameters.messageId) {
            const messageRes = await ddb.get({
                TableName: MESSAGES_TABLE,
                Key: {appId, messageId: pathParameters.messageId}
            }).promise();
            if (messageRes?.Item?.owner !== owner) {
                metrics.putMetric("AccessDenied", 1, "Count");
                return generatePolicy('user', 'Deny', methodArn);
            }
            messageId = messageRes.Item.messageId;
        }
    } else if (authorizationToken.startsWith('Token')) {
        console.log('Auth:Token');

        const allowedRoutes = [{
            method: 'post',
            path: '/applications'
        }, {
            method: 'get',
            path: '/applications'
        }, {
            method: 'get',
            path: '/applications/:appId'
        }, {
            method: 'put',
            path: '/applications/:appId'
        }, {
            method: 'delete',
            path: '/applications/:appId'
        }, {
            method: 'post',
            path: '/applications/:appId/data-keys'
        }, {
            method: 'get',
            path: '/applications/:appId/data-keys'
        }, {
            method: 'put',
            path: '/applications/:appId/data-keys/:dataKeyId/deactivate'
        }, {
            method: 'post',
            path: '/control-keys'
        }, {
            method: 'get',
            path: '/control-keys'
        }, {
            method: 'put',
            path: '/control-keys/:controlKeyId/deactivate'
        }];

        let isAllowed = false;
        for (const allowedRoute of allowedRoutes) {
            if (allowedRoute.method === event.httpMethod.toLowerCase() && match(event.path, allowedRoute.path)) {
                // is allowed to pass
                isAllowed = true;
                break;
            }
        }
        if (!isAllowed) {
            // if no match was found, we deny the request
            metrics.putMetric("AccessDenied", 1, "Count");
            return generatePolicy('user', 'Deny', methodArn);
        }

        const publicControlKey = authorizationToken.split(' ')[1];

        const controlKeyRecord: ControlKeyRecord = (await ddb.get({
            TableName: CONTROL_KEY_TABLE,
            Key: {pk: publicControlKey},
        }).promise()).Item as ControlKeyRecord;

        if (!controlKeyRecord?.active /* todo: block routes */) {
            metrics.putMetric("AccessDenied", 1, "Count");
            return generatePolicy('user', 'Deny', methodArn);
        }

        owner = controlKeyRecord.owner;
        apiKey = controlKeyRecord.apigwApiKeyValue;

        if (pathParameters.appId) {
            const appRes = await ddb.get({
                TableName: APPS_TABLE,
                Key: {owner, sk: `app#${pathParameters.appId}`}
            }).promise();
            if (!appRes?.Item) {
                metrics.putMetric("AccessDenied", 1, "Count");
                return generatePolicy('user', 'Deny', methodArn);
            }
            appId = appRes.Item.appId;
        }
    } else if (authorizationToken === 'frontendCookie') {

        console.log('Auth:Cookie');

        const allowedRoutes = [{
            method: 'get',
            path: '/messages'
        }, {
            method: 'get',
            path: '/messages/:messageId'
        }, {
            method: 'get',
            path: '/messages/:messageId/logs'
        }, {
            method: 'put',
            path: '/messages/:messageId/abort'
        }, {
            method: 'put',
            path: '/messages/:messageId/redrive'
        }, {
            method: 'post',
            path: '/applications'
        }, {
            method: 'get',
            path: '/applications'
        }, {
            method: 'get',
            path: '/applications/:appId'
        }, {
            method: 'put',
            path: '/applications/:appId'
        }, {
            method: 'delete',
            path: '/applications/:appId'
        }, {
            method: 'post',
            path: '/applications/:appId/data-keys'
        }, {
            method: 'get',
            path: '/applications/:appId/data-keys'
        }, {
            method: 'put',
            path: '/applications/:appId/data-keys/:dataKeyId/deactivate'
        }, {
            method: 'post',
            path: '/control-keys'
        }, {
            method: 'get',
            path: '/control-keys'
        }, {
            method: 'put',
            path: '/control-keys/:controlKeyId/deactivate'
        }];

        let isAllowed = false;
        for (const allowedRoute of allowedRoutes) {
            if (allowedRoute.method === event.httpMethod.toLowerCase() && match(event.path, allowedRoute.path)) {
                // is allowed to pass
                isAllowed = true;
                break;
            }
        }
        if (!isAllowed) {
            // if no match was found, we deny the request
            metrics.putMetric("AccessDenied", 1, "Count");
            return generatePolicy('user', 'Deny', methodArn);
        }

        const cookies = new Map<string, string>();
        headers.cookie.split(';').forEach((c) => {
            const splitCookie = c.trim().split('=');
            cookies.set(splitCookie[0], splitCookie[1]);
        })
        const token = cookies.get(`next-auth.session-token`);
        const decoded = await decode({token, secret: NEXTAUTH_SECRET});

        owner = decoded.email;
        appId = event.pathParameters.appId;
        messageId = event.pathParameters.messageId;

        if (appId) {
            const appRes = await ddb.get({
                TableName: APPS_TABLE,
                Key: {owner, sk: `app#${appId}`}
            }).promise();
            if (!appRes?.Item) {
                metrics.putMetric("AccessDenied", 1, "Count");
                return generatePolicy('user', 'Deny', methodArn);
            }

            if (messageId) {
                const messageRes = await ddb.get({
                    TableName: MESSAGES_TABLE,
                    Key: {appId, messageId}
                }).promise();
                if (messageRes?.Item?.owner !== owner) {
                    metrics.putMetric("AccessDenied", 1, "Count");
                    return generatePolicy('user', 'Deny', methodArn);
                }
            }
        }

        apiKey = CORE_API_KEY;
    } else {
        console.log('Unhandled auth path', headers);
        metrics.putMetric("AccessDenied", 1, "Count");
        return generatePolicy('user', 'Deny', methodArn);
    }

    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    metrics.putMetric("AccessGranted", 1, "Count");
    return generatePolicy('user', 'Allow', methodArn, apiKey, {owner, appId, messageId});
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
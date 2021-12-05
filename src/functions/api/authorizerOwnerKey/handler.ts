import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {metricScope} from "aws-embedded-metrics";
import {Owner} from "../../types";

const ddb = new DynamoDB.DocumentClient();

const {OWNERS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: any) => {
    const apiKey = event.authorizationToken;

    const items = (await ddb.query({
        TableName: OWNERS_TABLE,
        IndexName: 'apiKeyIndex',
        KeyConditionExpression: 'apiKey = :a',
        ExpressionAttributeValues: {
            ':a': apiKey
        },
        Limit: 1,
    }).promise()).Items;

    if (items.length !== 1) {
        metrics.putMetric("AccessDenied", 1, "Count");
        return generatePolicy('user', 'Deny', event.methodArn);
    }
    const owner: Owner = items[0] as Owner;
    console.log({owner});
    metrics.putMetric("AccessGranted", 1, "Count");
    metrics.setProperty("Owner", owner.owner);
    return generatePolicy('user', 'Allow', event.methodArn, {owner: owner.owner});
});

// Help function to generate an IAM policy
function generatePolicy(principalId, effect, resource, context?: any) {
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
    return authResponse;
}
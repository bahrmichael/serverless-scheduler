import 'source-map-support/register';
import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {APIGatewayProxyEventBase} from "aws-lambda";
import {metricScope} from "aws-embedded-metrics";

const ddb = new DynamoDB.DocumentClient();

const {APPLICATIONS_TABLE} = process.env;

export const main = metricScope(metrics => async (event: APIGatewayProxyEventBase<any>) => {

    const {pathParameters, requestContext} = event;
    const {owner} = requestContext.authorizer;
    const {appId} = pathParameters;

    await ddb.delete({
        TableName: APPLICATIONS_TABLE,
        Key: {owner, sk: `app#${appId}`}
    }).promise();
    ///////////////////////

    // todo: clean up usage plans and api keys behind the scenes

    metrics.setNamespace("DEV/ServerlessScheduler/DeleteApp");
    metrics.setProperty("Owner", owner);
    metrics.setProperty("App", appId);

    return {
        statusCode: 200,
        body: '',
    };
});
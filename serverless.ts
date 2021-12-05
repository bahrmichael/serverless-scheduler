import type {AWS} from '@serverless/typescript';

import {
    schedulePull,
    pullForOwner,
    ingestMessage,
    releaseMessage,
    authorizerOwnerKey, getOwnerConfig, postConfirmation,
} from './src/functions';

const serverlessConfiguration: AWS = {
    service: 'serverless-scheduler',
    frameworkVersion: '2',
    custom: {
        webpack: {
            webpackConfig: './webpack.config.js',
            includeModules: true
        }
    },
    plugins: ['serverless-webpack', 'serverless-iam-roles-per-function'],
    provider: {
        name: 'aws',
        runtime: 'nodejs14.x',
        stage: '${env:STAGE, "dev"}',
        apiGateway: {
            minimumCompressionSize: 1024,
            shouldStartNameWithService: true,
            apiKeys: ["API_KEY"],
        },
        environment: {
            AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        },
        lambdaHashingVersion: '20201221',
        tags: {
            project: 'serverless-scheduler-core',
        }
    },
    functions: {schedulePull, pullForOwner, ingestMessage, releaseMessage, authorizerOwnerKey, getOwnerConfig, postConfirmation},
    resources: {
        Resources: {
            ReleaseQueue: {
                Type: 'AWS::SQS::Queue',
                Properties: {
                    RedrivePolicy: {
                        deadLetterTargetArn: {'Fn::GetAtt': ['ReleaseDlq', 'Arn']},
                        // retry up to 5 times
                        maxReceiveCount: 5,
                    },
                    Tags: [{
                        Key: 'resource',
                        Value: 'serverless-scheduler-core-releaseQueue'
                    }]
                }
            },
            ReleaseDlq: {
                Type: 'AWS::SQS::Queue',
                Properties: {
                    Tags: [{
                        Key: 'resource',
                        Value: 'serverless-scheduler-core-releaseDLQ'
                    }]
                }
            },
            OwnersTable: {
                Type: 'AWS::DynamoDB::Table',
                Properties: {
                    BillingMode: 'PAY_PER_REQUEST',
                    KeySchema: [{
                        AttributeName: 'owner',
                        KeyType: 'HASH'
                    }, {
                        AttributeName: 'sk',
                        KeyType: 'RANGE'
                    }],
                    GlobalSecondaryIndexes: [{
                        IndexName: 'apiKeyIndex',
                        KeySchema: [{
                            AttributeName: 'apiKey',
                            KeyType: 'HASH'
                        }],
                        Projection: {
                            ProjectionType: 'ALL'
                        },
                    }],
                    AttributeDefinitions: [{
                        AttributeName: 'owner',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'sk',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'apiKey',
                        AttributeType: 'S'
                    }],
                    Tags: [{
                        Key: 'resource',
                        Value: 'serverless-scheduler-core-ownersTable'
                    }]
                }
            },
            MessagesTable: {
                Type: 'AWS::DynamoDB::Table',
                Properties: {
                    BillingMode: 'PAY_PER_REQUEST',
                    KeySchema: [{
                        AttributeName: 'owner',
                        KeyType: 'HASH'
                    }, {
                        AttributeName: 'id',
                        KeyType: 'RANGE'
                    }],
                    GlobalSecondaryIndexes: [{
                        IndexName: 'ownerStatusIndex',
                        KeySchema: [{
                            AttributeName: 'gsi1pk',
                            KeyType: 'HASH'
                        }, {
                            AttributeName: 'gsi1sk',
                            KeyType: 'RANGE'
                        }],
                        Projection: {
                            ProjectionType: 'ALL'
                        },
                    }],
                    AttributeDefinitions: [{
                        AttributeName: 'owner',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'id',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'gsi1pk',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'gsi1sk',
                        AttributeType: 'S'
                    }],
                    TimeToLiveSpecification: {
                        AttributeName: 'timeToLive',
                        Enabled: true,
                    },
                    Tags: [{
                        Key: 'resource',
                        Value: 'serverless-scheduler-core-messagesTable'
                    }]
                }
            },
            InsightOwners: {
                Type: "AWS::CloudWatch::InsightRule",
                Properties: {
                    RuleBody: '{ "AggregateOn": "Count", "Contribution": { "Filters": [ { "Match": "$.Owner", "IsPresent": true } ], "Keys": [ "$.Owner" ] }, "LogFormat": "JSON", "LogGroupNames": [ "/aws/lambda/serverless-scheduler*" ], "Schema": { "Name": "CloudWatchLogRule", "Version": 1 }}',
                    RuleName: "ServerlessSchedulerOwners-${opt:stage, 'dev'}",
                    RuleState: "ENABLED",
                    Tags: [{
                        Key: 'resource',
                        Value: 'serverless-scheduler-core-insightOwners'
                    }]
                }
            },
            UserPool: {
                Type : "AWS::Cognito::UserPool",
                Properties : {
                    Schema: [{
                        Name: 'name',
                        AttributeDataType: 'String',
                        Mutable: true,
                        Required: true,
                    }, {
                        Name: 'email',
                        AttributeDataType: 'String',
                        Mutable: false,
                        Required: true,
                    }],
                    LambdaConfig: {
                        PostConfirmation: {'Fn::GetAtt': ['PostConfirmationLambdaFunction', 'Arn']}
                    }
                }
            },
            UserPoolClient: {
                Type: "AWS::Cognito::UserPoolClient",
                Properties: {
                    GenerateSecret: true,
                    UserPoolId: {Ref: 'UserPool'},
                    SupportedIdentityProviders: ['COGNITO'],
                    CallbackURLs: ['https://literate-octo-disco.vercel.app/api/auth/callback/cognito'],
                    AllowedOAuthFlowsUserPoolClient: true,
                    AllowedOAuthFlows: ['code'],
                    AllowedOAuthScopes: ['email', 'openid', 'profile']
                }
            }
        }
    }
}

module.exports = serverlessConfiguration;

import type {AWS} from '@serverless/typescript';

import {
    authorizer, createAccessToken,
    createApiKey,
    createApp, deactivateAccessToken,
    deactivateApiKey, deleteApp,
    getApp, getMessage,
    ingestMessage, listAccessTokens,
    listApiKeys,
    listApps, listMessageLogs,
    listMessages,
    meterIngestRelease,
    pullForOwner,
    releaseMessage,
    schedulePull,
    updateApp,
} from './src/functions';

const serverlessConfiguration: AWS = {
    service: 'serverless-scheduler',
    frameworkVersion: '2',
    custom: {
        webpack: {
            webpackConfig: './webpack.config.js',
            includeModules: true
        },
        logRetentionInDays: 30
    },
    plugins: ['serverless-webpack', 'serverless-iam-roles-per-function', 'serverless-plugin-log-retention'],
    provider: {
        name: 'aws',
        runtime: 'nodejs14.x',
        stage: '${env:STAGE, "dev"}',
        apiGateway: {
            minimumCompressionSize: 1024,
            shouldStartNameWithService: true,
            apiKeys: ["API_KEY"],
            apiKeySourceType: 'AUTHORIZER'
        },
        environment: {
            AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        },
        lambdaHashingVersion: '20201221',
        tags: {
            project: 'serverless-scheduler-core',
        },
        logs: {
            restApi: true,
        }
    },
    functions: {
        schedulePull,
        pullForOwner,
        ingestMessage,
        releaseMessage,
        authorizer,
        getApp,
        listApps,
        createApp,
        deleteApp,
        updateApp,
        createApiKey,
        listApiKeys,
        deactivateApiKey,
        listMessages,
        meterIngestRelease,
        createAccessToken,
        listAccessTokens,
        deactivateAccessToken,
        listMessageLogs,
        getMessage,
    },
    resources: {
        extensions: {
            // https://forum.serverless.com/t/authorizers-cache/1127/6
            AuthorizerApiGatewayAuthorizer: {
                Properties: {
                    AuthorizerResultTtlInSeconds: 0
                }
            },
        },
        Resources: {
            MeteringTable: {
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
                    AttributeDefinitions: [{
                        AttributeName: 'owner',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'sk',
                        AttributeType: 'S'
                    }],
                    Tags: [{
                        Key: 'table',
                        Value: 'Metering'
                    }]
                }
            },
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
            ApplicationsTable: {
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
                    AttributeDefinitions: [{
                        AttributeName: 'owner',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'sk',
                        AttributeType: 'S'
                    }],
                    Tags: [{
                        Key: 'table',
                        Value: 'Applications'
                    }]
                }
            },
            ApiKeyTable: {
                Type: 'AWS::DynamoDB::Table',
                Properties: {
                    BillingMode: 'PAY_PER_REQUEST',
                    KeySchema: [{
                        AttributeName: 'pk',
                        KeyType: 'HASH'
                    }, {
                        AttributeName: 'apiKey',
                        KeyType: 'RANGE'
                    }],
                    GlobalSecondaryIndexes: [{
                        IndexName: 'apiKeyIdIndex',
                        KeySchema: [{
                            AttributeName: 'id',
                            KeyType: 'HASH'
                        }],
                        Projection: {
                            ProjectionType: 'ALL'
                        },
                    }],
                    AttributeDefinitions: [{
                        AttributeName: 'pk',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'apiKey',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'id',
                        AttributeType: 'S'
                    }],
                    Tags: [{
                        Key: 'table',
                        Value: 'ApiKeys'
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
            MessageLogsTable: {
                Type: 'AWS::DynamoDB::Table',
                Properties: {
                    BillingMode: 'PAY_PER_REQUEST',
                    KeySchema: [{
                        AttributeName: 'messageId',
                        KeyType: 'HASH'
                    }, {
                        AttributeName: 'timestamp',
                        KeyType: 'RANGE'
                    }],

                    AttributeDefinitions: [{
                        AttributeName: 'messageId',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'timestamp',
                        AttributeType: 'S'
                    }],
                    Tags: [{
                        Key: 'Table',
                        Value: 'MessageLogsTable'
                    }],
                }

            },
            MessagesTable: {
                Type: 'AWS::DynamoDB::Table',
                Properties: {
                    BillingMode: 'PAY_PER_REQUEST',
                    KeySchema: [{
                        AttributeName: 'appId',
                        KeyType: 'HASH'
                    }, {
                        AttributeName: 'messageId',
                        KeyType: 'RANGE'
                    }],
                    GlobalSecondaryIndexes: [{
                        IndexName: 'appStatusIndex',
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
                        AttributeName: 'appId',
                        AttributeType: 'S'
                    }, {
                        AttributeName: 'messageId',
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
                    }],
                    StreamSpecification: {
                        StreamViewType: 'NEW_IMAGE'
                    },
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
            MyApiGatewayAuthorizer: {
                Type: 'AWS::ApiGateway::Authorizer',
                Properties: {
                    AuthorizerResultTtlInSeconds: 10,
                    IdentitySource: 'method.request.header.Authorization',
                    Name: 'CognitoAuthorizer',
                    RestApiId: {Ref: 'ApiGatewayRestApi'},
                    Type: 'COGNITO_USER_POOLS',
                    ProviderARNs: [{"Fn::Join": ["", ["arn:aws:cognito-idp:", {Ref: "AWS::Region"}, ":", {Ref: "AWS::AccountId"}, ":userpool/", {Ref: 'UserPool'}]]}]
                }
            },
            UserPool: {
                Type : "AWS::Cognito::UserPool",
                Properties : {
                    Schema: [{
                        Name: 'email',
                        AttributeDataType: 'String',
                        Mutable: false,
                        Required: true,
                    }],
                    UsernameConfiguration: { CaseSensitive: false },
                    // The attributes to be auto-verified. (This starts the verification flow automatically. It does not just verify them without user consent.)
                    AutoVerifiedAttributes: ['email'],
                    VerificationMessageTemplate: {
                        DefaultEmailOption: 'CONFIRM_WITH_CODE'
                    },
                    EmailConfiguration: {
                        EmailSendingAccount: 'COGNITO_DEFAULT'
                    }

                }
            },
            UserPoolClient: {
                Type: "AWS::Cognito::UserPoolClient",
                Properties: {
                    GenerateSecret: false,
                    UserPoolId: {Ref: 'UserPool'},
                    SupportedIdentityProviders: ['COGNITO'],
                    CallbackURLs: ['https://literate-octo-disco.vercel.app/api/auth/callback/cognito'],
                    AllowedOAuthFlowsUserPoolClient: true,
                    AllowedOAuthFlows: ['code'],
                    AllowedOAuthScopes: ['email', 'openid', 'profile']
                }
            },
            UserPoolClientDomain: {
                Type: 'AWS::Cognito::UserPoolDomain',
                Properties: {
                    Domain: 'serverless-scheduler-${env:STAGE, "dev"}',
                    UserPoolId: {Ref: 'UserPool'},
                }
            },
            IdentityPool: {
                Type: "AWS::Cognito::IdentityPool",
                Properties: {
                    AllowUnauthenticatedIdentities: false,
                    CognitoIdentityProviders: [{
                        ClientId: {Ref: 'UserPoolClient'},
                        ProviderName: {'Fn::GetAtt': ['UserPool', 'ProviderName']},
                        ServerSideTokenCheck: true,
                    }]
                }
            },
            IdentityPoolRoles: {
                Type: "AWS::Cognito::IdentityPoolRoleAttachment",
                Properties: {
                    IdentityPoolId: {Ref: 'IdentityPool'},
                    Roles: {
                        authenticated: {'Fn::GetAtt': ['CognitoAuthRole', 'Arn']},
                        unauthenticated: {'Fn::GetAtt': ['CognitoUnauthRole', 'Arn']}
                    }
                }
            },
            CognitoAuthRole: {
                Type: "AWS::IAM::Role",
                Properties: {
                    AssumeRolePolicyDocument: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: 'Allow',
                            Principal: {
                                Federated: 'cognito-identity.amazonaws.com'
                            },
                            Action: ['sts:AssumeRoleWithWebIdentity'],
                            Condition: {
                                StringEquals: {
                                    'cognito-identity.amazonaws.com:aud': {Ref: 'IdentityPool'},
                                },
                                'ForAnyValue:StringLike': {
                                    'cognito-identity.amazonaws.com:amr': 'authenticated',
                                }
                            }
                        }]
                    },
                    Policies: [{
                        PolicyName: 'CognitoAuthorizerPolicy',
                        PolicyDocument: {
                            Version: "2012-10-17",
                            Statement: [{
                                Effect: 'Allow',
                                Action: ['mobileanalytics:PutEvents', 'cognito-sync:*', 'cognito-identity:*'],
                                Resource: '*'
                            },{
                                Effect: 'Allow',
                                Action: ['execute-api:Invoke'],
                                Resource: '*'
                            }]
                        }
                    }]
                }
            },
            CognitoUnauthRole: {
                Type: "AWS::IAM::Role",
                Properties: {
                    AssumeRolePolicyDocument: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: 'Allow',
                            Principal: {
                                Federated: 'cognito-identity.amazonaws.com'
                            },
                            Action: ['sts:AssumeRoleWithWebIdentity'],
                            Condition: {
                                StringEquals: {
                                    'cognito-identity.amazonaws.com:aud': {Ref: 'IdentityPool'},
                                },
                                'ForAnyValue:StringLike': {
                                    'cognito-identity.amazonaws.com:amr': 'unauthenticated',
                                }
                            }
                        }]
                    },
                    Policies: [{
                        PolicyName: 'CognitoAuthorizerPolicy',
                        PolicyDocument: {
                            Version: "2012-10-17",
                            Statement: [{
                                Effect: 'Allow',
                                Action: ['mobileanalytics:PutEvents', 'cognito-sync:*', 'cognito-identity:*'],
                                Resource: '*'
                            }]
                        }
                    }]
                }
            }

        }
    }
}

module.exports = serverlessConfiguration;

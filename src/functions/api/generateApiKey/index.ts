export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'PUT',
      path: '/owner/apiKey',
      authorizer: {
        type: 'COGNITO_USER_POOLS',
        authorizerId: { Ref: 'MyApiGatewayAuthorizer' },
      },
      cors: true,
    }
  }],
  environment: {
    OWNERS_TABLE: {Ref: 'OwnersTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:UpdateItem'],
      Resource: {'Fn::GetAtt': ['OwnersTable', 'Arn']}
    },
  ],
  tags: {
    resource: 'serverless-scheduler-api-generateApiKey',
  },
}

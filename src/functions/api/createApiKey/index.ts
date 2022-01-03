export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'POST',
      path: '/applications/{appId}/api-keys',
      authorizer: {
        name: 'authorizerOwnerKey',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }],
  environment: {
    API_KEY_TABLE: {Ref: 'ApiKeyTable'},
    APPLICATIONS_TABLE: {Ref: 'ApplicationsTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: {'Fn::GetAtt': ['ApplicationsTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem'],
      Resource: {'Fn::GetAtt': ['ApiKeyTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['apigateway:POST'],
      Resource: ['arn:aws:apigateway:us-east-1::/apikeys', 'arn:aws:apigateway:us-east-1::/usageplans/*/keys']
    }
  ],
  tags: {
    function: 'createApiKey',
  },
}

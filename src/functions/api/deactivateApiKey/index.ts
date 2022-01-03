export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'PUT',
      path: '/applications/{appId}/api-keys/{apiKeyId}/deactivate',
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
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:UpdateItem'],
      Resource: {'Fn::GetAtt': ['ApiKeyTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:Query'],
      Resource: {'Fn::Join': [ '/', [{ 'Fn::GetAtt': ['ApiKeyTable', 'Arn' ] }, 'index', 'apiKeyIdIndex' ]]}
    },
  ],
  tags: {
    function: 'deactivateApiKey',
  },
}

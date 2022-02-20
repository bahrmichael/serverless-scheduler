export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'PUT',
      path: '/applications/{appId}/api-keys/{dataKeyId}/deactivate',
      authorizer: {
        name: 'authorizer',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }, {
    http: {
      method: 'PUT',
      path: '/applications/{appId}/data-keys/{dataKeyId}/deactivate',
      authorizer: {
        name: 'authorizer',
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
    function: 'deactivateDataKey',
  },
}

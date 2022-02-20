export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'GET',
      path: '/applications/{appId}/data-keys',
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
      Action: ['dynamodb:Query'],
      Resource: {'Fn::GetAtt': ['ApiKeyTable', 'Arn']}
    },
  ],
  tags: {
    function: 'listDataKeys',
  },
}

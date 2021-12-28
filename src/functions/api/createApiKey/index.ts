export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'POST',
      path: '/applications/{appId}/apiKey',
      private: true,
    }
  }],
  environment: {
    API_KEYS_TABLE: {Ref: 'ApiKeyTable'},
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
  ],
  tags: {
    function: 'createApiKey',
  },
}

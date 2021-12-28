export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'POST',
      path: '/applications/{appId}/api-key',
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
  ],
  tags: {
    function: 'createApiKey',
  },
}

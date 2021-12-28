export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'PUT',
      path: '/applications',
      private: true,
    }
  }],
  environment: {
    OWNERS_TABLE: {Ref: 'OwnersTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem'],
      Resource: {'Fn::GetAtt': ['OwnersTable', 'Arn']}
    },
  ],
  tags: {
    function: 'createApp',
  },
}

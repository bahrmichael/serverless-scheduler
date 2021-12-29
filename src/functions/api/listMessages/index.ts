export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'GET',
      path: '/applications/{appId}/messages',
      private: true,
    }
  }],
  environment: {
    MESSAGES_TABLE: {Ref: 'MessagesTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:Query'],
      Resource: {'Fn::GetAtt': ['MessagesTable', 'Arn']}
    },
  ],
  tags: {
    function: 'listMessages',
  },
}

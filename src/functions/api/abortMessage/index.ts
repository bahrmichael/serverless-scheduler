export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'PUT',
      path: '/applications/{appId}/messages/{messageId}/abort',
      private: true,
    }
  }],
  environment: {
    MESSAGES_TABLE: {Ref: 'MessagesTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:UpdateItem'],
      Resource: {'Fn::GetAtt': ['MessagesTable', 'Arn']}
    },
  ],
  tags: {
    function: 'abortMessage',
  },
}
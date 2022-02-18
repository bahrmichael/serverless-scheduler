export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'PUT',
      path: '/messages/{messageId}/abort',
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
      path: '/applications/{appId}/messages/{messageId}/abort',
      authorizer: {
        name: 'authorizer',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }],
  environment: {
    MESSAGES_TABLE: {Ref: 'MessagesTable'},
    MESSAGE_LOGS_TABLE: {Ref: 'MessageLogsTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:UpdateItem'],
      Resource: {'Fn::GetAtt': ['MessagesTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem'],
      Resource: {'Fn::GetAtt': ['MessageLogsTable', 'Arn']}
    },
  ],
  tags: {
    function: 'abortMessage',
  },
}

export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'GET',
      path: '/messages/{messageId}/logs',
      authorizer: {
        name: 'authorizer',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }, {
    http: {
      method: 'GET',
      path: '/applications/{appId}/messages/{messageId}/logs',
      authorizer: {
        name: 'authorizer',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }],
  environment: {
    MESSAGE_LOGS_TABLE: {Ref: 'MessageLogsTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:Query'],
      Resource: {'Fn::GetAtt': ['MessageLogsTable', 'Arn']}
    },
  ],
  tags: {
    function: 'listMessagesLogs',
  },
}

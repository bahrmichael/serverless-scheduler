export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'POST',
      path: '/message',
      // We combine the authorizer and a private API. The authorizer yields the internal api key mapping to the
      // one we vended out to the customer.
      authorizer: {
        name: 'authorizer',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }, {
    http: {
      method: 'POST',
      path: '/messages',
      // We combine the authorizer and a private API. The authorizer yields the internal api key mapping to the
      // one we vended out to the customer.
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
    QUEUE_URL: {Ref: 'ReleaseQueue'},
    MESSAGE_LOGS_TABLE: {Ref: 'MessageLogsTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem'],
      Resource: {'Fn::GetAtt': ['MessageLogsTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem'],
      Resource: {'Fn::GetAtt': ['MessagesTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['sqs:SendMessage'],
      Resource: {'Fn::GetAtt': ['ReleaseQueue', 'Arn']}
    },
  ],
  tags: {
    function: 'ingestMessage',
  },
}

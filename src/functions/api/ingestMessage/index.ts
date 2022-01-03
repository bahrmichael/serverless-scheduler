export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'POST',
      path: '/message',
      // We combine the authorizer and a private API. The authorizer yields the internal api key mapping to the
      // one we vended out to the customer.
      authorizer: {
        name: 'authorizerOwnerKey',
        identitySource: ['method.request.header.Authorization', 'method.request.header.owner', 'method.request.header.appId'],
        type: 'request'
      },
      private: true,
    }
  }],
  environment: {
    MESSAGES_TABLE: {Ref: 'MessagesTable'},
    QUEUE_URL: {Ref: 'ReleaseQueue'},
  },
  iamRoleStatements: [
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

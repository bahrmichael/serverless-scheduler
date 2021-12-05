export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'POST',
      path: '/event',
      authorizer: 'authorizerOwnerKey',
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
    resource: 'serverless-scheduler-core-ingest',
  },
}

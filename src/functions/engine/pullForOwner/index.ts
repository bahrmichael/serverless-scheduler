export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  environment: {
    MESSAGES_TABLE: {Ref: 'MessagesTable'},
    QUEUE_URL: {Ref: 'ReleaseQueue'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:UpdateItem'],
      Resource: {'Fn::GetAtt': ['MessagesTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:Query', 'dynamodb:UpdateItem'],
      Resource: {'Fn::Join': [ '/', [{ 'Fn::GetAtt': ['MessagesTable', 'Arn' ] }, 'index', 'appStatusIndex' ]]}
    },
    {
      Effect: 'Allow',
      Action: ['sqs:SendMessage'],
      Resource: {'Fn::GetAtt': ['ReleaseQueue', 'Arn']}
    },
  ],
  timeout: 60,
  tags: {
    function: 'pullForOwner',
  }
}

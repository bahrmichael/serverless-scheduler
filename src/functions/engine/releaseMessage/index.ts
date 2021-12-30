export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    sqs: {
      arn: {'Fn::GetAtt': ['ReleaseQueue', 'Arn']},
      batchSize: 1,
    }
  }],
  environment: {
    MESSAGES_TABLE: {Ref: 'MessagesTable'},
    APPLICATIONS_TABLE: {Ref: 'ApplicationsTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:UpdateItem', 'dynamodb:GetItem', 'dynamodb:PutItem'],
      Resource: {'Fn::GetAtt': ['MessagesTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: {'Fn::GetAtt': ['ApplicationsTable', 'Arn']}
    },
  ],
  timeout: 30,
  tags: {
    function: 'releaseMessage',
  }
}

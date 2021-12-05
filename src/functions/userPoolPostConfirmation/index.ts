export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
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
    resource: 'serverless-scheduler-cognito-postConfirmation',
  },
}

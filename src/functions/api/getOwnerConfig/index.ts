export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'GET',
      path: '/owner/config',
      authorizer: 'aws_iam',
    }
  }],
  environment: {
    OWNERS_TABLE: {Ref: 'OwnersTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: {'Fn::GetAtt': ['OwnersTable', 'Arn']}
    },
  ],
  tags: {
    resource: 'serverless-scheduler-api-getOwnerConfig',
  },
}

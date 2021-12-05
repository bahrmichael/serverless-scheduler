export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [
    {
      schedule: 'cron(* * * * ? *)'
    }
  ],
  environment: {
    OWNERS_TABLE: {Ref: 'OwnersTable'},
    PULL_FUNCTION_ARN: {'Fn::GetAtt': ['PullForOwnerLambdaFunction', 'Arn']},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:Scan'],
      Resource: {'Fn::GetAtt': ['OwnersTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['lambda:InvokeFunction'],
      Resource: {'Fn::GetAtt': ['PullForOwnerLambdaFunction', 'Arn']},
    },
  ],
  timeout: 60,
  tags: {
    resource: 'serverless-scheduler-core-schedule',
  }
}

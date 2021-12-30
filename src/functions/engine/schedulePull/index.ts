export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [
    {
      schedule: 'cron(* * * * ? *)'
    }
  ],
  environment: {
    APPLICATIONS_TABLE: {Ref: 'ApplicationsTable'},
    PULL_FUNCTION_ARN: {'Fn::GetAtt': ['PullForOwnerLambdaFunction', 'Arn']},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:Scan'],
      Resource: {'Fn::GetAtt': ['ApplicationsTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['lambda:InvokeFunction'],
      Resource: {'Fn::GetAtt': ['PullForOwnerLambdaFunction', 'Arn']},
    },
  ],
  timeout: 60,
  tags: {
    function: 'schedulePull',
  }
}

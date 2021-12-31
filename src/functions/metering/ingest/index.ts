export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [
    {
      cloudwatchLog: {
        logGroup: '/aws/lambda/serverless-scheduler-${env:STAGE, "dev"}-ingestMessage',
        filter: '{$._aws EXISTS}'
      }
    }
  ],
  environment: {
    METERING_TABLE: {Ref: 'MeteringTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:UpdateItem'],
      Resource: {'Fn::GetAtt': ['MeteringTable', 'Arn']}
    },
  ],
  tags: {
    function: 'meterIngestion',
  }
}

export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [
    {
      stream: {
        type: 'dynamodb',
        arn: {'Fn::GetAtt': ['MessagesTable', 'StreamArn']},
        // Don't retry on failures. We don't want to charge customers for our errors.
        maximumRetryAttempts: 0,
        batchSize: 100,
        batchWindow: 60,
        filterPatterns: [{
          eventName: ['INSERT'],
        }, {
          eventName: ['UPDATE'],
          dynamodb: {
            NewImage: {
              status: {
                'S': ['SENT']
              }
            }
          }
        }]
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

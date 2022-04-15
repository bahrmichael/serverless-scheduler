export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [
    {
      sns: "arn:aws:sns:us-east-1:287250355862:aws-mp-subscription-notification-6yoztrl1zd0h0ksowm8ndrdt9"
    },
  ],
  environment: {
    // TOPIC: {Ref: 'Topic'},
    TABLE: {Ref: 'OwnersTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:UpdateItem'],
      Resource: {'Fn::GetAtt': ['OwnersTable', 'Arn']}
    },
    // {
    //   Effect: 'Allow',
    //   Action: ['sns:Publish'],
    //   Resource: {Ref: 'Topic'}
    // },
  ]
};

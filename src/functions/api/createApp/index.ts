export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'PUT',
      path: '/applications',
      private: true,
    }
  }],
  environment: {
    APPLICATIONS_TABLE: {Ref: 'ApplicationsTable'},
    API_GATEWAY_ID: {Ref: 'ApiGatewayRestApi'}
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem'],
      Resource: {'Fn::GetAtt': ['ApplicationsTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['apigateway:POST'],
      Resource: ['arn:aws:apigateway:us-east-1::/usageplans']
    }
  ],
  tags: {
    function: 'createApp',
  },
}

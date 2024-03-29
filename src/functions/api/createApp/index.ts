export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'POST',
      path: '/applications',
      authorizer: {
        name: 'authorizer',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }],
  environment: {
    APPLICATIONS_TABLE: {Ref: 'ApplicationsTable'},
    API_ID: {Ref: 'ApiGatewayRestApi'},
    STAGE: '${env:STAGE, "dev"}',
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
    },
    {
      Effect: 'Allow',
      Action: ['apigateway:PATCH'],
      Resource: ['arn:aws:apigateway:us-east-1::/usageplans/*']
    },
  ],
  tags: {
    function: 'createApp',
  },
  timeout: 10,
}

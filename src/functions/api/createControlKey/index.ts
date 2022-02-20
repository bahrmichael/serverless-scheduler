export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'POST',
      path: '/control-keys',
      authorizer: {
        name: 'authorizer',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }],
  environment: {
    CONTROL_KEY_TABLE: {Ref: 'ControlKeyTable'},
    API_ID: {Ref: 'ApiGatewayRestApi'},
    STAGE: '${env:STAGE, "dev"}',
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:PutItem'],
      Resource: {'Fn::GetAtt': ['ControlKeyTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['apigateway:POST'],
      Resource: ['arn:aws:apigateway:us-east-1::/usageplans', 'arn:aws:apigateway:us-east-1::/apikeys', 'arn:aws:apigateway:us-east-1::/usageplans/*/keys']
    },
    {
      Effect: 'Allow',
      Action: ['apigateway:PATCH'],
      Resource: ['arn:aws:apigateway:us-east-1::/usageplans/*']
    },
  ],
  tags: {
    function: 'createControlKey',
  },
  timeout: 10,
}

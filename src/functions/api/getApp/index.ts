export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'GET',
      path: '/applications/{appId}',
      authorizer: {
        name: 'authorizerOwnerKey',
        identitySource: 'method.request.header.Authorization',
        type: 'request'
      },
      private: true,
    }
  }],
  environment: {
    APPLICATIONS_TABLE: {Ref: 'ApplicationsTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: {'Fn::GetAtt': ['ApplicationsTable', 'Arn']}
    },
  ],
  tags: {
    function: 'getApp',
  },
}

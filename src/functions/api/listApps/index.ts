export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'GET',
      path: '/applications',
      authorizer: {
        name: 'authorizerOwnerKey',
        identitySource: ['method.request.header.Authorization', 'method.request.header.owner', 'method.request.header.appId'],
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
      Action: ['dynamodb:Query'],
      Resource: {'Fn::GetAtt': ['ApplicationsTable', 'Arn']}
    },
  ],
  tags: {
    function: 'listApps',
  },
}

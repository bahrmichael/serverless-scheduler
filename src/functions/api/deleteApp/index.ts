export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'DELETE',
      path: '/applications/{appId}',
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
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:DeleteItem'],
      Resource: {'Fn::GetAtt': ['ApplicationsTable', 'Arn']}
    },
  ],
  tags: {
    function: 'deleteApp',
  },
}

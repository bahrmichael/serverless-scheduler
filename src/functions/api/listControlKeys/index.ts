export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'GET',
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
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:Query'],
      Resource: {'Fn::Join': [ '/', [{ 'Fn::GetAtt': ['ControlKeyTable', 'Arn' ] }, 'index', 'ownerIndex' ]]}
    },
  ],
  tags: {
    function: 'listControlKeys',
  },
}

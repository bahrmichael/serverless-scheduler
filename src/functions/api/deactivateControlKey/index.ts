export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  events: [{
    http: {
      method: 'PUT',
      path: '/control-keys/{controlKeyId}/deactivate',
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
      Action: ['dynamodb:UpdateItem'],
      Resource: {'Fn::GetAtt': ['ControlKeyTable', 'Arn']}
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:Query'],
      Resource: {'Fn::Join': [ '/', [{ 'Fn::GetAtt': ['ControlKeyTable', 'Arn' ] }, 'index', 'idIndex' ]]}
    },
  ],
  tags: {
    function: 'deactivateControlKey',
  },
}

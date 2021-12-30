export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  environment: {
    OWNERS_TABLE: {Ref: 'OwnersTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:Query'],
      Resource: {'Fn::Join': [ '/', [{ 'Fn::GetAtt': ['OwnersTable', 'Arn' ] }, 'index', 'apiKeyIndex' ]]}
    },
  ],
  tags: {
    function: 'authorizeOwnerKey'
  }
}

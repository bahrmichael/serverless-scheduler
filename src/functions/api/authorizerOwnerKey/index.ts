export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  environment: {
    API_KEY_TABLE: {Ref: 'ApiKeyTable'},
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: { 'Fn::GetAtt': ['ApiKeyTable', 'Arn' ] },
    },
  ],
  tags: {
    function: 'authorizeOwnerKey'
  }
}

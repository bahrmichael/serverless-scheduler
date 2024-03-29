export default {
  handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
  environment: {
    CONTROL_KEY_TABLE: {Ref: 'ControlKeyTable'},
    API_KEY_TABLE: {Ref: 'ApiKeyTable'},
    MESSAGES_TABLE: {Ref: 'MessagesTable'},
    APPS_TABLE: {Ref: 'ApplicationsTable'},
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    CORE_API_KEY: process.env.CORE_API_KEY,
  },
  iamRoleStatements: [
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: { 'Fn::GetAtt': ['ControlKeyTable', 'Arn' ] },
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: { 'Fn::GetAtt': ['ApiKeyTable', 'Arn' ] },
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: { 'Fn::GetAtt': ['MessagesTable', 'Arn' ] },
    },
    {
      Effect: 'Allow',
      Action: ['dynamodb:GetItem'],
      Resource: { 'Fn::GetAtt': ['ApplicationsTable', 'Arn' ] },
    },
  ],
  tags: {
    function: 'authorizer'
  }
}

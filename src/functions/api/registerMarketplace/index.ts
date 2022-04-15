export default {
    handler: `${__dirname.split(process.cwd())[1].substring(1)}/handler.main`,
    events: [
        {
            http: {
                method: 'post',
                path: 'register-marketplace',
            },
        },
    ],
    environment: {
        TABLE: {Ref: 'OwnersTable'},
    },
    iamRoleStatements: [
        {
            Effect: 'Allow',
            Action: ['dynamodb:PutItem'],
            Resource: {'Fn::GetAtt': ['OwnersTable', 'Arn']}
        },
        {
            Effect: 'Allow',
            Action: ['aws-marketplace:ResolveCustomer'],
            Resource: "*"
        },
    ]
};

# Serverless Scheduler

If you are new to this project and problem domain, I recommend reading the companion article (https://bahr.dev/2022/01/06/point-in-time-scheduler/)
and the articles that it links to.

This project is the result of me writing 4 previous blog posts, at least 5 other posts on ad-hoc scheduling from the serverless
community, and more than 5 years of waiting on AWS to offer a solution for ad-hoc scheduling. They finally released such a solution
in November 2022 with the EventBridge Scheduler. There are additional repositories from previous experiments at https://github.com/bahrmichael/aws-scheduler and https://github.com/bahrmichael/aws-scheduler-testing,


This is the core of the scheduler project. You can find the frontend at https://github.com/bahrmichael/serverless-scheduler-app
and additional documentation at https://github.com/bahrmichael/point-in-time-scheduler.

## State of this Repository

Please consider the code in this repository as a working prototype for market validation. The authorization with NextAuth, API Keys, and Cognito
works, but it needs some work to clean up the code and the various authorization paths.

## Project Structure

This project consists of the Infrastructure as Code in the `serverless.ts` file, various CRUDL APIs and the authorizer in the
`/functions/api` folder, the heart of the project in `/functions/engine` and some rudimentary metering in `/functions/metering`.
The project uses API Gateway's usage plans feature to eventually support metering and billing through AWS marketplace.

## API Specs

You can find a swagger dashboard at https://app.swaggerhub.com/apis/bahrmichael/Scheduler/0.1.0. Replace the current URL there
with https://k5v6qjp3ha.execute-api.us-east-1.amazonaws.com/dev.

## SDK

I made an attempt at building an SDK, but it turned out a bit more difficult than expected, so it moved down the priority list.

You can still check it out at https://www.npmjs.com/package/point-in-time-scheduler.

## Demo Instance

Instead of deploying this yourself, you can use https://serverless-scheduler-app-one.vercel.app (frontend) and https://k5v6qjp3ha.execute-api.us-east-1.amazonaws.com/dev (backend API).

I removed social logins to get the demo instance working, you can just click through the login without providing credentials.

## Deployment

Due to the frontend and login features, the initial deployment is a multi-step process.

Run `npm i` to install the packages. Yarn doesn't work right now due to package conflicts.

To start the deployment, you need to come up with a `NEXTAUTH_SECRET`. Set it as an environment variable as shown below,
with an AWS profile of your choice (or omit if credentials are present via environment variables):

```
NEXTAUTH_SECRET=secret AWS_PROFILE=<YOUR-PROFILE> npm run deploy
```

Wait for this to complete, and note the deployment URL. You will need it again for the frontend deployment as `CORE_API_URL`.

Once this deployment is complete, you will need to do some click ops to generate an API key for the frontend. All requests
are secured through tenant-scoped api keys and usage plans, except for the frontend which currently uses a shared api key and usage plan.

1. Go to the API Gateway service, and make sure that the API for the scheduler has been deployed.
2. In the setting of the API Gateway service create a new API key and give it a name like "serverless scheduler frontend". Copy the key into a safe place.
3. Create a usage plan where you associate the api key and the deployed stage of the api.

Now redeploy the backend service with the api key as the `CORE_API_KEY` environment variable:

```
CORE_API_KEY=my-core-api-key NEXTAUTH_SECRET=secret AWS_PROFILE=<YOUR-PROFILE> npm run deploy
```

You can now go ahead and deploy the frontend. Once you have a Vercel project domain, come back to this repository,
and replace the domain from `CallbackURLs: ['https://serverless-scheduler-app-one.vercel.app/api/auth/callback/cognito']`  
in `serverless.ts` with your domain.

Deploy the backend service again, and now everything should work nicely together:

```
CORE_API_KEY=my-core-api-key NEXTAUTH_SECRET=secret AWS_PROFILE=<YOUR-PROFILE> npm run deploy
```

## Testing

I decided against tests during the prototyping phase. After that I went straight ahead to [canary-like e2e tests](https://github.com/bahrmichael/point-in-time-scheduler-e2e-api), 
because some code paths are only accessed if there are delays of more than 15 minutes. That felt like too much for
a test suite which is part of the deployment process.

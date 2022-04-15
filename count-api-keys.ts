import * as ApiGateway from 'aws-sdk/clients/apigateway';
const apigw = new ApiGateway({region: 'us-east-1'});

const getPaginatedResults = async (fn) => {
    const EMPTY = Symbol("empty");
    const res = [];
    for await (const lf of (async function*() {
        let NextMarker = EMPTY;
        while (NextMarker || NextMarker === EMPTY) {
            const {marker, results} = await fn(NextMarker !== EMPTY ? NextMarker : undefined);

            yield* results;
            NextMarker = marker;
        }
    })()) {
        res.push(lf);
    }

    return res;
};

async function runMe() {

    const apiKeys = await getPaginatedResults(async (position) => {
        const keys = await apigw.getApiKeys({position}).promise();
        return {
            marker: keys.position,
            results: keys.items,
        }
    });

    console.log('Api keys', apiKeys.length);

    const usagePlans = await getPaginatedResults(async (position) => {
        const plans = await apigw.getUsagePlans({position}).promise();
        return {
            marker: plans.position,
            results: plans.items,
        }
    })

    console.log('Usage plans', usagePlans.length);
}

runMe().catch(console.error);
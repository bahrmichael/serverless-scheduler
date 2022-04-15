import {DynamoDB, MarketplaceMetering} from "aws-sdk";
const metering = new MarketplaceMetering();
const ddb = new DynamoDB.DocumentClient();

const {TABLE} = process.env;

export const main = async (event) => {

  const {
    token, email,
  } = event.body;

  if (token && email) {

    // Call resolveCustomer to validate the subscriber
    const resolveCustomerParams = {
      RegistrationToken: token,
    };

    const resolveCustomerResponse = await metering
        .resolveCustomer(resolveCustomerParams)
        .promise();

    // Store new subscriber data
    const { CustomerIdentifier: customerIdentifier, ProductCode: productCode } = resolveCustomerResponse;

    await ddb.put({
      TableName: TABLE,
      Item: {
        email,
        customerIdentifier,
        productCode,
        created: new Date().toISOString(),
      }
    }).promise();

    return {
      statusCode: 200,
      body: 'success',
    }


  } else {
    return {
      statusCode: 400,
      body: 'invalid_request',
    }
  }
};
import { APIGatewaySimpleAuthorizerResult } from "aws-lambda";

export const handler = async (): Promise<APIGatewaySimpleAuthorizerResult> => {
  return {
    isAuthorized: true,
    // keep context minimal; V2 types don't include routeArn in simple response
    context: { user: "mock" },
  } as unknown as APIGatewaySimpleAuthorizerResult;
};

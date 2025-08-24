import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  // $connect and $disconnect land here
  console.log(
    "routeKey:",
    event.requestContext.routeKey,
    "connectionId:",
    event.requestContext.connectionId,
  );
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Connected" }),
  };
};

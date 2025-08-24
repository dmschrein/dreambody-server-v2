import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

const mgmt = () =>
  new ApiGatewayManagementApi({
    endpoint: process.env.WS_POST_ENDPOINT || process.env.callbackUrl,
  });

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  const connectionId = event.requestContext.connectionId!;

  let message: unknown = "echo";
  try {
    if (event.body) {
      const parsed = JSON.parse(event.body);
      message = (parsed && parsed.message) ?? message;
    }
  } catch {
    console.error("Error parsing message", event.body);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Error parsing message" }),
    };
  }

  try {
    await mgmt().postToConnection({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify({ type: "echo", message })),
    });
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error sending echo" }),
    };
  }
  return { statusCode: 200, body: JSON.stringify({ message: "Echo sent" }) };
};

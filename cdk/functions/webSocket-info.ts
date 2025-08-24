import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

const mgmt = () =>
  new ApiGatewayManagementApi({
    endpoint: process.env.WS_POST_ENDPOINT || process.env.callbackUrl,
  });

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  const connectionId = event.requestContext.connectionId!;
  // reply to the same connectionId
  const data = { type: "info", connectionId };

  try {
    await mgmt().postToConnection({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data)),
    });
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error sending info" }),
    };
  }
  return { statusCode: 200, body: JSON.stringify({ message: "Info sent" }) };
};

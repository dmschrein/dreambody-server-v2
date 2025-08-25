import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const busName = process.env.RESPONSE_BUS_NAME!;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const connectionId: string = body.connectionId;
    const requestId: string = body.requestId ?? event.requestContext.requestId;
    const input = body.input ?? null;

    if (!connectionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "connectionId required" }),
      };
    }

    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Source: "dreambody.invoke",
            DetailType: "ResponseReady",
            Detail: JSON.stringify({
              connectionId,
              requestId,
              input,
              text: "Hello from Slice B",
            }),
          },
        ],
      })
    );

    return {
      statusCode: 202,
      body: JSON.stringify({ accepted: true, requestId }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal error" }),
    };
  }
};

//cdk/eventbridge-respond-lambda.ts
import middy from "@middy/core";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { EventBridgeEvent } from "aws-lambda";
import { setLoggingLevel } from "../utils/logging";

const serviceName = process.env.serviceName;
const tracer = new Tracer({ serviceName: serviceName });
const logger = new Logger({ serviceName: serviceName });
const metrics = new Metrics({
  namespace: "dreambody-v2",
  serviceName: serviceName,
});

export const functionHandler = async (
  event: EventBridgeEvent<
    "bedrockResponded",
    {
      connectionId: string;
      response: object;
    }
  >,
): Promise<void> => {
  setLoggingLevel(logger);

  const connectionId = event.detail.connectionId;
  const response = event.detail.response;
  const callbackUrl = process.env.callbackUrl;
  const client = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

  const command = new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify({
      response: response,
    }),
  });

  logger.setCorrelationId(connectionId);

  await client.send(command);
};

export const handler = middy(functionHandler)
  .use(logMetrics(metrics))
  .use(injectLambdaContext(logger, { logEvent: false }))
  .use(captureLambdaHandler(tracer, { captureResponse: false }));

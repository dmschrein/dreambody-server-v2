// cdk/webSocket-info.ts

import middy from "@middy/core";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { APIGatewayEvent } from "aws-lambda";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { setLoggingLevel } from "../utils/logging";

const serviceName = process.env.serviceName;
const tracer = new Tracer({ serviceName: serviceName });
const logger = new Logger({ serviceName: serviceName });
const metrics = new Metrics({
  namespace: "dreambody-v2",
  serviceName: serviceName,
});

export async function infoHandler(event: APIGatewayEvent) {
  setLoggingLevel(logger);

  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const connectionId = event.requestContext.connectionId;
  const callbackUrl = `https://${domain}/${stage}`;
  const client = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

  logger.setCorrelationId(connectionId);

  const requestParams = {
    ConnectionId: connectionId,
    Data: JSON.stringify({
      connectionId: connectionId,
    }),
  };

  const command = new PostToConnectionCommand(requestParams);

  try {
    await client.send(command);
  } catch (error) {
    logger.error("DreambodyV2 websocket info error:", error as Error);
  }

  return {
    statusCode: 200,
  };
}

export const handler = middy(infoHandler)
  .use(logMetrics(metrics))
  .use(injectLambdaContext(logger, { logEvent: false }))
  .use(captureLambdaHandler(tracer, { captureResponse: false }));

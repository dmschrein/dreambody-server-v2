//cdk/functions/webSocket-connection-handler.ts

import middy from "@middy/core";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { APIGatewayEvent } from "aws-lambda";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import generateLambdaProxyResponse from "./utils";
import { setLoggingLevel } from "../utils/logging";

const serviceName = process.env.serviceName;
const tracer = new Tracer({ serviceName: serviceName });
const logger = new Logger({ serviceName: serviceName });
const metrics = new Metrics({
  namespace: "dreambody-v2",
  serviceName: serviceName,
});

export async function connectionHandler(event: APIGatewayEvent) {
  setLoggingLevel(logger);

  const { eventType, connectionId } = event.requestContext;

  logger.setCorrelationId(connectionId);

  if (eventType === "CONNECT") {
    return generateLambdaProxyResponse(
      200,
      JSON.stringify({
        Connected: true,
        connectionId: connectionId,
      }),
    );
  }

  if (eventType === "DISCONNECT") {
    return generateLambdaProxyResponse(
      200,
      JSON.stringify({
        Connected: false,
        connectionId: connectionId,
      }),
    );
  }

  return generateLambdaProxyResponse(200, "Ok");
}

export const handler = middy(connectionHandler)
  .use(logMetrics(metrics))
  .use(injectLambdaContext(logger, { logEvent: false }))
  .use(captureLambdaHandler(tracer, { captureResponse: false }));

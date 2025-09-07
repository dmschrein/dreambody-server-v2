//cdk/bedrock-respond-lambda.ts
import middy from "@middy/core";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { setLoggingLevel } from "../utils/logging";

const serviceName = "genaiFlowPromptEventHandler";
const tracer = new Tracer({ serviceName: serviceName });
const logger = new Logger({ serviceName: serviceName });
const metrics = new Metrics({
  namespace: "dreambody-v2",
  serviceName: serviceName,
});

interface BedrockInput {
  value: string;
  type: string;
}

interface BedrockNode {
  name: string;
  inputs: BedrockInput[];
}

interface BedrockEvent {
  node: BedrockNode;
  flow: {
    aliasId: string;
    arn: string;
  };
  messageVersion: string;
}

export const functionHandler = async (event: BedrockEvent): Promise<void> => {
  setLoggingLevel(logger);

  const eventValue = event.node.inputs[0].value;

  const inputData = JSON.parse(eventValue);
  const { connectionId, ...response } = inputData;
  const responseData = { ...response };

  if (!connectionId) {
    throw new Error("No connectionId found in input data");
  }

  logger.setCorrelationId(connectionId);

  const client = new EventBridgeClient({});

  const command = new PutEventsCommand({
    Entries: [
      {
        EventBusName: process.env.eventBusName,
        Source: "promptEventHandler",
        DetailType: "bedrockResponded",
        Detail: JSON.stringify({
          connectionId: connectionId,
          response: responseData,
        }),
      },
    ],
  });

  await client.send(command);
};

export const handler = middy(functionHandler)
  .use(logMetrics(metrics))
  .use(injectLambdaContext(logger, { logEvent: false }))
  .use(captureLambdaHandler(tracer, { captureResponse: false }));

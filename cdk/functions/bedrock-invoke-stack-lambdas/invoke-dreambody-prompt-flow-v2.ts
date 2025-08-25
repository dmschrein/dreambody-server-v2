// cdk/functions/bedrock-invoke-stack-lambdas/invoke-dreambody-prompt-flow-v2.ts
import middy from "@middy/core";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  BedrockAgentRuntimeClient,
  FlowOutputEvent,
  InvokeFlowCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { setLoggingLevel } from "../../utils/logging";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";

const serviceName = "InvokePromptFlowV2";
const tracer = new Tracer({ serviceName: serviceName });
const logger = new Logger({ serviceName: serviceName });
const metrics = new Metrics({
  namespace: "dreambody-v2",
  serviceName: serviceName,
});

interface FlowInput {
  connectionId: string;
  content: string;
}

function validateInput(body: FlowInput): body is FlowInput {
  return !!(body?.content && body?.connectionId);
}

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const functionHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  setLoggingLevel(logger);

  // define required parameters with optional config
  const parameterProps = {
    "/dreambody-server/dreambodyV1/flowIdentifier": {},
    "/dreambody-server/dreambodyV1/flowAliasIdentifier": {},
    "/dreambody-server/dreambodyV1/startNodeName": {},
    "/dreambody-server/dreambodyV1/endNodeOutputName": {},
  };

  const { _errors: paramErrors, ...parameters } = await getParametersByName(
    parameterProps,
    {
      throwOnError: false,
    }
  );

  if (paramErrors?.length) {
    logger.error(
      `Missing required parameters from SSM: ${paramErrors.join(", ")}`
    );
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Missing required parameters" }),
    };
  }

  const flowId = parameters[
    "/dreambody-server/dreambodyV1flowIdentifier"
  ] as string;
  const flowAliasId = parameters[
    "/dreambody-server/dreambodyV1/flowAliasIdentifier"
  ] as string;
  const startNodeName = parameters[
    "/dreambody-server/dreambodyV1/startNodeName"
  ] as string;
  const endNodeOutputName = parameters[
    "/dreambody-server/dreambodyV1/endNodeOutputName"
  ] as string;

  if (!event.body) {
    logger.error("No request body provided");
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "No request body provided" }),
    };
  }

  let body: FlowInput;

  try {
    body = JSON.parse(event.body);
    logger.setCorrelationId(body.connectionId);
  } catch (error) {
    logger.error("Invalid JSON in request body", { error });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid JSON in request body" }),
    };
  }

  if (!validateInput(body)) {
    logger.error("Invalid input provided", { body });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid input" }),
    };
  }

  //==================== Bedrock ==============================

  const bedrockClient = new BedrockAgentRuntimeClient({});
  logger.info("Initializing Bedrock flow invocation", {
    flowId: flowId,
    aliasId: flowAliasId,
    nodeName: startNodeName,
    nodeOutputName: endNodeOutputName,
  });

  try {
    const invokeFlowCommand = new InvokeFlowCommand({
      flowIdentifier: flowId,
      flowAliasIdentifier: flowAliasId,
      inputs: [
        {
          content: {
            document: body.content, // quiz results
          },
          nodeName: startNodeName,
          nodeOutputName: endNodeOutputName,
        },
      ],
    });

    const response = await bedrockClient.send(invokeFlowCommand);
    logger.info("Received response from Bedrock", {
      executionId: response.executionId,
      hasResponseStream: !!response.responseStream,
    });

    if (!response.responseStream) {
      logger.error("No response stream received from Bedrock");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "No response stream from Bedrock" }),
      };
    }

    let flowResponse = {};
    let chunkCount = 0;
    let result = "";

    for await (const chunkEvent of response.responseStream) {
      chunkCount++;
      const { flowOutputEvent, flowCompletionEvent } = chunkEvent;

      if (flowOutputEvent) {
        flowResponse = { ...flowResponse, ...flowOutputEvent };

        if (flowResponse != undefined) {
          result = JSON.stringify(
            (flowResponse as FlowOutputEvent).content?.document
          );

          logger.debug("Flow output event received", {
            chunkNumber: chunkCount,
            eventType: "output",
            nodeName: flowOutputEvent.nodeName,
          });
        }
      } else if (flowCompletionEvent) {
        flowResponse = { ...flowResponse, ...flowCompletionEvent };
        logger.debug("Flow completion event received", {
          chunkNumber: chunkCount,
          eventType: "completion",
        });
      }
    }

    //=============Event Bridge ========================================

    const eventBridgeClient = new EventBridgeClient({});
    logger.debug("Preparing EventBridge event", {
      connectionId: body.connectionId,
      response: JSON.parse(result),
    });

    const eventBridgeCommand = new PutEventsCommand({
      Entries: [
        {
          EventBusName: process.env.eventBusName,
          Source: "promptEventHandler",
          DetailType: "bedrockResponded",
          Detail: JSON.stringify({
            connectionId: body.connectionId,
            response: JSON.parse(result),
          }),
        },
      ],
    });

    await eventBridgeClient.send(eventBridgeCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Flow invoked and response sent to EventBridge",
      }),
    };
  } catch (error) {
    logger.error("Error in flow execution", {
      error,
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};

export const handler = middy(functionHandler)
  .use(logMetrics(metrics))
  .use(injectLambdaContext(logger, { logEvent: false }))
  .use(captureLambdaHandler(tracer, { captureResponse: false }));

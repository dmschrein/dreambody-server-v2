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

const serviceName = "flowchartInvokePromptFlowV2Preview";
const tracer = new Tracer({ serviceName });
const logger = new Logger({ serviceName });
const metrics = new Metrics({ namespace: "flowchartV2", serviceName });

type DocSet = "trust" | "will";

interface Preferences {
  fiduciary_names?: Array<
    | "grantor"
    | "initial_trustee"
    | "successor_trustee"
    | "testator"
    | "executor"
    | "successor_executor"
  >;
  beneficiary_groups?: Array<
    "descendants" | "specific" | "residuary" | "remote_contingent"
  >;
  article_references?:
    | "article_number_only"
    | "article_and_section"
    | "article_number_and_title";
}

interface FlowInputV2 {
  connectionId: string;
  content: string; // original document text
  documentSet?: DocSet; // trust|will (optional for spike)
  preferences?: Preferences; // new!
}

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const validateInput = (b: FlowInputV2): b is FlowInputV2 =>
  !!(b?.connectionId && typeof b.content === "string" && b.content.length > 0);

function buildDirectives(
  docSet: DocSet | undefined,
  prefs: Preferences | undefined
): string {
  const lines: string[] = [];

  // fiduciaries
  const roles = (prefs?.fiduciary_names ?? []).filter((r) =>
    docSet === "will"
      ? ["testator", "executor", "successor_executor"].includes(r)
      : ["grantor", "initial_trustee", "successor_trustee"].includes(r)
  );
  if (roles.length) {
    lines.push(`Extract fiduciary names for: ${roles.join(", ")}.`);
    lines.push(
      `Place each within the relevant node on a new line in parentheses.`
    );
  }

  // beneficiaries
  const groups = prefs?.beneficiary_groups ?? [];
  if (groups.length) {
    lines.push(`Include beneficiary groups: ${groups.join(", ")}.`);
  }

  // article references
  const fmt = prefs?.article_references ?? "article_number_only";
  lines.push(
    `Article reference format: ${fmt}; append on a new line inside the relevant node.`
  );

  return lines.join("\n");
}

function composePrompt(body: FlowInputV2): string {
  const system = [
    "You generate will/trust flowcharts.",
    "Use Mermaid with theme='neutral', look='classic', and layout='elk'.",
    "Return ONLY JSON per the required schema. Enclose each node contents in double quotes.",
  ].join("\n");

  const task = [
    "Follow these steps:",
    "1) Read and analyze the document.",
    "2) Identify key parties, triggering events, survivor trusts, distributions (include numeric values).",
    "3) Apply the directives exactly.",
    "4) Produce valid JSON matching the schema only.",
  ].join("\n");

  const directives = buildDirectives(body.documentSet, body.preferences);

  return [
    system,
    "",
    task,
    "",
    "DIRECTIVES:",
    directives,
    "",
    "DOCUMENT:",
    body.content,
  ].join("\n");
}

export const functionHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  setLoggingLevel(logger);
  // Step 0: Start request
  logger.info("Preview invoke received", {
    requestId: event.requestContext?.requestId,
    route: event.requestContext?.routeKey,
  });

  // === SSM parameters (same names as prod for the spike) ===
  const parameterProps = {
    "/wealth-counsel/flowchartV2/flowIdentifier": {},
    "/wealth-counsel/flowchartV2/flowAliasIdentifier": {},
    "/wealth-counsel/flowchartV2/startNodeName": {},
    "/wealth-counsel/flowchartV2/endNodeOutputName": {},
  } as const;

  // Step 1: Load required SSM parameters for the flow/alias/nodes
  const { _errors: paramErrors, ...parameters } = await getParametersByName(
    parameterProps,
    { throwOnError: false }
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

  // Materialize and verify parameter values
  const flowId = parameters[
    "/wealth-counsel/flowchartV2/flowIdentifier"
  ] as string;
  const flowAliasId = parameters[
    "/wealth-counsel/flowchartV2/flowAliasIdentifier"
  ] as string;
  const startNodeName = parameters[
    "/wealth-counsel/flowchartV2/startNodeName"
  ] as string;
  const endNodeOutputName = parameters[
    "/wealth-counsel/flowchartV2/endNodeOutputName"
  ] as string;

  if (!flowId || !flowAliasId || !startNodeName || !endNodeOutputName) {
    logger.error("One or more required SSM parameter values are empty", {
      hasFlowId: !!flowId,
      hasFlowAliasId: !!flowAliasId,
      hasStartNodeName: !!startNodeName,
      hasEndNodeOutputName: !!endNodeOutputName,
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Invalid/missing SSM parameter values" }),
    };
  }
  logger.info("Loaded SSM parameters", {
    flowId,
    flowAliasId,
    startNodeName,
    endNodeOutputName,
  });

  if (!event.body)
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "No request body provided" }),
    };

  // Step 2: Parse and validate request body
  let body: FlowInputV2;
  try {
    body = JSON.parse(event.body);
    logger.setCorrelationId(body.connectionId);
  } catch (err) {
    logger.error("Invalid JSON in request body", { err });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid JSON in request body" }),
    };
  }
  if (!validateInput(body)) {
    logger.error("Invalid input", { body });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid input" }),
    };
  }
  logger.info("Parsed request body", {
    connectionId: body.connectionId,
    documentLength: body.content?.length,
    hasPreferences: !!body.preferences,
    documentSet: body.documentSet,
  });

  // Step 3: Compose modified prompt from preferences (server-side)
  const composed = composePrompt(body);
  logger.debug("Composed prompt", { length: composed.length });

  // Step 4: Invoke Bedrock Flow
  const bedrockClient = new BedrockAgentRuntimeClient({});
  logger.info("Invoking Bedrock Flow", {
    flowId,
    flowAliasId,
    startNodeName,
    endNodeOutputName,
  });

  try {
    const cmd = new InvokeFlowCommand({
      flowIdentifier: flowId,
      flowAliasIdentifier: flowAliasId,
      inputs: [
        {
          content: { document: composed }, // <-- key difference
          nodeName: startNodeName,
          nodeOutputName: endNodeOutputName,
        },
      ],
    });

    const resp = await bedrockClient.send(cmd);
    if (!resp.responseStream) {
      logger.error("No response stream from Bedrock");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "No response stream from Bedrock" }),
      };
    }

    // Step 5: Stream Bedrock response
    let flowResponse = {};
    let result = "";
    let chunkCount = 0;

    for await (const chunk of resp.responseStream) {
      chunkCount += 1;
      if (chunk.flowOutputEvent) {
        flowResponse = { ...flowResponse, ...chunk.flowOutputEvent };
        result = JSON.stringify(
          (flowResponse as FlowOutputEvent).content?.document
        );
        logger.debug("Received flow output event", {
          chunkCount,
          nodeName: chunk.flowOutputEvent.nodeName,
        });
      } else if (chunk.flowCompletionEvent) {
        logger.debug("Received flow completion event", { chunkCount });
      }
    }
    logger.info("Completed Bedrock response stream", { chunkCount });

    // Step 6: Publish response to EventBridge for WebSocket fan-out
    const eventBridge = new EventBridgeClient({});
    logger.info("Publishing EventBridge event", {
      eventBusName: process.env.eventBusName,
      connectionId: body.connectionId,
    });
    await eventBridge.send(
      new PutEventsCommand({
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
      })
    );
    logger.info("EventBridge publish success");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preview flow invoked" }),
    };
  } catch (error) {
    logger.error("Error in preview flow execution", { error });
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

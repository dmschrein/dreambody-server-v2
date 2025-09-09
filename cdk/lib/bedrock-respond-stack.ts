/**
 * Wires up a WebSocket API + several lambda functions + an EventBridge event bus so the "Bedrock prompt flow" can
 * emit an event, and the backend can push a response over WebSocket to a specific client connection.
 * Overview:
 * 1. Prompt flow finishes
 * 2. bedrockRespondLambda puts a bedrockResponded event on the event bus
 * 3. An EventBridge rule invokes eventBridgeRespondLambda
 * 4. eventBridgeRespondLambda uses the WebSocket Management API
 */
import * as path from "node:path";
import { Stack, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { WebSocketApi, WebSocketStage } from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { PipelineStackProps } from "./pipeline-stack";
import { getName } from "../utils/resource-naming-util";
import * as events from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";

export class BedrockRespondStack extends Stack {
  public readonly webSocketApi: WebSocketApi;
  public readonly wsStage: WebSocketStage;
  constructor(parent: Construct, id: string, props: PipelineStackProps) {
    // super calls the parent constructor
    super(parent, id, props);

    const eventBusName = getName(
      "dreambody-v2",
      "eventBus",
      props.gitHub.branch,
      "",
      "dreambodyRespondBackend"
    );
    const ssmResourceArn = `arn:aws:ssm:${props.env?.region}:${props.env?.account}:parameter/dreambody-v2/*`;

    const eventBus = new events.EventBus(
      this,
      getName(
        "dreambody-v2",
        "eventBus",
        props.gitHub.branch,
        "",
        "dreambodyRespondBackend"
      ),
      {
        eventBusName: eventBusName,
      }
    );

    // respond lambda
    const bedrockRespondLambda = new NodejsFunction(
      this,
      getName(
        "dreambody-v2",
        "lambda",
        props.gitHub.branch,
        "",
        "bedrockRespondBackend"
      ),
      {
        functionName: getName(
          "dreambody-v2",
          "lambda",
          props.gitHub.branch,
          "",
          "bedrockRespondBackend"
        ),
        description:
          "Lambda function to take results from the prompt flow and send to the event bus",
        runtime: Runtime.NODEJS_22_X,
        entry: path.join(__dirname, "../functions/bedrock-respond-lambda.ts"),
        handler: "handler",
        timeout: Duration.seconds(60),
        tracing: Tracing.ACTIVE,
        initialPolicy: [
          new PolicyStatement({
            actions: ["ssm:GetParameter", "ssm:GetParameters"],
            resources: [ssmResourceArn],
          }),
        ],
        environment: {
          EVENT_BUS_NAME: eventBusName,
        },
      }
    );

    eventBus.grantPutEventsTo(bedrockRespondLambda);

    // connection lambda
    const connectionLambda = new NodejsFunction(
      this,
      getName(
        "dreambody-v2",
        "lambda",
        props.gitHub.branch,
        "",
        "connectionBackend"
      ),
      {
        functionName: getName(
          "dreambody-v2",
          "lambda",
          props.gitHub.branch,
          "",
          "connectionBackend"
        ),
        description: "Lambda function to handle WebSocket connections",
        runtime: Runtime.NODEJS_22_X,
        entry: path.join(
          __dirname,
          "../functions/webSocket-connection-handler.ts"
        ),
        handler: "handler",
        timeout: Duration.seconds(60),
        tracing: Tracing.ACTIVE,
        initialPolicy: [
          new PolicyStatement({
            actions: ["ssm:GetParameter", "ssm:GetParameters"],
            resources: [ssmResourceArn],
          }),
        ],
        environment: {
          serviceName: getName(
            "dreambody-v2",
            "middyService",
            props.gitHub.branch,
            "",
            "wsConnectionLambdadreambodyRespondBackend"
          ),
        },
      }
    );

    // info lambda
    const infoLambda = new NodejsFunction(
      this,
      getName(
        "dreambody-v2",
        "lambda",
        props.gitHub.branch,
        "",
        "webSocketInfo"
      ),
      {
        functionName: getName(
          "dreambody-v2",
          "lambda",
          props.gitHub.branch,
          "",
          "webSocketInfo"
        ),
        description:
          "Lambda function to provide connection to websocket clients",
        runtime: Runtime.NODEJS_22_X,
        entry: path.join(__dirname, "../functions/webSocket-info.ts"),
        handler: "handler",
        timeout: Duration.seconds(60),
        tracing: Tracing.ACTIVE,
        initialPolicy: [
          new PolicyStatement({
            actions: ["ssm:GetParameter", "ssm:GetParameters"],
            resources: [ssmResourceArn],
          }),
        ],
        environment: {
          serviceName: getName(
            "dreambody-v2",
            "middyService",
            props.gitHub.branch,
            "",
            "wsInfoLambdaBedrockRespondBackend"
          ),
        },
      }
    );

    // feedback lambda: to get user feedback
    // const feedbackLambda = new NodejsFunction(
    //   this,
    //   getName(
    //     "dreambody-v2",
    //     "lambda",
    //     props.gitHub.branch,
    //     "",
    //     "feedbackProcessing"
    //   ),
    //   {
    //     functionName: getName(
    //       "dreambody-v2",
    //       "lambda",
    //       props.gitHub.branch,
    //       "",
    //       "feedbackProcessing"
    //     ),
    //     description: "Lambda function to process feedback",
    //     runtime: Runtime.NODEJS_22_X,
    //     entry: path.join(__dirname, "../functions/feedback-processing.ts"),
    //     handler: "handler",
    //     timeout: Duration.seconds(30),
    //     tracing: Tracing.ACTIVE,
    //     initialPolicy: [
    //       new PolicyStatement({
    //         actions: ["ssm:GetParameter", "ssm:GetParameters"],
    //         resources: [ssmResourceArn],
    //       }),
    //     ],
    //     environment: {
    //       serviceName: getName(
    //         "dreambody-v2",
    //         "middyService",
    //         props.gitHub.branch,
    //         "",
    //         "wsFeedbackLambda"
    //       ),
    //     },
    //   }
    // );

    // WebSocket API with 3 routes: $connect, $disconnect, echo, info
    const webSocketApi = new WebSocketApi(
      this,
      getName(
        "dreambody-v2",
        "webSocketApi",
        props.gitHub.branch,
        "",
        "bedrockRespondBackend"
      ),
      {
        description: "Minimal echo WebSocket API",
        connectRouteOptions: {
          integration: new WebSocketLambdaIntegration(
            "ConnectIntegration",
            connectionLambda
          ),
        },
        disconnectRouteOptions: {
          integration: new WebSocketLambdaIntegration(
            "DisconnectIntegration",
            connectionLambda
          ),
        },
      }
    );

    // add the info route integration
    webSocketApi.addRoute("info", {
      integration: new WebSocketLambdaIntegration(
        "InfoIntegration",
        infoLambda
      ),
    });

    // webSocketApi.addRoute("feedback", {
    //   integration: new WebSocketLambdaIntegration(
    //     "FeedbackIntegration",
    //     feedbackLambda
    //   ),
    // });

    const wsStage = new WebSocketStage(
      this,
      getName(
        "dreambody-v2",
        "webSocketStage",
        props.gitHub.branch,
        "",
        "bedrockRespondBackend"
      ),
      {
        webSocketApi: webSocketApi,
        stageName: "prod",
        autoDeploy: true,
      }
    );

    // create the eventBridgeRespondLambda
    const eventBridgeRespondLambda = new NodejsFunction(
      this,
      getName(
        "dreambody-v2",
        "lambda",
        props.gitHub.branch,
        "",
        "eventBridgeRespondBackend"
      ),
      {
        functionName: getName(
          "dreambody-v2",
          "lambda",
          props.gitHub.branch,
          "",
          "eventBridgeRespondBackend"
        ),
        description:
          "Lambda function to respond to events from the event bus and sends to the connectionID defined",
        runtime: Runtime.NODEJS_22_X,
        entry: path.join(
          __dirname,
          "../functions/eventbridge-respond-lambda.ts"
        ),
        handler: "handler",
        timeout: Duration.seconds(60),
        tracing: Tracing.ACTIVE,
        initialPolicy: [
          new PolicyStatement({
            actions: ["ssm:GetParameter", "ssm:GetParameters"],
            resources: [ssmResourceArn],
          }),
        ],
        environment: {
          callbackUrl: wsStage.callbackUrl,
          serviceName: getName(
            "dreambody-v2",
            "middyService",
            props.gitHub.branch,
            "",
            "bedrockRespondBackend"
          ),
        },
      }
    );

    // outputs
    new CfnOutput(this, "bedrockRespondLambdaArn", {
      value: bedrockRespondLambda.functionArn,
      exportName: "bedrockRespondLambdaArn",
    });

    new CfnOutput(this, "eventBusArn", {
      value: eventBus.eventBusArn,
      exportName: "eventBusArn",
    });
    const connectionsArns = this.formatArn({
      service: "execute-api",
      resourceName: `${wsStage.stageName}/POST/*`,
      resource: webSocketApi.apiId,
    });
    // Give permissions to all lambdas to manage connections
    [connectionLambda, infoLambda, eventBridgeRespondLambda].forEach((fn) =>
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ["execute-api:ManageConnections"],
          resources: [connectionsArns],
        })
      )
    );

    new events.Rule(
      this,
      getName(
        "dreambody-v2",
        "eventBridgeRule",
        props.gitHub.branch,
        "",
        "bedrockRespondBackend"
      ),
      {
        eventBus: eventBus,
        enabled: true,
        ruleName: "BedrockResponse",
        description: "Invokes a Lambda function that send the response",
        eventPattern: {
          source: ["promptEventHandler"],
          detailType: ["bedrockResponded"],
        },
        targets: [new LambdaFunction(eventBridgeRespondLambda)],
      }
    );
  }
}

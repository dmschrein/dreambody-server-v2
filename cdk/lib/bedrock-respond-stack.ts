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
import * as iam from "aws-cdk-lib/aws-iam";

export class BedrockRespondStack extends Stack {
  constructor(parent: Construct, id: string, props: PipelineStackProps) {
    // super calls the parent constructor
    super(parent, id, props);

    // Minimum lambda
    const connectionLambda = new NodejsFunction(
      this,
      getName(
        "dreambody-v2",
        "lambda",
        props.gitHub.branch,
        "",
        "websocketConnection",
      ),
      {
        runtime: Runtime.NODEJS_22_X,
        entry: path.join(
          __dirname,
          "../functions/websocket-connection-handler.ts",
        ),
        handler: "handler",
        timeout: Duration.seconds(10),
        tracing: Tracing.ACTIVE,
        initialPolicy: [
          new iam.PolicyStatement({
            actions: ["ssm:GetParameter"],
            resources: [
              `arn:aws:ssm:${props.env?.region}:${props.env?.account}:parameter/dreambody/*`,
            ],
          }),
        ],
        description: "Handles $connect and $disconnect",
      },
    );

    // info lambda
    const infoLambda = new NodejsFunction(
      this,
      getName(
        "dreambody-v2",
        "lambda",
        props.gitHub.branch,
        "",
        "websocketInfo",
      ),
      {
        runtime: Runtime.NODEJS_22_X,
        entry: path.join(__dirname, "../functions/webSocket-info.ts"),
        handler: "handler",
        timeout: Duration.seconds(10),
        tracing: Tracing.ACTIVE,
        description: "Handles $info",
        initialPolicy: [
          new iam.PolicyStatement({
            actions: ["ssm:GetParameter"],
            resources: [
              `arn:aws:ssm:${props.env?.region}:${props.env?.account}:parameter/dreambody/*`,
            ],
          }),
        ],
      },
    );

    // echo lambda
    const echoLambda = new NodejsFunction(this, "WsEchoHandler", {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "../functions/webSocket-echo.ts"),
      handler: "handler",
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      description: "Echoes messages back to the client that sent them",
    });

    // WebSocket API with 3 routes: $connect, $disconnect, echo, info
    const webSocketApi = new WebSocketApi(
      this,
      getName(
        "dreambody-v2",
        "webSocketApi",
        props.gitHub.branch,
        "",
        "bedrockRespondBackend",
      ),
      {
        description: "Minimal echo WebSocket API",
        connectRouteOptions: {
          integration: new WebSocketLambdaIntegration(
            "ConnectIntegration",
            connectionLambda,
          ),
        },
        disconnectRouteOptions: {
          integration: new WebSocketLambdaIntegration(
            "DisconnectIntegration",
            connectionLambda,
          ),
        },
      },
    );
    // Add the echo and info routes
    webSocketApi.addRoute("echo", {
      integration: new WebSocketLambdaIntegration(
        "EchoIntegration",
        echoLambda,
      ),
    });
    webSocketApi.addRoute("info", {
      integration: new WebSocketLambdaIntegration(
        "InfoIntegration",
        infoLambda,
      ),
    });

    // Websocket Stage
    const wsStage = new WebSocketStage(
      this,
      getName(
        "dreambody-v2",
        "webSocketStage",
        props.gitHub.branch,
        "",
        "bedrockRespondBackend",
      ),
      {
        webSocketApi: webSocketApi,
        stageName: "prod",
        autoDeploy: true,
      },
    );

    // Allow lambdas to post back to connections (execute-api:ManageConnections)
    const manageConnectionsArn = this.formatArn({
      service: "execute-api",
      resource: webSocketApi.apiId,
      resourceName: `${wsStage.stageName}/POST/*`,
    });
    // Allow lambdas to post back to connections (execute-api:ManageConnections)
    [connectionLambda, echoLambda].forEach((fn) =>
      fn.addToRolePolicy(
        new PolicyStatement({
          actions: ["execute-api:ManageConnections"],
          resources: [manageConnectionsArn],
        }),
      ),
    );
    // Give lambdas the management endpoint (HTTPS) to use ApiGatewayManagementApi
    // Note: wsStage.callbackUrl is the management endpoint
    echoLambda.addEnvironment("WS_POST_ENDPOINT", wsStage.callbackUrl);
    connectionLambda.addEnvironment("WS_POST_ENDPOINT", wsStage.callbackUrl);

    // outputs
    new CfnOutput(this, "WebSocketWssUrl", {
      value: `wss://${webSocketApi.apiId}.execute-api${this.region}.amazonaws.com/${wsStage.stageName}`,
    });
    new CfnOutput(this, "WebSocketManagementHttpsUrl", {
      value: wsStage.callbackUrl,
    });
  }
}

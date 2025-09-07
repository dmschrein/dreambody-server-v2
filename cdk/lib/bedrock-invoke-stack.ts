import { Construct } from "constructs";
import { EventBus } from "aws-cdk-lib/aws-events";
import { Duration, Fn, Stack, aws_iam as iam } from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as path from "path";
import { PipelineStackProps } from "./pipeline-stack";
import { getName } from "../utils/resource-naming-util";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as ssm from "aws-cdk-lib/aws-ssm";

export class BedrockInvokeStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const eventBusArn = Fn.importValue("eventBusArn");
    const eventBus = EventBus.fromEventBusArn(
      this,
      "dreambody-v2_event_bus",
      eventBusArn,
    );

    const invokeLambda = new NodejsFunction(
      this,
      getName(
        "dreambody-v2",
        "lambda",
        props.gitHub.branch,
        "",
        "bedrockInvoke",
      ),
      {
        functionName: getName(
          "dreambody-v2",
          "lambda",
          props.gitHub.branch,
          "",
          "invokePromptFlowV2",
        ),
        description: "receives a document and invokes a promptflow",
        runtime: Runtime.NODEJS_22_X,
        entry: path.join(
          __dirname,
          `../functions/bedrock-invoke-stack-lambdas/invoke-dreambody-prompt-flow-v2.ts`,
        ),
        handler: "handler",
        timeout: Duration.seconds(60),
        initialPolicy: [
          new iam.PolicyStatement({
            actions: ["ssm:GetParameter", "ssm:GetParameters"],
            resources: [
              `arn:aws:ssm:${props.env?.region}:${props.env?.account}:parameter/dreambody-v2/*`,
            ],
          }),
        ],
        environment: {
          eventBusName: eventBus.eventBusName,
        },
      },
    );

    eventBus.grantPutEventsTo(invokeLambda);

    const policyStatement = new iam.PolicyStatement();
    policyStatement.addActions("bedrock:InvokeFlow");
    policyStatement.addResources("*");
    invokeLambda.addToRolePolicy(policyStatement);

    const issuer = ssm.StringParameter.fromStringParameterAttributes(
      this,
      `dreambody-v2${props.gitHub.branch}-auth0Issuer`,
      {
        parameterName: `/dreambody-server/dreambodyV1/auth0/Issuer`,
      },
    ).stringValue;

    const audience = ssm.StringParameter.fromStringParameterAttributes(
      this,
      `dreambody-v2${props.gitHub.branch}-auth0Audience`,
      {
        parameterName: `/dreambody-server/dreambodyV1/auth0/Audience`,
      },
    ).stringValue;

    const jwtAuthorizer = new HttpJwtAuthorizer(
      "dreambody-v2InvokeApiAuthorizer",
      issuer,
      {
        jwtAudience: [audience],
      },
    );

    const api = new apigatewayv2.HttpApi(this, "dreambody-v2InvokeApiGatway", {
      corsPreflight: {
        allowOrigins: [
          // TODO: add allowed origins
        ],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.OPTIONS,
          apigatewayv2.CorsHttpMethod.HEAD,
        ],
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "Accept",
          "X-Requested-With",
          "Access-Control-Allow-Origin",
          "Access-Control-Allow-Headers",
        ],
      },
      description:
        "HttpAPI for invoking a bedrock promptflow, includes authorizer",
      defaultAuthorizer: jwtAuthorizer,
    });

    const invokeIntegration = new HttpLambdaIntegration(
      "dreambody-v2InvokeIntegration",
      invokeLambda,
    );

    api.addRoutes({
      path: "/invoke",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: invokeIntegration,
    });
  }
}

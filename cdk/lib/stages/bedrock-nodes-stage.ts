// cdk/lib/stages/bedrock-invoke-stage.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BedrockInvokeStack } from "../bedrock-invoke-stack";
import { getName } from "../../utils/resource-naming-util";
import { dreambodyStageProps } from "./bedrock-respond-stage";

export class BedrockNodesStage extends cdk.Stage {
  constructor(app: Construct, stageName: string, props: dreambodyStageProps) {
    super(app, stageName, props);
    new BedrockInvokeStack(
      this,
      getName(
        "dreambody-v2",
        "stack",
        props.gitHub.branch,
        "",
        "bedrockNodesBackend"
      ),
      props
    );
  }
}

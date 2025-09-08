// cdk/lib/stages/bedrock-nodes-stage.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BedrockStack } from "../bedrock-nodes-stack";
import { getName } from "../../utils/resource-naming-util";
import { dreambodyStageProps } from "./bedrock-respond-stage";

export class BedrockNodesStage extends cdk.Stage {
  constructor(app: Construct, stageName: string, props: dreambodyStageProps) {
    super(app, stageName, props);
    new BedrockStack(
      this,
      getName(
        "dreambody-v2",
        "stack",
        props.gitHub.branch,
        "",
        "bedrockNodesBackend",
      ),
      props,
    );
  }
}

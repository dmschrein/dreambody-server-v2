// cdk/lib/stages/bedrock-respond-stage.ts
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BedrockRespondStack } from "../bedrock-respond-stack";
import { getName } from "../../utils/resource-naming-util";

export interface dreambodyStageProps extends cdk.StageProps {
  devOpsAccount: string;
  gitHub: {
    owner: string;
    repo: string;
    branch: string;
    connectionArn: string;
  };
}

export class BedrockRespondStage extends cdk.Stage {
  constructor(app: Construct, stageName: string, props: dreambodyStageProps) {
    super(app, stageName, props);
    new BedrockRespondStack(
      this,
      getName(
        "dreambody-v2",
        "stack",
        props.gitHub.branch,
        "",
        "bedrockRespondBackend",
      ),
      props,
    );
  }
}

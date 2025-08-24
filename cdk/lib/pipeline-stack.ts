import * as cdk from "aws-cdk-lib";
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
} from "aws-cdk-lib/pipelines";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import { Construct } from "constructs";
import { BedrockRespondStage } from "./stages/bedrock-respond-stage";
import { getName } from "../utils/resource-naming-util";

export interface PipelineStackProps extends cdk.StackProps {
  devOpsAccount: string;
  gitHub: {
    owner: string;
    repo: string;
    branch: string;
    connectionArn: string;
  };
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, {
      env: { account: props.devOpsAccount, region: "us-west-2" },
    });

    const source = CodePipelineSource.connection(
      `${props.gitHub.owner}/${props.gitHub.repo}`,
      props.gitHub.branch,
      {
        connectionArn: props.gitHub.connectionArn,
      },
    );

    const synth = new ShellStep("Synth", {
      input: source,
      commands: [
        "curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n | bash -s 22",
        "node -v", // should print v22.x
        "npm -v",

        "npm ci --prefix cdk",
        "npm run build --prefix cdk",
        'npx cdk@2 synth -a "npx ts-node --prefer-ts-exts cdk/bin/cdk.ts" -o cdk/cdk.out',
      ],
      primaryOutputDirectory: "cdk/cdk.out",
    });

    const pipeline = new CodePipeline(
      this,
      getName(
        "dreambody-v2",
        "codePipeline",
        props.gitHub.branch,
        "",
        "backend",
      ),
      {
        pipelineName: getName(
          "dreambody-v2",
          "codePipeline",
          props.gitHub.branch,
          "",
          "backend",
        ),
        synth,
        crossAccountKeys: true,
        codeBuildDefaults: {
          buildEnvironment: {
            buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          },
        },
      },
    );

    pipeline.addStage(
      new BedrockRespondStage(
        this,
        getName("dreambody-v2", "stage", props.gitHub.branch, "", "backend"),
        props,
      ),
    );
  }
}

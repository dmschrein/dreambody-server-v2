import { Construct } from "constructs";
import { bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import {
  PromptVariant,
  PromptVersion,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { FlowNode } from "../lib/bedrock/prompt-flows/flow-nodes";
import { FlowNodeDataType } from "../lib/bedrock/prompt-flows/flow-node-props";
import { Flow, FlowDefinition } from "./bedrock/prompt-flows/flow";
import { Stack, CfnOutput, Annotations } from "aws-cdk-lib";
import { PipelineStackProps } from "./pipeline-stack";
import { flowchartV2PromptVersion4 } from "./bedrock/prompts/flowchartV2Prompt-version4-parens";

export class BedrockStack extends Stack {
  constructor(parent: Construct, id: string, props: PipelineStackProps) {
    super(parent, id, props);

    // 1) Define the Bedrock Prompt (template + model + variables).
    // This prompt is versioned below and referenced by the Flow's prompt node.
    const dreambodyPrompt = new bedrock.Prompt(this, "flowchartV2Prompt", {
      promptName: `flowchart-v2_${props.gitHub.branch}_prompt`,
      description: "Flowchart V2 prompt (version 4) with parentheses handling",
      variants: [
        PromptVariant.text({
          variantName: "foundation",
          model:
            bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_7_SONNET_V1_0,
          promptText: flowchartV2PromptVersion4,
          promptVariables: ["document"],
          inferenceConfiguration: {
            temperature: 0,
            topP: 0.999,
            maxTokens: 4096,
          },
        }),
      ],
    });

    Annotations.of(this).addInfo(
      `Created Prompt for branch ${props.gitHub.branch}`
    );

    const promptVersionProps = {
      prompt: dreambodyPrompt,
      description: "Flowchart V2 prompt version 4",
    };

    // 2) Create a concrete Prompt Version that can be used by a Flow.
    const promptDeployVersion = new PromptVersion(
      this,
      "promptVersion1",
      promptVersionProps
    );

    new CfnOutput(this, "flowchartV2PromptVersionArn", {
      value: promptDeployVersion.versionArn,
      description: "Flowchart V2 Prompt Version ARN used by the Flow",
    });

    // 3) Define Flow nodes — Input node accepts a STRING payload (the document).
    const inputNode = FlowNode.input({
      name: "FlowInputNode",
      inputDataType: FlowNodeDataType.STRING,
    });

    // Prompt node: map the single document variable to the input node.
    const dreambodyV2PromptNode = FlowNode.prompt({
      name: "dreambodyV2PromptNode",
      prompt: promptDeployVersion.prompt,
      promptArn: promptDeployVersion.versionArn,
      inputs: [
        {
          name: "document",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data" },
        },
      ],
    });

    // Output node: returns the modelCompletion from the prompt node.
    const outputNode = FlowNode.output({
      name: "FlowOutputNode",
      outputData: {
        type: FlowNodeDataType.STRING,
        valueFrom: {
          sourceNode: dreambodyV2PromptNode,
          expression: "$.data.modelCompletion",
        },
      },
    });

    // 4) Assemble the Flow graph from the nodes above.
    const dreambodyV2Flow = new Flow(this, "flowchart-v2Flow", {
      name: `flowchart-v2_${props.gitHub.branch}_flow`,
      description: `flowchart-v2 Flow`,
      definition: FlowDefinition.fromNodes([
        inputNode,
        dreambodyV2PromptNode,
        outputNode,
      ]),
    });

    Annotations.of(this).addInfo(
      `Created Flowchart Flow with 3 nodes (input -> prompt -> output) for ${props.gitHub.branch}`
    );

    // 5) Create a Flow Version and an Alias to route traffic to that version.
    const flowVersion = dreambodyV2Flow.createVersion(
      "Flowchart V2 initial version"
    );
    const flowAliasId = dreambodyV2Flow.createAlias(
      `flowchart-v2_${props.gitHub.branch}_alias`,
      "Alias for flowchart v2",
      flowVersion,
      dreambodyV2Flow
    );

    // Helpful CloudFormation outputs for discovery/debugging.
    new CfnOutput(this, "flowchartV2FlowArn", {
      value: dreambodyV2Flow.flowArn,
      description: "Flowchart V2 Flow ARN",
      exportName: `flowchartV2FlowArn-${props.gitHub.branch}`,
    });
    new CfnOutput(this, "flowchartV2FlowId", {
      value: dreambodyV2Flow.flowId,
      description: "Flowchart V2 Flow ID",
      exportName: `flowchartV2FlowId-${props.gitHub.branch}`,
    });
    new CfnOutput(this, "flowchartV2FlowVersion", {
      value: dreambodyV2Flow.flowVersion,
      description: "Flowchart V2 Flow Version (DRAFT unless versioned)",
      exportName: `flowchartV2FlowVersion-${props.gitHub.branch}`,
    });
    new CfnOutput(this, "flowchartV2FlowVersionId", {
      value: flowVersion,
      description: "Flowchart V2 Flow Version ID (created above)",
      exportName: `flowchartV2FlowVersionId-${props.gitHub.branch}`,
    });
    new CfnOutput(this, "flowchartV2FlowAliasId", {
      value: flowAliasId,
      description: "Flowchart V2 Flow Alias ID",
      exportName: `flowchartV2FlowAliasId-${props.gitHub.branch}`,
    });

    // also must change names or  build will fail at deploy
    // const versionId = baseFlow.createVersion("Version-05-06-4 with updated prompt to handle parens");
    // const aliasId = baseFlow.createAlias("Alias-05-06-4", "Alias with new prompt fix parens", versionId, baseFlow)
  }
}

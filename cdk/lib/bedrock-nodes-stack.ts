import { Construct } from "constructs";
import { bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import {
  PromptVariant,
  PromptVersion,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { FlowNode } from "../lib/bedrock/prompt-flows/flow-nodes";
import { FlowNodeDataType } from "../lib/bedrock/prompt-flows/flow-node-props";
import { Flow, FlowDefinition } from "./bedrock/prompt-flows/flow";
import { Stack } from "aws-cdk-lib";
import { PipelineStackProps } from "./pipeline-stack";
import { dreambodyV2Prompt } from "./bedrock/prompts/dreambodyv2Prompt";

export class BedrockStack extends Stack {
  constructor(parent: Construct, id: string, props: PipelineStackProps) {
    super(parent, id, props);

    const dreambodyPrompt = new bedrock.Prompt(this, "dreambodyV2Prompt", {
      promptName: `dreambody-v2_${props.gitHub.branch}_prompt`,
      description:
        "updated draft dreambody-v2 version 1 with changes to handle parens",
      variants: [
        PromptVariant.text({
          variantName: "foundation",
          model:
            bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_3_7_SONNET_V1_0,
          promptText: dreambodyV2Prompt,
          promptVariables: [
            "age",
            "sex",
            "metrics",
            "experience",
            "medical",
            "goals",
            "schedule",
            "equipment",
            "diet_preferences",
            "diet_constraints",
            "activity",
            "context",
          ],
          inferenceConfiguration: {
            temperature: 0,
            topP: 0.999,
            maxTokens: 4096,
          },
        }),
      ],
    });

    const promptVersionProps = {
      prompt: dreambodyPrompt,
      description: "Version 1 with fix for parens in nodes 05/05",
    };

    const promptDeployVersion = new PromptVersion(
      this,
      "promptVersion1",
      promptVersionProps
    );

    const inputNode = FlowNode.input({
      name: "FlowInputNode",
      inputDataType: FlowNodeDataType.OBJECT,
    });

    const dreambodyV2PromptNode = FlowNode.prompt({
      name: "dreambodyV2PromptNode",
      prompt: promptDeployVersion.prompt,
      promptArn: promptDeployVersion.versionArn,
      inputs: [
        {
          name: "age",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.age" },
        },
        {
          name: "sex",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.sex" },
        },
        {
          name: "metrics",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.metrics" },
        },
        {
          name: "experience",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.experience" },
        },
        {
          name: "medical",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.medical" },
        },
        {
          name: "goals",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.goals" },
        },
        {
          name: "schedule",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.schedule" },
        },
        {
          name: "equipment",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.equipment" },
        },
        {
          name: "diet_preferences",
          type: FlowNodeDataType.STRING,
          valueFrom: {
            sourceNode: inputNode,
            expression: "$.data.diet_preferences",
          },
        },
        {
          name: "diet_constraints",
          type: FlowNodeDataType.STRING,
          valueFrom: {
            sourceNode: inputNode,
            expression: "$.data.diet_constraints",
          },
        },
        {
          name: "activity",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.activity" },
        },
        {
          name: "context",
          type: FlowNodeDataType.STRING,
          valueFrom: { sourceNode: inputNode, expression: "$.data.context" },
        },
      ],
    });

    const outputNode = FlowNode.output({
      name: "FlowOutputNode",
      outputData: {
        type: FlowNodeDataType.STRING,
        valueFrom: {
          sourceNode: dreambodyV2PromptNode,
          expression: "$.modelCompletion",
        },
      },
    });

    new Flow(this, "dreambody-v2Flow", {
      name: `dreambody-v2_${props.gitHub.branch}_flow`,
      description: `dreambody-v2 Flow`,
      definition: FlowDefinition.fromNodes([
        inputNode,
        dreambodyV2PromptNode,
        outputNode,
      ]),
    });

    // also must change names or  build will fail at deploy
    // const versionId = baseFlow.createVersion("Version-05-06-4 with updated prompt to handle parens");
    // const aliasId = baseFlow.createAlias("Alias-05-06-4", "Alias with new prompt fix parens", versionId, baseFlow)
  }
}

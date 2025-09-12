// cdk/lib/bedrock/prompt-flows/flow-version.ts

import { Construct } from "constructs";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import { Flow } from "./flow";

export interface FlowVersionProps {
  readonly flow: Flow;
  readonly description?: string;
}

/**
 * Creates a version of the flow that you can deploy.
 * FlowVersion (wraps CfnFlowVersion) and exposes the version string.
 * Versions are what you route traffic to (directly or via aliases).
 * Lets you decouple deployment from traffic routing and swap versions safely.
 */
export class FlowVersion extends Construct {
  public readonly version: string;
  public readonly flow: Flow;

  private readonly _resource: bedrock.CfnFlowVersion;

  constructor(scope: Construct, id: string, props: FlowVersionProps) {
    super(scope, id);

    this.flow = props.flow;

    this._resource = new bedrock.CfnFlowVersion(
      this,
      `FlowVersion-${this.flow._hash.slice(0, 16)}`,
      {
        description: props.description,
        flowArn: props.flow.flowArn,
      },
    );

    this.version = this._resource.attrVersion;
  }
}

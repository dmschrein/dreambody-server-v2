// cdk/lib/bedrock/prompt-flows-flow-alias.ts

import { Construct } from "constructs";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import { Flow } from "./prompt-flows/flow";

export interface FlowAliasProps {
  readonly description?: string;
  readonly flowArn: string;
  readonly name: string;
  readonly flowVesrion: string;
  readonly tags?: Record<string, string>;
  readonly flow: Flow;
}

/**
 * Creates an alias of the flow that you can deploy.
 */
export class FlowAlias extends Construct {
  public readonly aliasId: string;
  public readonly flow: Flow;

  private readonly _resource: bedrock.CfnFlowAlias;

  constructor(scope: Construct, id: string, props: FlowAliasProps) {
    super(scope, id);

    this.flow = props.flow;
    this._resource = new bedrock.CfnFlowAlias(
      this,
      `FlowAlias-${this.flow._hash.slice(0, 16)}`,
      {
        description: props.description,
        flowArn: props.flowArn,
        name: props.name,
        routingConfiguration: [
          {
            flowVersion: props.flowVesrion,
          },
        ],
      }
    );

    this.aliasId = this._resource.attrId;
  }
}

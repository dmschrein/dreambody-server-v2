import * as cdk from "aws-cdk-lib";
import { PipelineStack } from "../lib/pipeline-stack";
import { getName } from "../utils/resource-naming-util";
import { pipelineEnvironments } from "../config/pipeline-environments";

const app = new cdk.App();
cdk.Tags.of(app).add("App", "dreambody-server-api", {
  applyToLaunchedInstances: true,
});
pipelineEnvironments.forEach((envConfig) => {
  new PipelineStack(
    app,
    getName(
      "dreambody",
      "pipelineStack",
      envConfig.gitHub.branch,
      "",
      "backend",
    ),
    envConfig,
  );
});

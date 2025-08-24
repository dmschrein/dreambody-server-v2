// Accounts & region (replace with yours)
const ACCOUNT_PIPELINE = "726314763292"; // tooling - devops account
const ACCOUNT_DEV = "112393353994"; // dreambody-server-dev - development account
// const ACCOUNT_TEST = ''
// const ACCOUNT_UAT = ''
// const ACCOUNT_PROD = ''
const REGION = "us-west-2";

export const pipelineEnvironments = [
  {
    env: { account: ACCOUNT_DEV, region: REGION },
    devOpsAccount: ACCOUNT_PIPELINE,
    gitHub: {
      owner: "dmschrein",
      repo: "dreambody-server-v2", // <-- your repo
      branch: "dev", // <-- your branch
      connectionArn:
        "arn:aws:codeconnections:us-west-2:726314763292:connection/ea9757fc-3bfa-4f9b-ad58-6a8cfcf2d4a0",
    },
  },
  // {
  //   env: { account: ACCOUNT_TEST, region: REGION },
  //   devOpsAccount: ACCOUNT_PIPELINE,
  //   gitHub: {
  //     owner: 'dmschrein',
  //     repo: 'dmschrein/dreambody-server-v2', // <-- your repo
  //     branch: 'test', // <-- your branch
  //     connectionArn:
  //       'arn:aws:codeconnections:us-west-2:726314763292:connection/ea9757fc-3bfa-4f9b-ad58-6a8cfcf2d4a0',
  //   },
  // },
  // {
  //   env: { account: ACCOUNT_UAT, region: REGION },
  //   devOpsAccount: ACCOUNT_PIPELINE,
  //   gitHub: {
  //     owner: 'dmschrein',
  //     repo: 'dmschrein/dreambody-server-v2', // <-- your repo
  //     branch: 'uat', // <-- your branch
  //     connectionArn:
  //       'arn:aws:codeconnections:us-west-2:726314763292:connection/ea9757fc-3bfa-4f9b-ad58-6a8cfcf2d4a0',
  //   },
  // },
  // {
  //   env: { account: ACCOUNT_PROD, region: REGION },
  //   devOpsAccount: ACCOUNT_PIPELINE,
  //   gitHub: {
  //     owner: 'dmschrein',
  //     repo: 'dmschrein/dreambody-server-v2', // <-- your repo
  //     branch: 'main', // <-- your branch
  //     connectionArn:
  //       'arn:aws:codeconnections:us-west-2:726314763292:connection/ea9757fc-3bfa-4f9b-ad58-6a8cfcf2d4a0',
  //   },
  // },
];

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["cdk/**/*.{test,spec}.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
    },
  },
});

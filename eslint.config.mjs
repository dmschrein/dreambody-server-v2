// eslint.config.js (ESM flat config for ESLint v9)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  // Ignore junk
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/cdk.out/**",
    ],
  },

  // Base JS recommendations
  js.configs.recommended,

  // TS recommendations (non type-checked for speed & simplicity)
  ...tseslint.configs.recommended,

  // Project-wide settings for TS files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // Add any TS rule customizations here
    },
  },

  // Node globals for JS files (including ESM .mjs)
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },

  // Vitest globals for test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },

  // Disable stylistic rules that conflict with Prettier
  prettier,
];

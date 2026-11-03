// ESLint flat config for the whole monorepo (JS/TS only; Python lives in backend/pyproject.toml).
// Rules and their rationale: docs/engineering-rules.md.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import i18next from "eslint-plugin-i18next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactNative from "eslint-plugin-react-native";
import globals from "globals";
import tseslint from "typescript-eslint";

const TS_FILES = ["**/*.{ts,tsx,mts,cts}"];
const TEST_FILES = ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**"];
const WEB = "web/**";
const MOBILE = "mobile/**";

// Direct HTTP clients are only allowed inside packages/api-client.
const HTTP_CLIENT_MODULES = [
  "axios",
  "got",
  "ky",
  "ofetch",
  "superagent",
  "node-fetch",
  "cross-fetch",
  "undici",
].map((name) => ({
  name,
  message: "Network access goes through packages/api-client only.",
}));

// `no-restricted-imports` is not merged across config blocks (the last block wins),
// so each scope builds its complete option object here.
function restrictedImports(forbiddenGroups = []) {
  return [
    "error",
    {
      paths: HTTP_CLIENT_MODULES,
      patterns: forbiddenGroups,
    },
  ];
}

const NO_CROSS_APP_IMPORT = (app, other) => [
  {
    group: [`**/${other}/**`, `@wolbachia/${other}`, `@wolbachia/${other}/**`],
    message: `${app}/ must not import ${other}/. Shared code goes to packages/.`,
  },
];

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    ".claude/**",
    "design/**", // external design export, not our code
    "packages/api-client/src/generated/**", // generated from OpenAPI, never edited by hand
    "backend/**", // Python, linted by ruff
  ]),

  // Base rules for every JS/TS file.
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      complexity: ["error", 10],
      "max-depth": ["error", 2],
      "max-params": ["error", 3],
      "max-lines-per-function": ["error", { max: 30, skipBlankLines: true, skipComments: true }],
      "no-restricted-imports": restrictedImports(),
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Network access goes through packages/api-client only." },
        {
          name: "XMLHttpRequest",
          message: "Network access goes through packages/api-client only.",
        },
      ],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].map((object) => ({
          object,
          property: "fetch",
          message: "Network access goes through packages/api-client only.",
        })),
      ],
    },
  },

  // TypeScript: strict + type-aware. The nearest tsconfig.json of each workspace is used.
  {
    files: TS_FILES,
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // Hooks rules are harmless outside React, so they apply to every TS file.
  {
    files: TS_FILES,
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },

  // Plain JS config files (eslint.config.mjs, etc.) have no tsconfig.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  // Tests: describe() blocks wrap many cases and are not "functions that do one thing".
  {
    files: TEST_FILES,
    rules: { "max-lines-per-function": "off" },
  },

  // Everything except the generated-client package must not use HTTP clients.
  // (packages/api-client is the only place allowed to call fetch or an HTTP library.)
  {
    files: ["packages/api-client/**"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
    },
  },

  // React (web and mobile only): scoped so packages without React do not need the plugin.
  {
    files: [`${WEB}/*.{jsx,tsx}`, `${MOBILE}/*.{jsx,tsx}`],
    extends: [react.configs.flat.recommended, react.configs.flat["jsx-runtime"]],
    settings: { react: { version: "detect" } },
  },

  // web/: no imports from mobile/, accessibility rules, browser globals.
  {
    files: [`${WEB}/*.{ts,tsx}`],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-imports": restrictedImports(NO_CROSS_APP_IMPORT("web", "mobile")),
    },
  },
  {
    files: [`${WEB}/*.{jsx,tsx}`],
    extends: [jsxA11y.flatConfigs.recommended],
  },

  // mobile/: no imports from web/, inline-style and color-literal rules.
  {
    files: [`${MOBILE}/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": restrictedImports(NO_CROSS_APP_IMPORT("mobile", "web")),
    },
  },
  {
    files: [`${MOBILE}/*.{jsx,tsx}`],
    plugins: { "react-native": reactNative },
    rules: {
      "react-native/no-inline-styles": "error",
      "react-native/no-color-literals": "error",
    },
  },

  // User-facing text in JSX must come from i18n keys (packages/i18n), never literals.
  {
    files: [`${WEB}/*.{jsx,tsx}`, `${MOBILE}/*.{jsx,tsx}`],
    ignores: TEST_FILES,
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": ["error", { mode: "jsx-text-only" }],
    },
  },
]);

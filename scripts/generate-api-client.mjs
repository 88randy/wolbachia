// Regenerates packages/api-client from the backend (issue #12): `npm run api:generate`.
//
// 1. Exports the OpenAPI schema with `manage.py spectacular --validate --fail-on-warn` using the
//    dev settings (the test settings add test-only routes), into packages/api-client/openapi.yaml.
// 2. Generates packages/api-client/src/generated/schema.ts from it with openapi-typescript.
//
// Needs `uv` and `uv sync` once in backend/. The schema export never connects to PostgreSQL or
// Redis; the URLs below only satisfy the settings. Both outputs are committed, and CI fails when
// a PR leaves them out of date (.github/workflows/api-contract.yml).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SCHEMA_FILE = "packages/api-client/openapi.yaml";
const TYPES_FILE = "packages/api-client/src/generated/schema.ts";

// Throwaway values: they never leave this process and are not secrets.
const SCHEMA_EXPORT_ENV = {
  DJANGO_SETTINGS_MODULE: "config.settings.dev",
  DJANGO_SECRET_KEY: "schema-export-only-not-a-secret",
  DATABASE_URL: "postgres://wolbachia:wolbachia@127.0.0.1:5432/wolbachia",
  REDIS_URL: "redis://127.0.0.1:6379/0",
  // Never read backend/.env: the schema must not depend on a developer's local settings.
  DJANGO_READ_DOT_ENV_FILE: "false",
};

function run(command, args, env = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`api:generate failed: "${command} ${args.join(" ")}" exited ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

// spectacular writes platform newlines; the committed file is always LF (.gitattributes).
function normalizeLineEndings(file) {
  writeFileSync(file, readFileSync(file, "utf8").replaceAll("\r\n", "\n"));
}

const exportSchema = [
  "run",
  "--directory",
  "backend",
  "python",
  "manage.py",
  "spectacular",
  "--validate",
  "--fail-on-warn",
  "--file",
  `../${SCHEMA_FILE}`,
];
run("uv", exportSchema, SCHEMA_EXPORT_ENV);
normalizeLineEndings(SCHEMA_FILE);
// openapi-typescript lives in the api-client workspace with its own TypeScript (its peer range
// is ^5, the repo uses 6), so it is run through `npm exec` in that workspace; paths are relative
// to packages/api-client there.
const generateTypes = ["exec", "--workspace=packages/api-client", "--no-install", "--"];
run("npm", [
  ...generateTypes,
  "openapi-typescript",
  "openapi.yaml",
  "--output",
  "src/generated/schema.ts",
]);
normalizeLineEndings(TYPES_FILE);

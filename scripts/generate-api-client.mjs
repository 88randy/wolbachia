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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Paths come from this file's location, so the script works from any working directory.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_FILE = join(ROOT, "packages/api-client/openapi.yaml");
const TYPES_FILE = join(ROOT, "packages/api-client/src/generated/schema.ts");
// Given to `uv` (run from backend/) as a relative path: arguments go through a shell and are not
// quoted, so an absolute path with spaces would split in two.
const SCHEMA_FILE_FROM_BACKEND = "../packages/api-client/openapi.yaml";

// Throwaway values, not secrets. They override the caller's environment for the variables that
// matter, and `backend/.env` is not read, so the export does not depend on local settings. Other
// inherited variables (proxies, PATH...) pass through and do not change the schema.
const SCHEMA_EXPORT_ENV = {
  DJANGO_SETTINGS_MODULE: "config.settings.dev",
  DJANGO_SECRET_KEY: "schema-export-only-not-a-secret",
  DATABASE_URL: "postgres://wolbachia:wolbachia@127.0.0.1:5432/wolbachia",
  REDIS_URL: "redis://127.0.0.1:6379/0",
  DJANGO_READ_DOT_ENV_FILE: "false",
};

function run(command, args, env = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    const reason = result.signal ? `was killed by ${result.signal}` : `exited ${result.status}`;
    console.error(`api:generate failed: "${command} ${args.join(" ")}" ${reason}.`);
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
  SCHEMA_FILE_FROM_BACKEND,
];
run("uv", exportSchema, SCHEMA_EXPORT_ENV);
normalizeLineEndings(SCHEMA_FILE);

// openapi-typescript lives in the api-client workspace with its own TypeScript (its peer range
// is ^5, the repo uses 6), so it is run through `npm exec` in that workspace; paths are relative
// to packages/api-client there.
const generateTypes = ["exec", "--workspace=packages/api-client", "--no-install", "--"];
const generate = ["openapi-typescript", "openapi.yaml", "--output", "src/generated/schema.ts"];
run("npm", [...generateTypes, ...generate]);
normalizeLineEndings(TYPES_FILE);

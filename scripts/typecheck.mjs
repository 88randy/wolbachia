// Type-checks every workspace that has a tsconfig.json (tsc --noEmit -p <dir>).
// Succeeds with nothing to check while no TypeScript workspace exists yet, so CI stays green
// on an empty folder. `npm run typecheck --workspaces` cannot do this: it fails when zero
// workspaces contain a package.json.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT_WORKSPACES = ["mobile", "web"];
const PACKAGES_DIR = "packages";

function listWorkspaceDirs() {
  const packageDirs = existsSync(PACKAGES_DIR)
    ? readdirSync(PACKAGES_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(PACKAGES_DIR, entry.name))
    : [];
  return [...ROOT_WORKSPACES, ...packageDirs].filter((dir) =>
    existsSync(join(dir, "tsconfig.json")),
  );
}

function typecheck(dir) {
  console.log(`tsc --noEmit -p ${dir}`);
  const result = spawnSync("npx", ["tsc", "--noEmit", "-p", dir], {
    stdio: "inherit",
    shell: true,
  });
  return result.status === 0;
}

const workspaces = listWorkspaceDirs();
if (workspaces.length === 0) {
  console.log("No TypeScript workspace yet: nothing to type-check.");
}
const failed = workspaces.filter((dir) => !typecheck(dir));
process.exit(failed.length === 0 ? 0 : 1);

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Orchestrator rule (#82): the session controller is the ONLY writer of the session (epoch, state,
 * organization slug, recorded identity, expected attestation). A call to a writer from any other
 * non-test file is a violation. Each writer is allowed in the file that DEFINES it and in the
 * controller; tests may use them to simulate.
 */
const WRITERS: readonly { name: string; definedIn: string }[] = [
  { name: "bumpEpoch", definedIn: "session-revision.ts" },
  { name: "setSessionState", definedIn: "session-revision.ts" },
  { name: "setSignedOut", definedIn: "session-revision.ts" },
  { name: "setOrganizationSlug", definedIn: "organization-slug.ts" },
  { name: "clearOrganizationSlug", definedIn: "organization-slug.ts" },
  { name: "recordIdentity", definedIn: "identity.ts" },
  { name: "forgetIdentity", definedIn: "identity.ts" },
  { name: "setExpectedAttestation", definedIn: "attestation.ts" },
  { name: "clearExpectedAttestation", definedIn: "attestation.ts" },
];
const CONTROLLER = "session-controller.ts";

const SRC = join(import.meta.dirname, "..");
const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file))
  .filter((file) => !file.split(/[\\/]/).includes("test"))
  .map((file) => ({ file, base: file.split(/[\\/]/).pop() ?? file }));

describe("the session controller is the only writer", () => {
  test("finds the source files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  test("no file but the controller (and the module that defines a writer) calls it", () => {
    const violations = files.flatMap(({ file, base }) => {
      const source = readFileSync(join(SRC, file), "utf8");
      return WRITERS.filter(
        (writer) =>
          base !== CONTROLLER &&
          base !== writer.definedIn &&
          new RegExp(`(?<![\\w.])${writer.name}\\(`).test(source),
      ).map((writer) => `${file}: ${writer.name}()`);
    });

    expect(violations).toEqual([]);
  });
});

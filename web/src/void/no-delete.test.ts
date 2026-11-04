import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SRC = join(import.meta.dirname, "..");
const DELETE_CALL = /\.DELETE\(|method:\s*["']DELETE["']/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

describe("nothing is deleted (#32)", () => {
  test("no web source calls DELETE; a correction is a void with a reason", () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      DELETE_CALL.test(readFileSync(file, "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});

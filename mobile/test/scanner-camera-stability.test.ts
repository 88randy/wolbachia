import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ScannerSession, SCAN_DEDUPE_MS } from "../src/features/scanner/scanner-session.ts";

void test("the same code is ignored inside the window and allowed again after it", async () => {
  let nowMs = 1000;
  const session = new ScannerSession(() => nowMs);
  const run = (key: string) => session.run(key, () => Promise.resolve("done"));
  assert.equal(await run("false:A"), "done");
  assert.equal(await run("false:A"), "duplicate");
  assert.equal(await run("false:B"), "done");
  nowMs += SCAN_DEDUPE_MS + 1;
  // A legit retry of the same code (for example after fixing the problem) is not swallowed.
  assert.equal(await run("false:B"), "done");
});

void test("the camera view only receives stable props, so screen updates never recreate it", () => {
  const source = readFileSync(
    new URL("../src/features/scanner/ScannerPreview.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /memo\(function LiveCamera/);
  assert.match(source, /useCallback\(\(result: BarcodeScanningResult\)/);
  assert.doesNotMatch(source, /style=\{\{/);
  assert.doesNotMatch(source, /onBarcodeScanned=\{\(/);
  const lifecycle = readFileSync(
    new URL("../src/features/scanner/use-scanner-lifecycle.ts", import.meta.url),
    "utf8",
  );
  // Background only retires the scan in flight; it does not hide the camera view.
  assert.match(lifecycle, /if \(state !== "active"\) retire\(\)/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SCANNER_ENTRY_POINTS } from "./support/scanner-entry-points.ts";

const ROOT = new URL("../src/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

void test("every scan entry point ends in the one scanner screen with preview and typed code", () => {
  const screen = read("features/scanner/P11Screen.tsx");
  assert.match(screen, /<ScannerPreview model=\{model\}/);
  assert.match(screen, /<ScannerControls model=\{model\}/);
  assert.match(screen, /void start\(\)/);
  for (const entry of SCANNER_ENTRY_POINTS) {
    assert.match(read(entry.file), entry.pattern, entry.name);
  }
});

void test("no entry point passes a flag that hides the camera: visibility is one state", () => {
  const preview = read("features/scanner/ScannerPreview.tsx");
  assert.match(preview, /model\.isCameraVisible/);
  const lifecycle = read("features/scanner/use-scanner-lifecycle.ts");
  // The preview does not depend on the AppState reading (a wrong one hid it with no message).
  assert.doesNotMatch(lifecycle, /canShowCamera = \(\) =>[^;]*AppState/);
});

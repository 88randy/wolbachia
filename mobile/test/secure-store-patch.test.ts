import assert from "node:assert/strict";
import {
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { it } from "node:test";

import { applyPatch, verifyPatch } from "../native/secure-store/patch.cjs";
import { assertExpectedRed } from "../native/secure-store/ci-proof.cjs";

const assets = new URL("../native/secure-store/", import.meta.url);
const modulePath = "android/src/main/java/expo/modules/securestore/SecureStoreModule.kt";

function fixture() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "wolbachia-secure-store-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "58.0.2" }));
  mkdirSync(dirname(join(root, modulePath)), { recursive: true });
  writeFileSync(
    join(root, modulePath),
    readFileSync(new URL("pristine/SecureStoreModule.kt", assets)),
  );
  writeFileSync(
    join(root, "android/build.gradle"),
    readFileSync(new URL("pristine/build.gradle", assets)),
  );
  return {
    root,
    close: () => {
      assert.equal(dirname(root), realpathSync(tmpdir()));
      assert.ok(basename(root).startsWith("wolbachia-secure-store-"));
      assert.equal(realpathSync(root), resolve(root));
      snapshot(root); // Reject any remaining junction before recursive cleanup.
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function snapshot(root: string): unknown[] {
  return readdirSync(root)
    .sort()
    .map((name) => {
      const path = join(root, name);
      const stat = lstatSync(path);
      assert.ok(!stat.isSymbolicLink(), "Fixture snapshots and cleanup never follow links");
      return {
        name,
        mode: stat.mode,
        body: stat.isDirectory() ? snapshot(path) : readFileSync(path, "hex"),
      };
    });
}

function refusesLinkedAncestor(ancestor: string) {
  const h = fixture();
  const outside = fixture();
  const link = resolve(h.root, ancestor);
  const target = ancestor === "android" ? join(outside.root, "android") : outside.root;
  const externalBefore = snapshot(outside.root);
  const sourceBefore = readFileSync(join(h.root, modulePath));
  try {
    assert.ok(link.startsWith(h.root + sep));
    assert.equal(realpathSync(dirname(link)), dirname(link));
    if (ancestor === "android") {
      const parked = join(h.root, "original-android");
      assert.equal(realpathSync(link), link);
      assert.equal(dirname(resolve(parked)), h.root);
      renameSync(link, parked);
    }
    symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => {
      applyPatch(h.root);
    }, /linked native path/);
    assert.deepEqual(snapshot(outside.root), externalBefore);
    assert.deepEqual(readFileSync(join(h.root, modulePath)), sourceBefore);
    assert.equal(
      lstatSync(
        join(h.root, "android/src/main/java/expo/modules/securestore/SecureStorePreferences.kt"),
        { throwIfNoEntry: false },
      ),
      undefined,
    );
    assert.deepEqual(
      readFileSync(join(h.root, "android/build.gradle")),
      readFileSync(new URL("pristine/build.gradle", assets)),
    );
  } finally {
    if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) {
      const parent = realpathSync(dirname(link));
      assert.ok(parent === h.root || parent.startsWith(h.root + sep));
      assert.equal(realpathSync(link), target);
      unlinkSync(link); // Unlink the junction itself, never recursively remove its target.
    }
    h.close();
    outside.close();
  }
}

void it("patches the pinned native module faithfully, verifies it, and reapplies without changing bytes", () => {
  const h = fixture();
  try {
    assert.throws(() => {
      verifyPatch(h.root);
    }, /not fully patched/);
    applyPatch(h.root);
    verifyPatch(h.root);
    const first = readFileSync(join(h.root, modulePath));
    assert.deepEqual(first, readFileSync(new URL("upstream/SecureStoreModule.kt", assets)));
    applyPatch(h.root);
    assert.deepEqual(readFileSync(join(h.root, modulePath)), first);
  } finally {
    h.close();
  }
});

void it("refuses dependency/source drift and linked ancestors before modifying any file", () => {
  for (const drift of ["version", "source"]) {
    const h = fixture();
    try {
      const target = join(h.root, drift === "version" ? "package.json" : modulePath);
      writeFileSync(
        target,
        drift === "version" ? '{"version":"58.0.3"}' : "unexpected native source",
      );
      const original = readFileSync(join(h.root, modulePath));
      assert.throws(() => {
        applyPatch(h.root);
      }, /secure-store patch/);
      assert.deepEqual(readFileSync(join(h.root, modulePath)), original);
      assert.deepEqual(
        readFileSync(join(h.root, "android/build.gradle")),
        readFileSync(new URL("pristine/build.gradle", assets)),
      );
    } finally {
      h.close();
    }
  }
  for (const ancestor of ["android", "android/src/test"]) refusesLinkedAncestor(ancestor);
});

void it("refuses a partial patch or modified native test payload instead of silently completing it", () => {
  for (const drift of ["partial", "test"]) {
    const h = fixture();
    try {
      applyPatch(h.root);
      const target =
        drift === "partial"
          ? modulePath
          : "android/src/test/java/expo/modules/securestore/SecureStoreCommitIntegrationTest.kt";
      const body =
        drift === "partial"
          ? readFileSync(new URL("pristine/SecureStoreModule.kt", assets))
          : "modified test";
      writeFileSync(join(h.root, target), body);
      assert.throws(() => {
        applyPatch(h.root);
      }, /unrecognized or partial/);
      assert.throws(() => {
        verifyPatch(h.root);
      }, /unrecognized or partial/);
      assert.deepEqual(readFileSync(join(h.root, target)), Buffer.from(body));
    } finally {
      h.close();
    }
  }
});

void it("accepts native RED evidence only for the actual setter assertion, never a setup failure or skipped test", () => {
  const report =
    '<testsuite tests="1" failures="1" errors="0" skipped="0"><testcase name="failedEncryptedWriteIsRejectedAndCanRetry"><failure type="java.lang.AssertionError">expected expo.modules.securestore.WriteException to be thrown, but nothing was thrown</failure></testcase></testsuite>';
  assert.doesNotThrow(() => {
    assertExpectedRed({ status: 1, report });
  });
  for (const invalid of [
    { status: 0, report },
    { status: 1, report: "Compilation failed" },
    { status: 1, report: report.replace('skipped="0"', 'skipped="1"') },
    {
      status: 1,
      report: report.replace("java.lang.AssertionError", "java.lang.IllegalStateException"),
    },
    {
      status: 1,
      report: report.replace(
        "expected expo.modules.securestore.WriteException to be thrown, but nothing was thrown",
        "Directory setup failed",
      ),
    },
  ])
    assert.throws(() => {
      assertExpectedRed(invalid);
    });
});

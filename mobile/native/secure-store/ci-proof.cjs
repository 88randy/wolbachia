const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { resolvePackageRoot, verifyBuildConfiguration, verifyPatch } = require("./patch.cjs");
const manifest = require("./manifest.json");

const CLASS = "expo.modules.securestore.SecureStoreCommitIntegrationTest";
const REGRESSION = "failedEncryptedWriteIsRejectedAndCanRetry";
const OUTPUT = join(__dirname, "../../../build/secure-store-commit");

function counts(report, expected) {
  for (const [name, value] of Object.entries(expected)) {
    assert.match(report, new RegExp(`\\b${name}="${value}"`), `Unexpected JUnit ${name}`);
  }
}

function assertExpectedRed(result) {
  assert.notEqual(result.status, 0, "The unpatched native setter unexpectedly passed");
  counts(result.report, { tests: 1, failures: 1, errors: 0, skipped: 0 });
  assert.match(result.report, new RegExp(`name="${REGRESSION}"`));
  assert.match(result.report, /<failure[^>]*type="java.lang.AssertionError"/);
  assert.match(
    result.report,
    /expected expo\.modules\.securestore\.WriteException to be thrown, but nothing was thrown/,
  );
}

function runGradle(test) {
  return spawnSync(
    "./gradlew",
    [
      ":expo-secure-store:testDebugUnitTest",
      "--tests",
      test,
      `-PreactNativeArchitectures=${process.env.ABIS}`,
      "--max-workers=1",
      "--no-daemon",
      "--stacktrace",
    ],
    {
      cwd: join(__dirname, "../../android"),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
}

function runNative(packageRoot, test, label) {
  const reportPath = join(
    packageRoot,
    `android/build/test-results/testDebugUnitTest/TEST-${CLASS}.xml`,
  );
  if (existsSync(reportPath)) unlinkSync(reportPath);
  console.log(`Running native ${label}: ${test}`);
  const result = runGradle(test);
  writeFileSync(join(OUTPUT, `${label}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}`);
  assert.ifError(result.error);
  assert.notEqual(result.status, null, "Gradle must exit normally");
  assert.ok(
    existsSync(reportPath),
    "Missing native JUnit report: setup/compilation is not regression evidence",
  );
  const report = readFileSync(reportPath, "utf8");
  writeFileSync(join(OUTPUT, `${label}.xml`), report);
  return { status: result.status, report };
}

function runRed(packageRoot) {
  const entry = manifest.files.find((file) => file.payload === "upstream/SecureStoreModule.kt");
  const original = readFileSync(join(__dirname, "pristine/SecureStoreModule.kt"));
  assert.equal(createHash("sha256").update(original).digest("hex"), entry.original);
  let result;
  try {
    writeFileSync(join(packageRoot, entry.target), original);
    result = runNative(packageRoot, `${CLASS}.${REGRESSION}`, "red");
  } finally {
    writeFileSync(join(packageRoot, entry.target), readFileSync(join(__dirname, entry.payload)));
    verifyPatch(packageRoot);
  }
  assertExpectedRed(result);
}

function main() {
  assert.ok(
    process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_JOB === "debug-apk",
    "Native proof runs only in the existing debug-apk CI job",
  );
  verifyBuildConfiguration();
  const packageRoot = resolvePackageRoot();
  verifyPatch(packageRoot);
  mkdirSync(OUTPUT, { recursive: true });
  runRed(packageRoot);
  const green = runNative(packageRoot, CLASS, "green");
  assert.equal(green.status, 0, "Patched native setter regression must pass");
  counts(green.report, { tests: 3, failures: 0, errors: 0, skipped: 0 });
  console.log("Native setter RED (expected assertion) and GREEN (3 tests) verified");
}

module.exports = { assertExpectedRed };
if (require.main === module) main();

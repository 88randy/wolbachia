const { createHash } = require("node:crypto");
const { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, isAbsolute, join, relative, resolve, sep } = require("node:path");
const manifest = require("./manifest.json");

function ensure(condition, message) {
  if (!condition)
    throw new Error(
      `secure-store patch: ${message}. Reinstall and review the pinned upstream backport.`,
    );
}

function digest(body) {
  return createHash("sha256").update(body).digest("hex");
}

function resolvePackageRoot() {
  return dirname(
    require.resolve("expo-secure-store/package.json", { paths: [join(__dirname, "../..")] }),
  );
}

function verifyBuildConfiguration() {
  const mobile = require("../../package.json");
  ensure(
    mobile.dependencies["expo-secure-store"] === manifest.version,
    "mobile dependency must use the exact pinned version",
  );
  ensure(
    mobile.expo?.autolinking?.android?.buildFromSource?.includes("expo-secure-store"),
    "expo-secure-store must build from source, never its prebuilt AAR",
  );
}

function preflightTarget(packageRoot, target) {
  const destination = resolve(packageRoot, target);
  const child = relative(packageRoot, destination);
  ensure(
    child && !isAbsolute(child) && child.split(sep)[0] !== "..",
    `native target escapes package: ${target}`,
  );
  let current = packageRoot;
  for (const segment of ["", ...child.split(sep)]) {
    current = join(current, segment);
    const stat = lstatSync(current, { throwIfNoEntry: false });
    ensure(!stat?.isSymbolicLink(), `linked native path is not supported: ${current}`);
  }
  return destination;
}

function inspectFile(target, entry) {
  const payload = readFileSync(join(__dirname, entry.payload));
  ensure(digest(payload) === entry.patched, `payload hash mismatch: ${entry.payload}`);
  const current = existsSync(target) ? digest(readFileSync(target)) : null;
  return {
    target,
    payload,
    original: current === entry.original,
    patched: current === entry.patched,
  };
}

function inspect(packageRoot) {
  packageRoot = resolve(packageRoot);
  // Check every existing ancestor of every target before reading or writing package payloads.
  const targets = manifest.files.map((entry) => preflightTarget(packageRoot, entry.target));
  const installed = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  ensure(
    installed.version === manifest.version,
    `expected ${manifest.version}, received ${installed.version}`,
  );
  const files = manifest.files.map((entry, index) => inspectFile(targets[index], entry));
  const original = files.every((file) => file.original);
  const patched = files.every((file) => file.patched);
  ensure(original || patched, "unrecognized or partial native package state");
  return { files, original, patched };
}

function applyPatch(packageRoot) {
  const state = inspect(packageRoot);
  if (state.patched) return;
  for (const file of state.files) {
    mkdirSync(dirname(file.target), { recursive: true });
    writeFileSync(file.target, file.payload);
  }
  verifyPatch(packageRoot);
}

function verifyPatch(packageRoot) {
  ensure(inspect(packageRoot).patched, "native package is not fully patched");
}

module.exports = { applyPatch, verifyPatch, resolvePackageRoot, verifyBuildConfiguration };

if (require.main === module) {
  ensure(process.argv[2] === "verify", "supported CLI command: verify");
  verifyBuildConfiguration();
  verifyPatch(resolvePackageRoot());
  console.log(
    `Verified expo-secure-store ${manifest.version} source backport ${manifest.upstreamCommit}`,
  );
}

const { withDangerousMod } = require("expo/config-plugins");
const {
  applyPatch,
  resolvePackageRoot,
  verifyBuildConfiguration,
} = require("../native/secure-store/patch.cjs");

// This source-only native backport must also opt out of Expo's precompiled AAR.
module.exports = function withSecureStoreCommit(config) {
  return withDangerousMod(config, [
    "android",
    (mod) => {
      verifyBuildConfiguration();
      applyPatch(resolvePackageRoot());
      return mod;
    },
  ]);
};

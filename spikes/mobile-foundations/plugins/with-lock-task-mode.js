// Expo config plugin: set android:lockTaskMode="if_whitelisted" on MainActivity.
// Android docs (https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode, "Start lock task mode"):
// "To have the system automatically run your activity in lock task mode, set the android:lockTaskMode
// attribute to if_whitelisted". It is declarative, so it also applies after an app update relaunch
// (see PackageReplacedReceiver) and needs no JavaScript to be running. The same page warns not to start
// lock task while the device is locked; a manifest attribute leaves that to the system.
// It only takes effect for a package the Device Owner allowlisted with setLockTaskPackages.
const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const LOCK_TASK_MODE = "if_whitelisted";

module.exports = function withLockTaskMode(config) {
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity.$["android:lockTaskMode"] = LOCK_TASK_MODE;
    return mod;
  });
};

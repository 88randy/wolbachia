package expo.modules.devicecontrol

import android.app.admin.DeviceAdminReceiver

/**
 * Empty admin receiver. It only has to exist so that
 * `adb shell dpm set-device-owner <package>/expo.modules.devicecontrol.SpikeDeviceAdminReceiver`
 * can make this app the Device Owner. Throwaway spike code.
 */
class SpikeDeviceAdminReceiver : DeviceAdminReceiver()

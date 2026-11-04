package expo.modules.devicecontrol

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * After a self-update Android kills the app and does not restart it by itself.
 * This receiver tries to relaunch the app. Whether Android lets a background receiver start an
 * activity (background activity launch limits, Android 10+) is part of what the spike measures.
 */
class PackageReplacedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Log.i(TAG, "MY_PACKAGE_REPLACED received, trying to relaunch")
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    if (launch == null) {
      Log.e(TAG, "No launch intent for ${context.packageName}")
      return
    }
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(launch)
    } catch (e: RuntimeException) {
      Log.e(TAG, "Relaunch after update failed", e)
    }
  }

  companion object {
    private const val TAG = "DeviceControl"
  }
}

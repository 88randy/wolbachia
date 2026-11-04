package expo.modules.devicecontrol

import android.app.ActivityManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.StatFs
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ExecutionException
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

class DeviceControlException(message: String, cause: Throwable? = null) : CodedException(message, cause)

/**
 * Throwaway spike module. Everything here is the part of the Dedicated-mode / in-app-update /
 * "how to get there" spike items that can only be done from native Android code.
 *
 * Sources used (official Android docs):
 * - Lock task mode: https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode
 * - Silent install by Device Owner via PackageInstaller:
 *   https://developer.android.com/work/dpc/dedicated-devices/cookbook#install-app-packages
 */
class DeviceControlModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val dpm: DevicePolicyManager
    get() = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  private val adminComponent: ComponentName
    get() = ComponentName(context, SpikeDeviceAdminReceiver::class.java)

  override fun definition() = ModuleDefinition {
    Name("DeviceControl")

    Events("onDownloadProgress", "onInstallStatus")

    OnCreate { instance = this@DeviceControlModule }
    OnDestroy { if (instance === this@DeviceControlModule) instance = null }

    // ---- Dedicated mode -------------------------------------------------------------------

    Function("getDeviceStatus") { readDeviceStatus() }

    AsyncFunction("enableLockTask") { extraPackages: List<String> -> enableLockTask(extraPackages) }

    AsyncFunction("disableLockTask") { clearAllowlist: Boolean -> disableLockTask(clearAllowlist) }

    // Test cleanup only: lets the owner re-run provisioning without a factory reset.
    AsyncFunction("clearDeviceOwner") { clearDeviceOwner() }

    // ---- "How to get there" ---------------------------------------------------------------

    Function("isPackageInstalled") { packageName: String -> isPackageInstalled(packageName) }

    AsyncFunction("openGeoUri") { uri: String, packageName: String? -> openGeoUri(uri, packageName) }

    // ---- In-app APK update ----------------------------------------------------------------

    // Long operations use the Coroutine variant and hop to Dispatchers.IO. A plain AsyncFunction runs on the
    // single-threaded "expo.modules.AsyncFunctionQueue" (expo-modules-core AppContext.kt), so a long download
    // there would stall every other async call of every module until it ended.
    AsyncFunction("downloadApk") Coroutine { url: String, expectedSha256: String, allowHttp: Boolean ->
      withContext(Dispatchers.IO) { downloadApk(url, expectedSha256, allowHttp) }
    }

    AsyncFunction("installApk") Coroutine { path: String ->
      withContext(Dispatchers.IO) { installApk(path) }
    }

    AsyncFunction("discardDownloadedApk") Coroutine {
      withContext(Dispatchers.IO) { discardDownloadedApk() }
    }
  }

  // ---------------------------------------------------------------------------------------
  // Dedicated mode
  // ---------------------------------------------------------------------------------------

  private fun readDeviceStatus(): Map<String, Any?> {
    val pkg = context.packageName
    val info = context.packageManager.getPackageInfo(pkg, 0)
    val versionCode: Long = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      info.longVersionCode
    } else {
      @Suppress("DEPRECATION")
      info.versionCode.toLong()
    }
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val lockState = when (activityManager.lockTaskModeState) {
      ActivityManager.LOCK_TASK_MODE_NONE -> "none"
      ActivityManager.LOCK_TASK_MODE_LOCKED -> "locked"
      ActivityManager.LOCK_TASK_MODE_PINNED -> "pinned"
      else -> "unknown"
    }
    return mapOf(
      "packageName" to pkg,
      "adminComponent" to adminComponent.flattenToShortString(),
      "isDeviceOwner" to dpm.isDeviceOwnerApp(pkg),
      "isAdminActive" to dpm.isAdminActive(adminComponent),
      "isLockTaskPermitted" to dpm.isLockTaskPermitted(pkg),
      "lockTaskModeState" to lockState,
      "sdkInt" to Build.VERSION.SDK_INT,
      "manufacturer" to Build.MANUFACTURER,
      "model" to Build.MODEL,
      "versionName" to info.versionName,
      "versionCode" to versionCode,
      "lastUpdateTime" to info.lastUpdateTime,
      "freeBytes" to StatFs(context.filesDir.absolutePath).availableBytes
    )
  }

  private fun enableLockTask(extraPackages: List<String>) {
    val pkg = context.packageName
    if (!dpm.isDeviceOwnerApp(pkg)) {
      throw DeviceControlException("This app is not the Device Owner. Provision it first (see README).")
    }
    // Allowlist ourselves plus any extra package (for example Organic Maps), otherwise lock task
    // mode blocks launching it.
    val allowlist = (listOf(pkg) + extraPackages).distinct().toTypedArray()
    dpm.setLockTaskPackages(adminComponent, allowlist)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      // Keep battery / connectivity icons and the power menu. [ASSUMPTION] final feature set is a
      // product decision, see REPORT.md.
      dpm.setLockTaskFeatures(
        adminComponent,
        DevicePolicyManager.LOCK_TASK_FEATURE_SYSTEM_INFO or DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS
      )
    }
    runOnUiThreadAndWait { appContext.throwingActivity.startLockTask() }
  }

  private fun disableLockTask(clearAllowlist: Boolean) {
    runOnUiThreadAndWait { appContext.throwingActivity.stopLockTask() }
    if (clearAllowlist) {
      dpm.setLockTaskPackages(adminComponent, emptyArray())
    }
  }

  @Suppress("DEPRECATION")
  private fun clearDeviceOwner() {
    val pkg = context.packageName
    if (!dpm.isDeviceOwnerApp(pkg)) {
      throw DeviceControlException("This app is not the Device Owner.")
    }
    dpm.clearDeviceOwnerApp(pkg)
  }

  /** Runs [block] on the UI thread and rethrows whatever it threw as a coded exception. */
  private fun runOnUiThreadAndWait(block: () -> Unit) {
    val activity = appContext.throwingActivity
    val task = FutureTask<Unit> { block() }
    activity.runOnUiThread(task)
    try {
      task.get(5, TimeUnit.SECONDS)
    } catch (e: ExecutionException) {
      throw DeviceControlException(e.cause?.message ?: "UI thread call failed", e.cause ?: e)
    }
  }

  // ---------------------------------------------------------------------------------------
  // How to get there
  // ---------------------------------------------------------------------------------------

  private fun isPackageInstalled(packageName: String): Boolean {
    return try {
      context.packageManager.getPackageInfo(packageName, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      // Expected branch: the package is simply not installed (or not visible, see <queries>).
      false
    }
  }

  /**
   * Returns "opened", "not_installed" (the requested package is missing), "no_handler" or
   * "blocked_by_lock_task" (lock task is active and the app that would open is not allowlisted, so
   * Android would refuse to start it).
   */
  private fun openGeoUri(uri: String, packageName: String?): String {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (packageName != null) {
      if (!isPackageInstalled(packageName)) return "not_installed"
      intent.setPackage(packageName)
    }
    return try {
      val target = intent.resolveActivity(context.packageManager)?.packageName ?: packageName
      if (isLockTaskActive() && (target == null || !dpm.isLockTaskPermitted(target))) {
        return "blocked_by_lock_task"
      }
      context.startActivity(intent)
      "opened"
    } catch (e: ActivityNotFoundException) {
      "no_handler"
    } catch (e: RuntimeException) {
      // SecurityException and friends: lock task or policy refused the launch.
      throw DeviceControlException("Could not open the map app: ${e.message}", e)
    }
  }

  private fun isLockTaskActive(): Boolean {
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return activityManager.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_LOCKED
  }

  // ---------------------------------------------------------------------------------------
  // In-app APK update
  // ---------------------------------------------------------------------------------------

  private val updatesDir: File
    get() = File(context.filesDir, "updates").also { it.mkdirs() }

  private val apkFile: File
    get() = File(updatesDir, "update.apk")

  private val partFile: File
    get() = File(updatesDir, "update.apk.part")

  /** Remembers which URL and which version of the file (ETag or Last-Modified) the .part belongs to. */
  private val partMetaFile: File
    get() = File(updatesDir, "update.apk.part.meta")

  private class RangeRejected : IOException("HTTP 416")

  /**
   * Downloads [url] to app storage. Resumes a previous partial download with an HTTP Range request
   * guarded by If-Range (RFC 9110 section 13.1.5: the server sends the missing bytes only if the
   * validator still matches, otherwise the whole new file). The .part is dropped when the URL changed,
   * when no validator was stored, or when the server answers 416. Verifies SHA-256 when
   * [expectedSha256] is not blank. Plain http is refused unless [allowHttp] is true (spike convenience).
   * Runs on Dispatchers.IO (see the registration).
   */
  private fun downloadApk(url: String, expectedSha256: String, allowHttp: Boolean): Map<String, Any?> {
    val parsed = URL(url)
    if (parsed.protocol != "https" && !(allowHttp && parsed.protocol == "http")) {
      throw DeviceControlException("Only https URLs are allowed (got ${parsed.protocol}).")
    }
    apkFile.delete()
    dropPartIfStale(url)
    try {
      transfer(parsed, url)
    } catch (e: RangeRejected) {
      // The saved offset is no longer valid: start again from zero, once.
      deletePart()
      transfer(parsed, url)
    }
    return finishDownload(expectedSha256)
  }

  private fun deletePart() {
    partFile.delete()
    partMetaFile.delete()
  }

  private fun readPartMeta(): Pair<String, String>? {
    val lines = if (partMetaFile.exists()) partMetaFile.readLines() else return null
    return if (lines.size >= 2) Pair(lines[0], lines[1]) else null
  }

  private fun dropPartIfStale(url: String) {
    if (!partFile.exists()) return
    val meta = readPartMeta()
    if (meta == null || meta.first != url || meta.second.isBlank()) deletePart()
  }

  private fun transfer(parsed: URL, url: String) {
    val part = partFile
    var existing = if (part.exists()) part.length() else 0L
    val validator = readPartMeta()?.second
    val connection = parsed.openConnection() as HttpURLConnection
    connection.connectTimeout = 15_000
    connection.readTimeout = 30_000
    if (existing > 0 && validator != null) {
      connection.setRequestProperty("Range", "bytes=$existing-")
      connection.setRequestProperty("If-Range", validator)
    }
    try {
      val code = connection.responseCode
      if (code == HttpURLConnection.HTTP_BAD_RANGE) throw RangeRejected()
      val append = code == HttpURLConnection.HTTP_PARTIAL
      if (code != HttpURLConnection.HTTP_OK && !append) {
        throw DeviceControlException("Download failed: HTTP $code")
      }
      if (!append) existing = 0L
      val validatorNow = connection.getHeaderField("ETag") ?: connection.getHeaderField("Last-Modified") ?: ""
      partMetaFile.writeText("$url\n$validatorNow\n")
      copyBody(connection, part, append, existing)
    } catch (e: IOException) {
      if (e is RangeRejected) throw e
      // The .part file is kept on purpose so a retry can resume.
      throw DeviceControlException("Download interrupted: ${e.message}. Retry to resume.", e)
    } finally {
      connection.disconnect()
    }
  }

  private fun copyBody(connection: HttpURLConnection, part: File, append: Boolean, existing: Long) {
    val remaining = connection.contentLengthLong
    val total = if (remaining >= 0) existing + remaining else -1L
    // Installing needs the downloaded file plus the copy inside the install session.
    val needed = if (remaining >= 0) remaining * 2 else 0L
    val free = StatFs(updatesDir.absolutePath).availableBytes
    if (needed > free) {
      throw DeviceControlException("Not enough free storage: need about $needed bytes, have $free.")
    }
    var downloaded = existing
    var lastEmit = 0L
    connection.inputStream.use { input ->
      FileOutputStream(part, append).use { output ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          output.write(buffer, 0, read)
          downloaded += read
          val now = System.currentTimeMillis()
          if (now - lastEmit > 250) {
            lastEmit = now
            sendEvent("onDownloadProgress", mapOf("downloaded" to downloaded, "total" to total))
          }
        }
      }
    }
    sendEvent("onDownloadProgress", mapOf("downloaded" to downloaded, "total" to total))
    if (total >= 0 && downloaded != total) {
      throw DeviceControlException("Download incomplete: $downloaded of $total bytes. Retry to resume.")
    }
  }

  private fun finishDownload(expectedSha256: String): Map<String, Any?> {
    val part = partFile
    val actual = sha256Hex(part)
    if (expectedSha256.isNotBlank() && !actual.equals(expectedSha256.trim(), ignoreCase = true)) {
      deletePart()
      throw DeviceControlException("SHA-256 mismatch. Expected $expectedSha256 but got $actual.")
    }
    if (!part.renameTo(apkFile)) {
      throw DeviceControlException("Could not move the downloaded file into place.")
    }
    partMetaFile.delete()
    return mapOf("path" to apkFile.absolutePath, "bytes" to apkFile.length(), "sha256" to actual)
  }

  private fun sha256Hex(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun discardDownloadedApk() {
    apkFile.delete()
    deletePart()
  }

  /**
   * Streams the APK into a PackageInstaller session and commits it.
   * On a Device Owner device Android installs without asking (docs, cookbook "Install app
   * packages"). On other devices the user gets the system confirmation (see InstallStatusReceiver).
   * When the package being installed is this very app, Android kills the process on success.
   * If anything fails before commit, the session is abandoned so it does not leak (PackageInstaller
   * keeps uncommitted sessions until they are abandoned or expire).
   */
  private fun installApk(path: String) {
    val file = File(path)
    if (!file.exists()) throw DeviceControlException("APK not found: $path")

    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    params.setAppPackageName(context.packageName)
    val sessionId = installer.createSession(params)
    try {
      installer.openSession(sessionId).use { session ->
        file.inputStream().use { input ->
          session.openWrite("update.apk", 0, file.length()).use { output ->
            input.copyTo(output)
            session.fsync(output)
          }
        }
        session.commit(statusIntentSender(sessionId))
      }
    } catch (e: IOException) {
      installer.abandonSession(sessionId)
      throw DeviceControlException("Install failed before commit: ${e.message}", e)
    } catch (e: RuntimeException) {
      installer.abandonSession(sessionId)
      throw DeviceControlException("Install failed before commit: ${e.message}", e)
    }
  }

  private fun statusIntentSender(sessionId: Int): android.content.IntentSender {
    val intent = Intent(context, InstallStatusReceiver::class.java).setAction(InstallStatusReceiver.ACTION)
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      // The system adds extras to this intent, so it must be mutable on Android 12+.
      flags = flags or PendingIntent.FLAG_MUTABLE
    }
    return PendingIntent.getBroadcast(context, sessionId, intent, flags).intentSender
  }

  companion object {
    @Volatile
    private var instance: DeviceControlModule? = null

    fun emitInstallStatus(status: Int, message: String?) {
      val module = instance ?: return
      module.sendEvent(
        "onInstallStatus",
        mapOf("status" to status, "statusName" to statusName(status), "message" to message)
      )
    }

    private fun statusName(status: Int): String = when (status) {
      PackageInstaller.STATUS_SUCCESS -> "SUCCESS"
      PackageInstaller.STATUS_PENDING_USER_ACTION -> "PENDING_USER_ACTION"
      PackageInstaller.STATUS_FAILURE -> "FAILURE"
      PackageInstaller.STATUS_FAILURE_ABORTED -> "FAILURE_ABORTED"
      PackageInstaller.STATUS_FAILURE_BLOCKED -> "FAILURE_BLOCKED"
      PackageInstaller.STATUS_FAILURE_CONFLICT -> "FAILURE_CONFLICT"
      PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "FAILURE_INCOMPATIBLE"
      PackageInstaller.STATUS_FAILURE_INVALID -> "FAILURE_INVALID"
      PackageInstaller.STATUS_FAILURE_STORAGE -> "FAILURE_STORAGE"
      else -> "UNKNOWN_$status"
    }
  }
}

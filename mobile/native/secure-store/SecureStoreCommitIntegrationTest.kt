package expo.modules.securestore

import android.content.Context
import expo.modules.core.ModuleRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.security.Key
import java.security.KeyStore
import java.security.KeyStoreSpi
import java.security.Provider
import java.security.cert.Certificate
import java.util.Collections
import java.util.Date
import java.util.Enumeration
import javax.crypto.KeyGenerator
import kotlin.coroutines.Continuation
import kotlin.coroutines.intrinsics.suspendCoroutineUninterceptedOrReturn

/** Exercises the real native setter, AES encryptor and Android preferences; no copied write helper. */
@RunWith(RobolectricTestRunner::class)
class SecureStoreCommitIntegrationTest {
  @Test
  fun failedEncryptedWriteIsRejectedAndCanRetry() {
    val fixture = SecureStoreFixture()
    fixture.write("previous")
    val previousFile = fixture.file.readBytes()

    fixture.withReadOnlyDirectory {
      assertThrows(WriteException::class.java) { fixture.write("candidate") }
      assertArrayEquals(previousFile, fixture.file.readBytes())
      assertEquals("previous", fixture.read())
    }

    // A later successful disk write must not resurrect the refused in-memory candidate.
    assertTrue(fixture.prefs.edit().putString("unrelated", "value").commit())
    assertEquals("previous", fixture.read())
    val beforeRetry = fixture.file.readBytes()
    fixture.write("candidate")
    assertEquals("candidate", fixture.read())
    assertTrue(!beforeRetry.contentEquals(fixture.file.readBytes()))
  }

  @Test
  fun failedNullWritePreservesThePreviousValue() {
    val fixture = SecureStoreFixture()
    fixture.write("previous")
    fixture.withReadOnlyDirectory {
      assertThrows(WriteException::class.java) { fixture.write(null) }
      assertEquals("previous", fixture.read())
    }
    fixture.write(null)
    assertNull(fixture.read())
  }

  @Test
  fun failedDeletePreservesThePreviousValue() {
    val fixture = SecureStoreFixture()
    fixture.write("previous")
    fixture.withReadOnlyDirectory {
      assertThrows(DeleteException::class.java) { fixture.delete() }
      assertEquals("previous", fixture.read())
    }
    fixture.delete()
    assertNull(fixture.read())
  }
}

private class SecureStoreFixture {
  private val context: Context = RuntimeEnvironment.getApplication()
  private val options = SecureStoreOptions(requireAuthentication = false)
  private val module = object : SecureStoreModule() {
    override val reactContext: Context = context
  }
  private val key = "synthetic-credentials"
  val prefs = module.getSharedPreferences()
  private val directory = File(context.applicationInfo.dataDir, "shared_prefs")
  val file = File(directory, "SecureStore.xml")

  init {
    // The test supplies key material only. Production AES/GCM and persistence remain real.
    setField("keyStore", TestKeyStore())
    setField("authenticationHelper", AuthenticationHelper(context, ModuleRegistry(emptyList(), emptyList())))
  }

  fun write(value: String?) = runBlocking {
    invokeSuspending(
      method("setItemImpl", String::class.java, String::class.java, SecureStoreOptions::class.java, java.lang.Boolean.TYPE, Continuation::class.java),
      key, value, options, false
    )
    Unit
  }

  fun read(): String? = runBlocking {
    invokeSuspending(method("getItemImpl", String::class.java, SecureStoreOptions::class.java, Continuation::class.java), key, options) as String?
  }

  fun delete() {
    try {
      method("deleteItemImpl", String::class.java, SecureStoreOptions::class.java).invoke(module, key, options)
    } catch (error: InvocationTargetException) {
      throw error.targetException
    }
  }

  fun withReadOnlyDirectory(block: () -> Unit) {
    assertTrue("The disk-failure injection must be active, never skipped", directory.setWritable(false))
    try {
      block()
    } finally {
      assertTrue("Restore only this test's directory permissions", directory.setWritable(true))
    }
  }

  private fun setField(name: String, value: Any) {
    SecureStoreModule::class.java.getDeclaredField(name).apply { isAccessible = true }.set(module, value)
  }

  private fun method(name: String, vararg types: Class<*>): Method =
    SecureStoreModule::class.java.getDeclaredMethod(name, *types).apply { isAccessible = true }

  private suspend fun invokeSuspending(method: Method, vararg arguments: Any?): Any? =
    suspendCoroutineUninterceptedOrReturn { continuation: Continuation<Any?> ->
      try {
        method.invoke(module, *arguments, continuation)
      } catch (error: InvocationTargetException) {
        throw error.targetException
      }
    }
}

/** Test-only provider: no device keystore, credentials or native/React runtime initialization. */
private class TestKeyStore : KeyStore(
  TestKeyStoreSpi(),
  object : Provider("WolbachiaTest", 1.0, "Ephemeral test AES key") {},
  "WolbachiaTest"
) {
  init { load(null, null) }
}

private class TestKeyStoreSpi : KeyStoreSpi() {
  private val entry = KeyStore.SecretKeyEntry(KeyGenerator.getInstance("AES").apply { init(256) }.generateKey())

  override fun engineGetEntry(alias: String, protection: KeyStore.ProtectionParameter?): KeyStore.Entry = entry
  override fun engineContainsAlias(alias: String): Boolean = true
  override fun engineGetKey(alias: String, password: CharArray?): Key = entry.secretKey
  override fun engineAliases(): Enumeration<String> = Collections.enumeration(listOf("ephemeral"))
  override fun engineSize(): Int = 1
  override fun engineIsKeyEntry(alias: String): Boolean = true
  override fun engineIsCertificateEntry(alias: String): Boolean = false
  override fun engineGetCertificate(alias: String): Certificate? = null
  override fun engineGetCertificateChain(alias: String): Array<Certificate>? = null
  override fun engineGetCertificateAlias(certificate: Certificate): String? = null
  override fun engineGetCreationDate(alias: String): Date = Date(0)
  override fun engineLoad(stream: InputStream?, password: CharArray?) = Unit
  override fun engineStore(stream: OutputStream?, password: CharArray?) = unsupported()
  override fun engineDeleteEntry(alias: String) = unsupported()
  override fun engineSetCertificateEntry(alias: String, certificate: Certificate) = unsupported()
  override fun engineSetKeyEntry(alias: String, key: Key, password: CharArray?, chain: Array<Certificate>?) = unsupported()
  override fun engineSetKeyEntry(alias: String, key: ByteArray, chain: Array<Certificate>?) = unsupported()
  private fun unsupported(): Nothing = throw UnsupportedOperationException("Not used by the real secure-store write/read path")
}

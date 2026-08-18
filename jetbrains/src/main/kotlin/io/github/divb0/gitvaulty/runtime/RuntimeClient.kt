package io.github.divb0.gitvaulty.runtime

import com.google.gson.Gson
import com.google.gson.JsonObject
import java.io.Closeable
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.nio.file.Path
import java.util.Base64
import java.util.UUID
import kotlin.concurrent.thread

data class OpenedDocument(
  val logicalPath: String,
  val plaintext: String,
  val fingerprint: String,
  val users: List<String>,
)

data class SavedDocument(val fingerprint: String)
data class DocumentAccess(val logicalPath: String, val users: List<String>)

class RuntimeClient(installed: InstalledRuntime) : Closeable {
  private val gson = Gson()
  private val process: Process
  private val input: DataInputStream
  private val output: DataOutputStream

  init {
    val builder = ProcessBuilder(installed.executable.toString())
    builder.environment()["GITVAULTY_SOPS"] = installed.sops.toString()
    process = try { builder.start() }
    catch (error: Exception) { throw GitVaultyRuntimeException("Could not start the GitVaulty editor runtime.", error) }
    input = DataInputStream(process.inputStream.buffered())
    output = DataOutputStream(process.outputStream.buffered())
    thread(name = "GitVaulty runtime diagnostics", isDaemon = true) {
      process.errorStream.use { it.copyTo(OutputStream.nullOutputStream()) }
    }
    try {
      val ping = request("ping", JsonObject())
      if (ping.get("protocolVersion")?.asInt != PROTOCOL_VERSION) throw GitVaultyProtocolException("GitVaulty runtime protocol mismatch.")
    } catch (error: Exception) {
      close()
      throw error
    }
  }

  @Synchronized
  fun open(sourcePath: Path): OpenedDocument {
    val result = request("open", JsonObject().apply { addProperty("sourcePath", sourcePath.toAbsolutePath().normalize().toString()) })
    val plaintext = decodeText(result.requiredString("plaintext"))
    return OpenedDocument(
      logicalPath = result.requiredString("logicalPath"),
      plaintext = plaintext,
      fingerprint = result.requiredString("fingerprint"),
      users = result.getAsJsonArray("users")?.map { it.asString } ?: emptyList(),
    )
  }

  @Synchronized
  fun save(sourcePath: Path, plaintext: String, expectedFingerprint: String): SavedDocument {
    if (plaintext.indexOf('\u0000') >= 0) throw GitVaultyInvalidTextException("GitVaulty native editors do not support NUL bytes.")
    val params = JsonObject().apply {
      addProperty("sourcePath", sourcePath.toAbsolutePath().normalize().toString())
      addProperty("plaintext", Base64.getEncoder().encodeToString(plaintext.toByteArray(StandardCharsets.UTF_8)))
      addProperty("expectedFingerprint", expectedFingerprint)
    }
    return SavedDocument(request("save", params).requiredString("fingerprint"))
  }

  @Synchronized
  fun access(sourcePath: Path): DocumentAccess {
    val result = request("access", JsonObject().apply { addProperty("sourcePath", sourcePath.toAbsolutePath().normalize().toString()) })
    return DocumentAccess(
      logicalPath = result.requiredString("logicalPath"),
      users = result.getAsJsonArray("users")?.map { it.asString } ?: emptyList(),
    )
  }

  private fun request(method: String, params: JsonObject): JsonObject {
    if (!process.isAlive) throw GitVaultyProtocolException("GitVaulty editor runtime is not running.")
    val id = UUID.randomUUID().toString()
    val request = JsonObject().apply {
      addProperty("id", id)
      addProperty("protocolVersion", PROTOCOL_VERSION)
      addProperty("method", method)
      add("params", params)
    }
    try { FramedJson.write(output, gson.toJson(request)) }
    catch (error: GitVaultyRuntimeException) { throw error }
    catch (error: Exception) { throw GitVaultyProtocolException("Could not write to the GitVaulty runtime.", error) }

    val response = try { gson.fromJson(FramedJson.read(input), JsonObject::class.java) }
    catch (error: GitVaultyRuntimeException) { throw error }
    catch (error: Exception) { throw GitVaultyProtocolException("GitVaulty runtime returned invalid JSON.", error) }
    if (response.get("id")?.asString != id) throw GitVaultyProtocolException("GitVaulty runtime response ID mismatch.")
    if (response.get("ok")?.asBoolean == true) {
      return response.getAsJsonObject("result") ?: JsonObject()
    }
    val error = response.getAsJsonObject("error") ?: throw GitVaultyProtocolException("GitVaulty runtime returned an invalid error.")
    val message = error.get("message")?.asString ?: "GitVaulty editor operation failed."
    when (error.get("code")?.asString) {
      "CONFLICT" -> throw GitVaultyConflictException(message)
      "INVALID_TEXT" -> throw GitVaultyInvalidTextException(message)
      "GITVAULTY_ERROR" -> throw GitVaultyRuntimeException(message)
      "PROTOCOL_ERROR" -> throw GitVaultyProtocolException(message)
      else -> throw GitVaultyRuntimeException("GitVaulty editor runtime failed.")
    }
  }

  private fun decodeText(value: String): String {
    val bytes = try { Base64.getDecoder().decode(value) }
    catch (error: IllegalArgumentException) { throw GitVaultyProtocolException("GitVaulty runtime returned invalid base64.", error) }
    val text = try {
      StandardCharsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(bytes))
        .toString()
    } catch (error: Exception) {
      throw GitVaultyInvalidTextException("GitVaulty native editors support UTF-8 text only.")
    }
    if (text.indexOf('\u0000') >= 0) throw GitVaultyInvalidTextException("GitVaulty native editors do not support NUL bytes.")
    return text
  }

  override fun close() {
    runCatching { output.close() }
    runCatching { input.close() }
    process.destroy()
  }
}

private fun JsonObject.requiredString(name: String): String {
  val value = get(name)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }?.asString
  if (value.isNullOrEmpty()) throw GitVaultyProtocolException("GitVaulty runtime response is missing $name.")
  return value
}

package io.github.divb0.gitvaulty.runtime

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.EOFException
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets

internal const val PROTOCOL_VERSION = 1
internal const val MAX_FRAME_BYTES = 64 * 1024 * 1024

open class GitVaultyRuntimeException(message: String, cause: Throwable? = null) : Exception(message, cause)
class GitVaultyProtocolException(message: String, cause: Throwable? = null) : GitVaultyRuntimeException(message, cause)
class GitVaultyConflictException(message: String) : GitVaultyRuntimeException(message)
class GitVaultyInvalidTextException(message: String) : GitVaultyRuntimeException(message)

internal object FramedJson {
  fun write(output: DataOutputStream, json: String) {
    val bytes = json.toByteArray(StandardCharsets.UTF_8)
    if (bytes.size > MAX_FRAME_BYTES) throw GitVaultyProtocolException("GitVaulty runtime request is too large.")
    output.writeInt(bytes.size)
    output.write(bytes)
    output.flush()
  }

  fun read(input: DataInputStream): String {
    val size = try {
      input.readInt()
    } catch (error: EOFException) {
      throw GitVaultyProtocolException("GitVaulty runtime stopped before responding.", error)
    }
    if (size < 0 || size > MAX_FRAME_BYTES) throw GitVaultyProtocolException("GitVaulty runtime response is too large.")
    val bytes = ByteArray(size)
    try {
      input.readFully(bytes)
    } catch (error: EOFException) {
      throw GitVaultyProtocolException("GitVaulty runtime returned a truncated response.", error)
    }
    return try {
      StandardCharsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(java.nio.ByteBuffer.wrap(bytes))
        .toString()
    } catch (error: Exception) {
      throw GitVaultyProtocolException("GitVaulty runtime returned invalid UTF-8.", error)
    }
  }
}

internal fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

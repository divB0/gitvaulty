package io.github.divb0.gitvaulty.runtime

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ProtocolTest {
  @Test
  fun `writes and reads bounded framed json`() {
    val bytes = ByteArrayOutputStream()
    FramedJson.write(DataOutputStream(bytes), "{\"id\":\"one\"}")
    FramedJson.write(DataOutputStream(bytes), "{\"id\":\"two\"}")

    val input = DataInputStream(ByteArrayInputStream(bytes.toByteArray()))
    assertEquals("{\"id\":\"one\"}", FramedJson.read(input))
    assertEquals("{\"id\":\"two\"}", FramedJson.read(input))
  }

  @Test
  fun `rejects oversized and truncated frames`() {
    val oversized = ByteArrayOutputStream().also { DataOutputStream(it).writeInt(MAX_FRAME_BYTES + 1) }
    assertThrows(GitVaultyProtocolException::class.java) {
      FramedJson.read(DataInputStream(ByteArrayInputStream(oversized.toByteArray())))
    }

    val truncated = ByteArrayOutputStream().also {
      DataOutputStream(it).apply { writeInt(4); write(byteArrayOf(1, 2)) }
    }
    assertThrows(GitVaultyProtocolException::class.java) {
      FramedJson.read(DataInputStream(ByteArrayInputStream(truncated.toByteArray())))
    }
  }
}

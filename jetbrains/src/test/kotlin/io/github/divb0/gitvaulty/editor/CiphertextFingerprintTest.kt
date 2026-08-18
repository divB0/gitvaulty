package io.github.divb0.gitvaulty.editor

import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class CiphertextFingerprintTest {
  @get:Rule
  val temporary = TemporaryFolder()

  @Test
  fun hashesCiphertextBytesWithSha256() {
    val file = temporary.newFile("secret.gitvaulty").toPath()
    file.toFile().writeBytes("ciphertext\n".toByteArray())

    assertEquals(
      "bf41642124eb2921571bebcd8afa80960ca8bcc0c868200b23502f814e3b6820",
      ciphertextFingerprint(file),
    )
  }
}

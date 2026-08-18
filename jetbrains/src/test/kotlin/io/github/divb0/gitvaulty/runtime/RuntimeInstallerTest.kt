package io.github.divb0.gitvaulty.runtime

import java.nio.file.Files
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RuntimeInstallerTest {
  @Test
  fun `verifies exact size and digest`() {
    val file = Files.createTempFile("gitvaulty-runtime", ".zip")
    Files.write(file, byteArrayOf(1, 2, 3))
    val digest = MessageDigest.getInstance("SHA-256").digest(byteArrayOf(1, 2, 3)).toHex()
    val asset = RuntimeAsset("darwin-arm64", "runtime.zip", "https://github.com/divB0/gitvaulty/releases/download/tag/runtime.zip", 3, digest)
    RuntimeInstaller.verify(file, asset)

    assertThrows(GitVaultyRuntimeException::class.java) { RuntimeInstaller.verify(file, asset.copy(size = 4)) }
    assertThrows(GitVaultyRuntimeException::class.java) { RuntimeInstaller.verify(file, asset.copy(sha256 = "b".repeat(64))) }
  }

  @Test
  fun `extracts only the expected flat runtime files`() {
    val zip = Files.createTempFile("gitvaulty-runtime", ".zip")
    ZipOutputStream(Files.newOutputStream(zip)).use { output ->
      mapOf(
        "gitvaulty-editor-runtime" to byteArrayOf(1),
        "sops" to byteArrayOf(2),
        "LICENSE.sops" to byteArrayOf(3),
        "LICENSE.gitvaulty" to byteArrayOf(4),
      ).forEach { (name, bytes) ->
        output.putNextEntry(ZipEntry(name)); output.write(bytes); output.closeEntry()
      }
    }
    val destination = Files.createTempDirectory("gitvaulty-runtime-extracted")
    RuntimeInstaller.extract(zip, destination, windows = false)
    assertArrayEquals(byteArrayOf(1), Files.readAllBytes(destination.resolve("gitvaulty-editor-runtime")))
    assertArrayEquals(byteArrayOf(2), Files.readAllBytes(destination.resolve("sops")))
  }

  @Test
  fun `rejects traversal and unexpected archive entries`() {
    val zip = Files.createTempFile("gitvaulty-runtime-unsafe", ".zip")
    ZipOutputStream(Files.newOutputStream(zip)).use { output ->
      output.putNextEntry(ZipEntry("../outside")); output.write(1); output.closeEntry()
    }
    assertThrows(GitVaultyRuntimeException::class.java) {
      RuntimeInstaller.extract(zip, Files.createTempDirectory("gitvaulty-runtime-destination"), windows = false)
    }
  }
}

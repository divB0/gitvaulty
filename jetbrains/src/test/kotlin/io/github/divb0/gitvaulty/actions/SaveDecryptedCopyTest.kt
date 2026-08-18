package io.github.divb0.gitvaulty.actions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException
import java.nio.file.Files
import java.nio.file.attribute.PosixFilePermission

class SaveDecryptedCopyTest {
  @get:Rule
  val temporary = TemporaryFolder()

  @Test
  fun createsPrivateFileAndReplacesItsContents() {
    val destination = temporary.root.toPath().resolve("export.env")

    writePrivateCopy(destination, "TOKEN=one\n")
    writePrivateCopy(destination, "TOKEN=two\n")

    assertEquals("TOKEN=two\n", Files.readString(destination))
    if (Files.getFileStore(destination).supportsFileAttributeView("posix")) {
      assertEquals(
        setOf(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE),
        Files.getPosixFilePermissions(destination),
      )
    }
  }

  @Test
  fun refusesSymbolicLinkDestination() {
    val target = temporary.newFile("target.env").toPath()
    val link = temporary.root.toPath().resolve("export.env")
    try {
      Files.createSymbolicLink(link, target)
    } catch (_: UnsupportedOperationException) {
      return
    }

    assertThrows(IOException::class.java) { writePrivateCopy(link, "secret") }
    assertEquals(0L, Files.size(target))
  }
}

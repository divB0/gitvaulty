package io.github.divb0.gitvaulty.editor

import io.github.divb0.gitvaulty.runtime.DocumentAccess
import io.github.divb0.gitvaulty.runtime.OpenedDocument
import io.github.divb0.gitvaulty.runtime.SavedDocument
import java.nio.file.Path
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class EditorSessionTest {
  @Test
  fun `updates the fingerprint only after a successful serialized save`() {
    val runtime = FakeEditorRuntime()
    val session = GitVaultyEditorSession(
      sourcePath = Path.of("/repo/.env.gitvaulty"),
      logicalPath = ".env",
      fingerprint = "a".repeat(64),
      users = listOf("andrea"),
      runtime = runtime,
    )
    session.save("TOKEN=updated\n")
    assertEquals("b".repeat(64), session.fingerprint)
    assertEquals(listOf("a".repeat(64)), runtime.expectedFingerprints)

    runtime.failure = IllegalStateException("failed")
    assertThrows(IllegalStateException::class.java) { session.save("TOKEN=failed\n") }
    assertEquals("b".repeat(64), session.fingerprint)
  }

  @Test
  fun `refreshes access and reload metadata`() {
    val runtime = FakeEditorRuntime()
    val session = GitVaultyEditorSession(Path.of("/repo/.env.gitvaulty"), ".env", "a".repeat(64), listOf("andrea"), runtime)
    runtime.opened = OpenedDocument(".env", "TOKEN=external\n", "c".repeat(64), listOf("andrea", "sre"))
    assertEquals("TOKEN=external\n", session.reload().plaintext)
    assertEquals("c".repeat(64), session.fingerprint)
    assertEquals(listOf("andrea", "sre"), session.users)
  }
}

private class FakeEditorRuntime : EditorRuntime {
  var failure: RuntimeException? = null
  var opened = OpenedDocument(".env", "TOKEN=secret\n", "a".repeat(64), listOf("andrea"))
  val expectedFingerprints = mutableListOf<String>()

  override fun open(sourcePath: Path): OpenedDocument = opened

  override fun save(sourcePath: Path, plaintext: String, expectedFingerprint: String): SavedDocument {
    failure?.let { throw it }
    expectedFingerprints += expectedFingerprint
    return SavedDocument("b".repeat(64))
  }

  override fun access(sourcePath: Path): DocumentAccess = DocumentAccess(".env", listOf("andrea"))
}

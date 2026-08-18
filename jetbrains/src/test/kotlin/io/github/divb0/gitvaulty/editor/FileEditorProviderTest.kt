package io.github.divb0.gitvaulty.editor

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FileEditorProviderTest {
  @Test
  fun `accepts only local regular encrypted sources`() {
    assertTrue(GitVaultyFileEditorProvider.accepts("file", ".env.gitvaulty", directory = false))
    assertTrue(GitVaultyFileEditorProvider.accepts("file", "config.yaml.gitvaulty", directory = false))
    assertFalse(GitVaultyFileEditorProvider.accepts("file", ".env", directory = false))
    assertFalse(GitVaultyFileEditorProvider.accepts("jar", ".env.gitvaulty", directory = false))
    assertFalse(GitVaultyFileEditorProvider.accepts("file", ".env.gitvaulty", directory = true))
  }
}

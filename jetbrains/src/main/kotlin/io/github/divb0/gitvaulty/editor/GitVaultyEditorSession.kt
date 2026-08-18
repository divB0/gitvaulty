package io.github.divb0.gitvaulty.editor

import io.github.divb0.gitvaulty.runtime.DocumentAccess
import io.github.divb0.gitvaulty.runtime.OpenedDocument
import io.github.divb0.gitvaulty.runtime.RuntimeClient
import io.github.divb0.gitvaulty.runtime.SavedDocument
import java.nio.file.Path

interface EditorRuntime {
  fun open(sourcePath: Path): OpenedDocument
  fun save(sourcePath: Path, plaintext: String, expectedFingerprint: String): SavedDocument
  fun access(sourcePath: Path): DocumentAccess
}

internal class RuntimeClientEditorRuntime(private val client: RuntimeClient) : EditorRuntime {
  override fun open(sourcePath: Path): OpenedDocument = client.open(sourcePath)
  override fun save(sourcePath: Path, plaintext: String, expectedFingerprint: String): SavedDocument =
    client.save(sourcePath, plaintext, expectedFingerprint)
  override fun access(sourcePath: Path): DocumentAccess = client.access(sourcePath)
}

class GitVaultyEditorSession(
  val sourcePath: Path,
  val logicalPath: String,
  fingerprint: String,
  users: List<String>,
  private val runtime: EditorRuntime,
) {
  @Volatile
  var fingerprint: String = fingerprint
    private set

  @Volatile
  var users: List<String> = users.toList()
    private set

  @Volatile
  internal var saving: Boolean = false

  @Synchronized
  fun save(plaintext: String) {
    saving = true
    try {
      val saved = runtime.save(sourcePath, plaintext, fingerprint)
      fingerprint = saved.fingerprint
    } finally {
      saving = false
    }
  }

  @Synchronized
  fun reload(): OpenedDocument {
    val opened = runtime.open(sourcePath)
    if (opened.logicalPath != logicalPath) throw IllegalStateException("GitVaulty logical path changed while the editor was open.")
    fingerprint = opened.fingerprint
    users = opened.users.toList()
    return opened
  }

  @Synchronized
  fun refreshAccess(): DocumentAccess {
    val access = runtime.access(sourcePath)
    users = access.users.toList()
    return access
  }
}

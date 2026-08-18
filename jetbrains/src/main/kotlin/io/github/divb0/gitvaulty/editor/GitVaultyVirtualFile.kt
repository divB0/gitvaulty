package io.github.divb0.gitvaulty.editor

import com.intellij.openapi.fileTypes.FileTypeManager
import com.intellij.testFramework.LightVirtualFile
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.OutputStream
import java.nio.charset.StandardCharsets

class GitVaultyVirtualFile(
  val session: GitVaultyEditorSession,
  plaintext: String,
  private val onSaveError: (Throwable) -> Unit,
) : LightVirtualFile(
  java.nio.file.Path.of(session.logicalPath).fileName.toString(),
  FileTypeManager.getInstance().getFileTypeByFileName(java.nio.file.Path.of(session.logicalPath).fileName.toString()),
  plaintext,
) {
  init {
    charset = StandardCharsets.UTF_8
    isWritable = true
  }

  override fun getOutputStream(requestor: Any?, newModificationStamp: Long, newTimeStamp: Long): OutputStream {
    return object : ByteArrayOutputStream() {
      override fun close() {
        super.close()
        val text = toByteArray().toString(StandardCharsets.UTF_8)
        if (text.indexOf('\u0000') >= 0) throw IOException("GitVaulty native editors do not support NUL bytes.")
        try {
          session.save(text)
          setContentAfterSave(requestor, text)
        } catch (error: Throwable) {
          onSaveError(error)
          throw IOException(error.message ?: "GitVaulty could not save the encrypted file.", error)
        }
      }
    }
  }

  fun reload(plaintext: String) {
    super.setContent(this, plaintext, false)
  }

  private fun setContentAfterSave(requestor: Any?, plaintext: String) {
    super.setContent(requestor, plaintext, false)
  }
}

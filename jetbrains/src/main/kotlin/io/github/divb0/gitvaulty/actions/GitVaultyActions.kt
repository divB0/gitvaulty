package io.github.divb0.gitvaulty.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.fileChooser.FileChooserFactory
import com.intellij.openapi.fileChooser.FileSaverDescriptor
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.ui.Messages
import io.github.divb0.gitvaulty.editor.GitVaultyEditorService
import io.github.divb0.gitvaulty.editor.GitVaultyNotifications
import io.github.divb0.gitvaulty.editor.GitVaultyVirtualFile
import java.awt.datatransfer.StringSelection
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.OpenOption
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import java.nio.file.attribute.PosixFilePermission
import java.nio.file.attribute.PosixFilePermissions

abstract class GitVaultyEditorAction : AnAction(), DumbAware {
  override fun update(event: AnActionEvent) {
    event.presentation.isEnabledAndVisible = event.project != null && event.getData(CommonDataKeys.VIRTUAL_FILE) is GitVaultyVirtualFile
  }

  protected fun file(event: AnActionEvent): GitVaultyVirtualFile? = event.getData(CommonDataKeys.VIRTUAL_FILE) as? GitVaultyVirtualFile
}

class ShowAccessAction : GitVaultyEditorAction() {
  override fun actionPerformed(event: AnActionEvent) {
    val project = event.project ?: return
    val file = file(event) ?: return
    ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Reading GitVaulty access", true) {
      override fun run(indicator: ProgressIndicator) {
        try {
          val access = file.session.refreshAccess()
          GitVaultyNotifications.info(project, "${access.logicalPath} access: ${access.users.joinToString(", ")}")
        } catch (error: Throwable) {
          GitVaultyNotifications.error(project, error.message ?: "GitVaulty could not read file access.")
        }
      }
    })
  }
}

class CopyLogicalPathAction : GitVaultyEditorAction() {
  override fun actionPerformed(event: AnActionEvent) {
    val file = file(event) ?: return
    CopyPasteManager.getInstance().setContents(StringSelection(file.session.logicalPath))
  }
}

class CopyEncryptedPathAction : GitVaultyEditorAction() {
  override fun actionPerformed(event: AnActionEvent) {
    val file = file(event) ?: return
    CopyPasteManager.getInstance().setContents(StringSelection(file.session.sourcePath.toString()))
  }
}

class ReloadEncryptedAction : GitVaultyEditorAction() {
  override fun actionPerformed(event: AnActionEvent) {
    val project = event.project ?: return
    val file = file(event) ?: return
    if (FileDocumentManager.getInstance().isFileModified(file)) {
      val choice = Messages.showYesNoDialog(
        project,
        "Reloading will discard unsaved edits in ${file.session.logicalPath}.",
        "Reload GitVaulty File",
        "Reload",
        "Cancel",
        Messages.getWarningIcon(),
      )
      if (choice != Messages.YES) return
    }
    project.service<GitVaultyEditorService>().reload(file)
  }
}

class SaveDecryptedCopyAction : GitVaultyEditorAction() {
  override fun actionPerformed(event: AnActionEvent) {
    val project = event.project ?: return
    val file = file(event) ?: return
    val descriptor = FileSaverDescriptor("Save Decrypted Copy", "Choose an explicit destination for the decrypted document")
    val selected = FileChooserFactory.getInstance()
      .createSaveFileDialog(descriptor, project)
      .save(Path.of(file.session.sourcePath.toString()).parent, Path.of(file.session.logicalPath).fileName.toString())
      ?: return
    val destination = selected.file.toPath().toAbsolutePath().normalize()
    if (destination == file.session.sourcePath || destination.fileName.toString().endsWith(".gitvaulty")) {
      GitVaultyNotifications.error(project, "Choose a destination other than the encrypted source or a *.gitvaulty file.")
      return
    }
    val document = FileDocumentManager.getInstance().getDocument(file) ?: return
    val text = document.text
    ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Saving decrypted copy", true) {
      override fun run(indicator: ProgressIndicator) {
        try {
          writePrivateCopy(destination, text)
          GitVaultyNotifications.info(project, "Saved decrypted copy to $destination.")
        } catch (error: Throwable) {
          GitVaultyNotifications.error(project, error.message ?: "GitVaulty could not save the decrypted copy.")
        }
      }
    })
  }
}

internal fun writePrivateCopy(destination: Path, text: String) {
  val normalized = destination.toAbsolutePath().normalize()
  val existed = Files.exists(normalized, LinkOption.NOFOLLOW_LINKS)
  if (Files.isSymbolicLink(normalized) || (existed && !Files.isRegularFile(normalized, LinkOption.NOFOLLOW_LINKS))) {
    throw IOException("The decrypted-copy destination must be a regular file, not a symbolic link.")
  }

  val permissions = setOf(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)
  val posix = Files.getFileStore(normalized.parent).supportsFileAttributeView("posix")
  if (existed && posix) Files.setPosixFilePermissions(normalized, permissions)

  val options = setOf<OpenOption>(
    StandardOpenOption.CREATE,
    StandardOpenOption.TRUNCATE_EXISTING,
    StandardOpenOption.WRITE,
    LinkOption.NOFOLLOW_LINKS,
  )
  val attributes = if (!existed && posix) arrayOf(PosixFilePermissions.asFileAttribute(permissions)) else emptyArray()
  Files.newByteChannel(normalized, options, *attributes).use { channel ->
    val bytes = ByteBuffer.wrap(text.toByteArray(StandardCharsets.UTF_8))
    while (bytes.hasRemaining()) channel.write(bytes)
  }
  if (posix) Files.setPosixFilePermissions(normalized, permissions)
}

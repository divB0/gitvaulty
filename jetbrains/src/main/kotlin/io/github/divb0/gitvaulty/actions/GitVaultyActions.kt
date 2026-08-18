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
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermission

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
          Files.writeString(destination, text, StandardCharsets.UTF_8)
          runCatching {
            Files.setPosixFilePermissions(
              destination,
              setOf(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE),
            )
          }
          GitVaultyNotifications.info(project, "Saved decrypted copy to $destination.")
        } catch (error: Throwable) {
          GitVaultyNotifications.error(project, error.message ?: "GitVaulty could not save the decrypted copy.")
        }
      }
    })
  }
}

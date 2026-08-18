package io.github.divb0.gitvaulty.editor

import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.EditorNotificationPanel
import com.intellij.ui.EditorNotificationProvider
import java.util.function.Function
import javax.swing.JComponent

class GitVaultyEditorNotificationProvider : EditorNotificationProvider, DumbAware {
  override fun collectNotificationData(
    project: Project,
    file: VirtualFile,
  ): Function<in FileEditor, out JComponent>? {
    if (file !is GitVaultyVirtualFile) return null
    return Function { editor ->
      EditorNotificationPanel(editor, EditorNotificationPanel.Status.Info).apply {
        text("GitVaulty decrypted this document in memory. Saves are encrypted; IDE recovery and compatible plugins may observe the text.")
      }
    }
  }
}

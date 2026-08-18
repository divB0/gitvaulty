package io.github.divb0.gitvaulty.editor

import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.FileEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile

class GitVaultyFileEditorProvider : FileEditorProvider, DumbAware {
  override fun accept(project: Project, file: VirtualFile): Boolean =
    accepts(file.fileSystem.protocol, file.name, file.isDirectory) && file !is GitVaultyVirtualFile

  override fun acceptRequiresReadAction(): Boolean = false

  override fun createEditor(project: Project, file: VirtualFile): FileEditor = GitVaultyLauncherEditor(project, file)

  override fun getEditorTypeId(): String = "gitvaulty.editor"

  override fun getPolicy(): FileEditorPolicy = FileEditorPolicy.HIDE_DEFAULT_EDITOR

  companion object {
    internal fun accepts(protocol: String, name: String, directory: Boolean): Boolean =
      protocol == "file" && !directory && name.endsWith(".gitvaulty") && name.length > ".gitvaulty".length
  }
}

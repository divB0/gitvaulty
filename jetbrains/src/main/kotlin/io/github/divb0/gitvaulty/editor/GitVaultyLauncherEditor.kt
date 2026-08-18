package io.github.divb0.gitvaulty.editor

import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.UserDataHolderBase
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.components.JBLabel
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.beans.PropertyChangeListener
import java.beans.PropertyChangeSupport
import javax.swing.JComponent
import javax.swing.JPanel

internal class GitVaultyLauncherEditor(
  private val project: Project,
  private val source: VirtualFile,
) : UserDataHolderBase(), FileEditor {
  private val changes = PropertyChangeSupport(this)
  private val label = JBLabel("Authorizing and decrypting ${source.name}…")
  private val panel = JPanel(BorderLayout()).apply {
    border = JBUI.Borders.empty(24)
    add(label, BorderLayout.NORTH)
  }

  init {
    project.service<GitVaultyEditorService>().open(source) { message -> label.text = message }
  }

  override fun getComponent(): JComponent = panel
  override fun getPreferredFocusedComponent(): JComponent = panel
  override fun getName(): String = "GitVaulty"
  override fun setState(state: FileEditorState) = Unit
  override fun isModified(): Boolean = false
  override fun isValid(): Boolean = source.isValid && !project.isDisposed
  override fun addPropertyChangeListener(listener: PropertyChangeListener) = changes.addPropertyChangeListener(listener)
  override fun removePropertyChangeListener(listener: PropertyChangeListener) = changes.removePropertyChangeListener(listener)
  override fun getFile(): VirtualFile = source
  override fun dispose() = Unit
}

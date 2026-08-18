package io.github.divb0.gitvaulty.editor

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import io.github.divb0.gitvaulty.runtime.RuntimeClient
import io.github.divb0.gitvaulty.runtime.RuntimeInstaller
import java.nio.file.Path
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

@Service(Service.Level.PROJECT)
class GitVaultyEditorService(private val project: Project) : Disposable {
  private val files = ConcurrentHashMap<Path, GitVaultyVirtualFile>()
  private val clientDelegate = lazy { RuntimeClient(RuntimeInstaller().resolve()) }
  private val client: RuntimeClient by clientDelegate
  private val runtime: EditorRuntime by lazy { RuntimeClientEditorRuntime(client) }

  init {
    project.messageBus.connect(this).subscribe(VirtualFileManager.VFS_CHANGES, object : BulkFileListener {
      override fun after(events: List<VFileEvent>) {
        events.mapNotNull { event -> runCatching { Path.of(event.path).toAbsolutePath().normalize() }.getOrNull() }
          .distinct()
          .forEach { changed -> sourceChanged(changed) }
      }
    })
  }

  fun open(source: VirtualFile, failed: (String) -> Unit = {}) {
    val sourcePath = Path.of(source.path).toAbsolutePath().normalize()
    files[sourcePath]?.takeIf { it.isValid }?.let { existing ->
      FileEditorManager.getInstance(project).openFile(existing, true, true)
      FileEditorManager.getInstance(project).closeFile(source)
      return
    }

    ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Decrypting GitVaulty file", true) {
      override fun run(indicator: ProgressIndicator) {
        indicator.text = "Authorizing and decrypting ${source.name}"
        try {
          val opened = runtime.open(sourcePath)
          val session = GitVaultyEditorSession(sourcePath, opened.logicalPath, opened.fingerprint, opened.users, runtime)
          ApplicationManager.getApplication().invokeLater {
            if (project.isDisposed || !source.isValid) return@invokeLater
            val virtual = GitVaultyVirtualFile(session, opened.plaintext) { error ->
              GitVaultyNotifications.error(project, error.message ?: "GitVaulty could not save the encrypted file.")
            }
            files[sourcePath] = virtual
            FileEditorManager.getInstance(project).openFile(virtual, true, true)
            FileEditorManager.getInstance(project).closeFile(source)
          }
        } catch (error: Throwable) {
          val message = error.message ?: "GitVaulty could not open the encrypted file."
          ApplicationManager.getApplication().invokeLater {
            if (!project.isDisposed) {
              GitVaultyNotifications.error(project, message)
              failed(message)
            }
          }
        }
      }
    })
  }

  fun session(file: VirtualFile?): GitVaultyEditorSession? = (file as? GitVaultyVirtualFile)?.session

  fun virtualFile(sourcePath: Path): GitVaultyVirtualFile? = files[sourcePath.toAbsolutePath().normalize()]

  fun reload(file: GitVaultyVirtualFile) {
    ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Reloading GitVaulty file", true) {
      override fun run(indicator: ProgressIndicator) {
        try {
          val opened = file.session.reload()
          ApplicationManager.getApplication().invokeLater {
            if (project.isDisposed || !file.isValid) return@invokeLater
            file.reload(opened.plaintext)
            FileDocumentManager.getInstance().getCachedDocument(file)?.let { document ->
              FileDocumentManager.getInstance().reloadFromDisk(document, project)
            }
          }
        } catch (error: Throwable) {
          ApplicationManager.getApplication().invokeLater {
            if (!project.isDisposed) GitVaultyNotifications.error(project, error.message ?: "GitVaulty could not reload the encrypted file.")
          }
        }
      }
    })
  }

  private fun sourceChanged(sourcePath: Path) {
    val file = files[sourcePath] ?: return
    if (file.session.saving || !file.isValid) return
    ApplicationManager.getApplication().executeOnPooledThread {
      if (project.isDisposed || !file.isValid || file.session.saving) return@executeOnPooledThread
      if (runCatching { ciphertextFingerprint(sourcePath) }.getOrNull() == file.session.fingerprint) return@executeOnPooledThread
      ApplicationManager.getApplication().invokeLater {
        if (project.isDisposed || !file.isValid || file.session.saving) return@invokeLater
        val manager = FileDocumentManager.getInstance()
        if (manager.isFileModified(file)) {
          GitVaultyNotifications.warning(project, "${file.session.logicalPath} changed on disk. Reload it or save a decrypted copy before continuing.")
        } else {
          reload(file)
        }
      }
    }
  }

  override fun dispose() {
    if (clientDelegate.isInitialized()) client.close()
    files.clear()
  }
}

internal fun ciphertextFingerprint(path: Path): String {
  val digest = MessageDigest.getInstance("SHA-256")
  path.toFile().inputStream().use { input ->
    val buffer = ByteArray(64 * 1024)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      digest.update(buffer, 0, read)
    }
  }
  return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
}

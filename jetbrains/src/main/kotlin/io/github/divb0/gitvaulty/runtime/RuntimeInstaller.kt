package io.github.divb0.gitvaulty.runtime

import com.intellij.openapi.application.PathManager
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.PosixFilePermission
import java.security.MessageDigest
import java.time.Duration
import java.util.Comparator
import java.util.zip.ZipInputStream

data class InstalledRuntime(val executable: Path, val sops: Path)

class RuntimeInstaller(
  private val cacheRoot: Path = Path.of(PathManager.getSystemPath(), "gitvaulty", "editor-runtime"),
  private val environment: Map<String, String> = System.getenv(),
) {
  @Synchronized
  fun resolve(): InstalledRuntime {
    environment["GITVAULTY_EDITOR_RUNTIME"]?.takeIf { it.isNotBlank() }?.let { configured ->
      val executable = Path.of(configured).toAbsolutePath().normalize()
      val sops = executable.resolveSibling(if (RuntimePlatform.current().startsWith("win32-")) "sops.exe" else "sops")
      validateInstalled(executable, sops)
      return InstalledRuntime(executable, sops)
    }

    val manifestText = RuntimeInstaller::class.java.classLoader
      .getResourceAsStream("gitvaulty-runtime-manifest.json")
      ?.bufferedReader(Charsets.UTF_8)
      ?.use { it.readText() }
      ?: throw GitVaultyRuntimeException("GitVaulty runtime manifest is missing from the plugin.")
    val manifest = RuntimeManifest.parse(manifestText)
    val target = RuntimePlatform.current()
    val asset = manifest.asset(target)
    val installation = cacheRoot.resolve(manifest.runtimeVersion).resolve(target)
    val executableName = if (target.startsWith("win32-")) "gitvaulty-editor-runtime.exe" else "gitvaulty-editor-runtime"
    val sopsName = if (target.startsWith("win32-")) "sops.exe" else "sops"
    val executable = installation.resolve(executableName)
    val sops = installation.resolve(sopsName)
    val marker = installation.resolve(".asset-sha256")
    if (Files.isRegularFile(executable) && Files.isRegularFile(sops) && Files.isRegularFile(marker) && Files.readString(marker).trim() == asset.sha256) {
      return InstalledRuntime(executable, sops)
    }

    Files.createDirectories(installation.parent)
    val temporary = Files.createTempDirectory(installation.parent, ".${target}-")
    try {
      val archive = temporary.resolve(asset.filename)
      download(asset, archive)
      verify(archive, asset)
      val extracted = temporary.resolve("content")
      Files.createDirectory(extracted)
      extract(archive, extracted, target.startsWith("win32-"))
      Files.writeString(extracted.resolve(".asset-sha256"), "${asset.sha256}\n")
      deleteRecursively(installation)
      try {
        Files.move(extracted, installation, StandardCopyOption.ATOMIC_MOVE)
      } catch (_: AtomicMoveNotSupportedException) {
        Files.move(extracted, installation)
      }
      validateInstalled(executable, sops)
      return InstalledRuntime(executable, sops)
    } finally {
      deleteRecursively(temporary)
    }
  }

  private fun download(asset: RuntimeAsset, destination: Path) {
    val client = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(20))
      .followRedirects(HttpClient.Redirect.NORMAL)
      .build()
    val request = HttpRequest.newBuilder(URI(asset.url)).timeout(Duration.ofMinutes(5)).GET().build()
    val response = try { client.send(request, HttpResponse.BodyHandlers.ofFile(destination)) }
    catch (error: Exception) { throw GitVaultyRuntimeException("Could not download the GitVaulty editor runtime.", error) }
    if (response.statusCode() != 200) throw GitVaultyRuntimeException("GitVaulty runtime download failed with HTTP ${response.statusCode()}.")
  }

  private fun validateInstalled(executable: Path, sops: Path) {
    if (!Files.isRegularFile(executable) || !Files.isRegularFile(sops)) throw GitVaultyRuntimeException("GitVaulty editor runtime installation is incomplete.")
    if (!RuntimePlatform.current().startsWith("win32-") && (!Files.isExecutable(executable) || !Files.isExecutable(sops))) {
      throw GitVaultyRuntimeException("GitVaulty editor runtime is not executable.")
    }
  }

  companion object {
    internal fun verify(file: Path, asset: RuntimeAsset) {
      if (Files.size(file) != asset.size) throw GitVaultyRuntimeException("GitVaulty runtime size verification failed.")
      val digest = MessageDigest.getInstance("SHA-256")
      Files.newInputStream(file).use { input ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          digest.update(buffer, 0, read)
        }
      }
      if (digest.digest().toHex() != asset.sha256) throw GitVaultyRuntimeException("GitVaulty runtime digest verification failed.")
    }

    internal fun extract(archive: Path, destination: Path, windows: Boolean) {
      val expected = if (windows) {
        setOf("gitvaulty-editor-runtime.exe", "sops.exe", "LICENSE.sops", "LICENSE.gitvaulty")
      } else {
        setOf("gitvaulty-editor-runtime", "sops", "LICENSE.sops", "LICENSE.gitvaulty")
      }
      val extracted = mutableSetOf<String>()
      var total = 0L
      ZipInputStream(Files.newInputStream(archive)).use { zip ->
        while (true) {
          val entry = zip.nextEntry ?: break
          val name = entry.name
          if (entry.isDirectory || name !in expected || !extracted.add(name)) throw GitVaultyRuntimeException("GitVaulty runtime archive contains an unexpected entry.")
          val output = destination.resolve(name).normalize()
          if (output.parent != destination.normalize()) throw GitVaultyRuntimeException("GitVaulty runtime archive path is unsafe.")
          Files.newOutputStream(output).use { sink ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
              val read = zip.read(buffer)
              if (read < 0) break
              total += read
              if (total > 256L * 1024 * 1024) throw GitVaultyRuntimeException("GitVaulty runtime archive is too large.")
              sink.write(buffer, 0, read)
            }
          }
          zip.closeEntry()
        }
      }
      if (extracted != expected) throw GitVaultyRuntimeException("GitVaulty runtime archive is incomplete.")
      if (!windows) {
        val executablePermissions = setOf(
          PosixFilePermission.OWNER_READ,
          PosixFilePermission.OWNER_WRITE,
          PosixFilePermission.OWNER_EXECUTE,
        )
        Files.setPosixFilePermissions(destination.resolve("gitvaulty-editor-runtime"), executablePermissions)
        Files.setPosixFilePermissions(destination.resolve("sops"), executablePermissions)
        val privatePermissions = setOf(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)
        Files.setPosixFilePermissions(destination.resolve("LICENSE.sops"), privatePermissions)
        Files.setPosixFilePermissions(destination.resolve("LICENSE.gitvaulty"), privatePermissions)
      }
    }

    private fun deleteRecursively(path: Path) {
      if (!Files.exists(path)) return
      Files.walk(path).use { stream ->
        stream.sorted(Comparator.reverseOrder()).forEach { Files.deleteIfExists(it) }
      }
    }
  }
}

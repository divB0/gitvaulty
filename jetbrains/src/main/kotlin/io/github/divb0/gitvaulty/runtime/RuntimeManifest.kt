package io.github.divb0.gitvaulty.runtime

import com.google.gson.Gson
import java.net.URI
import java.util.Locale

data class RuntimeAsset(
  val target: String = "",
  val filename: String = "",
  val url: String = "",
  val size: Long = 0,
  val sha256: String = "",
)

data class RuntimeManifest(
  val protocolVersion: Int = 0,
  val runtimeVersion: String = "",
  val assets: List<RuntimeAsset> = emptyList(),
) {
  fun asset(target: String): RuntimeAsset {
    validate()
    return assets.singleOrNull { it.target == target }
      ?: throw GitVaultyRuntimeException("GitVaulty has no editor runtime for $target.")
  }

  fun validate() {
    if (protocolVersion != PROTOCOL_VERSION) throw GitVaultyRuntimeException("Unsupported GitVaulty editor runtime protocol.")
    if (!runtimeVersion.matches(Regex("^\\d+\\.\\d+\\.\\d+$"))) throw GitVaultyRuntimeException("Invalid GitVaulty runtime version.")
    if (assets.map { it.target }.toSet().size != assets.size) throw GitVaultyRuntimeException("Duplicate GitVaulty runtime target.")
    for (asset in assets) {
      if (asset.target !in RuntimePlatform.supported) throw GitVaultyRuntimeException("Invalid GitVaulty runtime target.")
      val expectedFilename = "gitvaulty-editor-runtime-v$runtimeVersion-${asset.target}.zip"
      if (asset.filename != expectedFilename) throw GitVaultyRuntimeException("Invalid GitVaulty runtime filename.")
      val uri = try { URI(asset.url) } catch (error: Exception) {
        throw GitVaultyRuntimeException("Invalid GitVaulty runtime URL.", error)
      }
      val immutablePath = Regex("^/divB0/gitvaulty/releases/download/jetbrains-v[^/]+/${Regex.escape(asset.filename)}$")
      if (uri.scheme != "https" || uri.host != "github.com" || uri.query != null || uri.fragment != null || !immutablePath.matches(uri.path)) {
        throw GitVaultyRuntimeException("GitVaulty runtime URL must identify an exact GitHub Release asset.")
      }
      if (asset.size <= 0 || asset.size > 256L * 1024 * 1024) throw GitVaultyRuntimeException("Invalid GitVaulty runtime asset size.")
      if (!asset.sha256.matches(Regex("^[a-f0-9]{64}$"))) throw GitVaultyRuntimeException("Invalid GitVaulty runtime digest.")
    }
  }

  companion object {
    fun parse(json: String): RuntimeManifest {
      val manifest = try { Gson().fromJson(json, RuntimeManifest::class.java) }
      catch (error: Exception) { throw GitVaultyRuntimeException("Invalid GitVaulty runtime manifest.", error) }
      if (manifest == null) throw GitVaultyRuntimeException("Invalid GitVaulty runtime manifest.")
      manifest.validate()
      return manifest
    }
  }
}

internal object RuntimePlatform {
  val supported = setOf("darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-x64")

  fun current(): String = target(System.getProperty("os.name"), System.getProperty("os.arch"))

  fun target(osName: String, architecture: String): String {
    val os = osName.lowercase(Locale.ROOT)
    val arch = architecture.lowercase(Locale.ROOT)
    val platform = when {
      os.contains("mac") || os.contains("darwin") -> "darwin"
      os.contains("linux") -> "linux"
      os.contains("windows") -> "win32"
      else -> throw GitVaultyRuntimeException("Unsupported editor runtime operating system: $osName.")
    }
    val normalizedArchitecture = when (arch) {
      "aarch64", "arm64" -> "arm64"
      "amd64", "x86_64", "x64" -> "x64"
      else -> throw GitVaultyRuntimeException("Unsupported editor runtime architecture: $architecture.")
    }
    val result = "$platform-$normalizedArchitecture"
    if (result !in supported) throw GitVaultyRuntimeException("Unsupported editor runtime platform: $result.")
    return result
  }
}

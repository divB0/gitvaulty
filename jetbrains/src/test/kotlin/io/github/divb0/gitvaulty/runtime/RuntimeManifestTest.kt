package io.github.divb0.gitvaulty.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RuntimeManifestTest {
  @Test
  fun `maps supported JetBrains hosts to release targets`() {
    assertEquals("darwin-arm64", RuntimePlatform.target("Mac OS X", "aarch64"))
    assertEquals("darwin-x64", RuntimePlatform.target("macOS", "x86_64"))
    assertEquals("linux-arm64", RuntimePlatform.target("Linux", "arm64"))
    assertEquals("win32-x64", RuntimePlatform.target("Windows 11", "amd64"))
    assertThrows(GitVaultyRuntimeException::class.java) { RuntimePlatform.target("Windows 11", "arm64") }
  }

  @Test
  fun `parses and selects a validated exact asset`() {
    val manifest = RuntimeManifest.parse(
      """
      {
        "protocolVersion": 1,
        "runtimeVersion": "0.1.0",
        "assets": [{
          "target": "darwin-arm64",
          "filename": "gitvaulty-editor-runtime-v0.1.0-darwin-arm64.zip",
          "url": "https://github.com/divB0/gitvaulty/releases/download/v0.1.0/gitvaulty-editor-runtime-v0.1.0-darwin-arm64.zip",
          "size": 42,
          "sha256": "${"a".repeat(64)}"
        }]
      }
      """.trimIndent(),
    )
    assertEquals("darwin-arm64", manifest.asset("darwin-arm64").target)
  }

  @Test
  fun `rejects mutable or malformed manifests`() {
    val mutable = """
      {"protocolVersion":1,"runtimeVersion":"0.1.0","assets":[{
        "target":"darwin-arm64","filename":"runtime.zip",
        "url":"https://github.com/divB0/gitvaulty/releases/latest/download/runtime.zip",
        "size":1,"sha256":"${"a".repeat(64)}"}]}
    """.trimIndent()
    assertThrows(GitVaultyRuntimeException::class.java) { RuntimeManifest.parse(mutable) }
  }
}

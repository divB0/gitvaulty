package io.github.divb0.gitvaulty.runtime

import java.nio.file.Files
import java.nio.file.Path
import org.junit.Assume.assumeTrue
import org.junit.Test

class RuntimeClientIntegrationTest {
  @Test
  fun `handshakes with the packaged native runtime`() {
    val configured = System.getProperty("gitvaulty.test.runtime")
    assumeTrue("Pass -PgitvaultyTestRuntime to test the packaged runtime", !configured.isNullOrBlank())
    val executable = Path.of(configured)
    val sops = executable.resolveSibling(if (executable.fileName.toString().endsWith(".exe")) "sops.exe" else "sops")
    assumeTrue(Files.isRegularFile(executable) && Files.isRegularFile(sops))
    RuntimeClient(InstalledRuntime(executable, sops)).use { /* Constructor verifies the ping handshake. */ }
  }
}

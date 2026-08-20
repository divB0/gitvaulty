import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.tasks.VerifyPluginSignatureTask

plugins {
  kotlin("jvm") version "2.3.20"
  id("org.jetbrains.intellij.platform") version "2.18.1"
}

group = "io.github.divb0.gitvaulty"
version = "3.0.2"

repositories {
  mavenCentral()
  intellijPlatform { defaultRepositories() }
}

dependencies {
  testImplementation("junit:junit:4.13.2")

  intellijPlatform {
    intellijIdea("2025.2.6.2")
    testFramework(TestFrameworkType.Platform)
  }
}

kotlin {
  jvmToolchain(21)
}

intellijPlatform {
  pluginConfiguration {
    ideaVersion {
      sinceBuild = "252"
    }
  }

  signing {
    certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
    privateKey = providers.environmentVariable("PRIVATE_KEY")
    password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
  }

  publishing {
    token = providers.environmentVariable("PUBLISH_TOKEN")
  }
}

val runtimeManifest = providers.gradleProperty("gitvaultyRuntimeManifest")

tasks.processResources {
  from(rootProject.file("../LICENSE")) {
    into("META-INF")
    rename { "LICENSE.gitvaulty" }
  }
  if (runtimeManifest.isPresent) {
    exclude("gitvaulty-runtime-manifest.json")
    from(runtimeManifest.map(::file)) {
      rename { "gitvaulty-runtime-manifest.json" }
    }
  }
}

tasks.test {
  maxHeapSize = "2g"
  providers.gradleProperty("gitvaultyTestRuntime").orNull?.let {
    systemProperty("gitvaulty.test.runtime", file(it).absolutePath)
  }
}

tasks.named<VerifyPluginSignatureTask>("verifyPluginSignature") {
  dependsOn("signPlugin")
  providers.gradleProperty("gitvaultyVerificationCertificate").orNull?.let {
    certificateChain.unset()
    certificateChain.unsetConvention()
    certificateChainFile.set(file(it))
  }
}

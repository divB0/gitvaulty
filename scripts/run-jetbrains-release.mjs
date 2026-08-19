#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const [mode, manifestArgument] = process.argv.slice(2);
if (!(["sign", "publish"].includes(mode)) || !manifestArgument) {
  process.stderr.write("Usage: node scripts/run-jetbrains-release.mjs <sign|publish> <runtime-manifest>\n");
  process.exit(2);
}

const repository = process.cwd();
const secretsDirectory = path.join(repository, ".github", "jetbrains-release-secrets");
const manifest = path.resolve(repository, manifestArgument);

async function readSecret(name, trim = false) {
  const value = await readFile(path.join(secretsDirectory, name), "utf8");
  return trim ? value.trim() : value;
}

const certificate = path.join(secretsDirectory, "certificate-chain.pem");
const environment = {
  ...process.env,
  CERTIFICATE_CHAIN: await readSecret("certificate-chain.pem"),
  PRIVATE_KEY: await readSecret("private-key.pem"),
  PRIVATE_KEY_PASSWORD: await readSecret("private-key-password.txt", true),
};

if (mode === "publish") {
  environment.PUBLISH_TOKEN = await readSecret("publish-token.txt", true);
}

for (const name of [
  "GITVAULTY_KEY",
  "GITVAULTY_AGE_KEY_FILE",
  "SOPS_AGE_KEY",
  "SOPS_AGE_KEY_FILE",
  "SOPS_AGE_KEY_CMD",
]) {
  delete environment[name];
}

const tasks = mode === "sign"
  ? ["signPlugin", "verifyPluginSignature"]
  : ["signPlugin", "publishPlugin"];
const arguments_ = [
  "-p",
  "jetbrains",
  ...tasks,
  `-PgitvaultyRuntimeManifest=${manifest}`,
  ...(mode === "sign" ? [`-PgitvaultyVerificationCertificate=${certificate}`] : []),
  "--console=plain",
];

const child = spawn("./jetbrains/gradlew", arguments_, {
  cwd: repository,
  env: environment,
  stdio: "inherit",
});

child.once("error", (error) => {
  process.stderr.write(`Unable to start the JetBrains release build: ${error.message}\n`);
  process.exit(1);
});
child.once("exit", (code, signal) => {
  if (signal) {
    process.stderr.write(`JetBrains release build stopped by ${signal}.\n`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

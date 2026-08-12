import { spawn } from "node:child_process";

export interface ProcessResult { stdout: string; stderr: string; code: number }

export function execute(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string; inherit?: boolean } = {}): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.inherit ? "inherit" : "pipe",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    if (!options.inherit) child.stdin?.end(options.input);
  });
}

export async function executeChecked(command: string, args: string[], options: Parameters<typeof execute>[2] = {}): Promise<ProcessResult> {
  const result = await execute(command, args, options);
  if (result.code !== 0) throw new Error(result.stderr.trim() || `${command} exited with code ${result.code}`);
  return result;
}

export interface BinaryProcessResult { stdout: Buffer; stderr: string; code: number }

export function executeBinary(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: Buffer } = {},
): Promise<BinaryProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: "pipe" });
    const stdout: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout.push(chunk); });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout: Buffer.concat(stdout), stderr, code: code ?? 1 }));
    child.stdin.end(options.input);
  });
}

export async function executeBinaryChecked(
  command: string,
  args: string[],
  options: Parameters<typeof executeBinary>[2] = {},
): Promise<BinaryProcessResult> {
  const result = await executeBinary(command, args, options);
  if (result.code !== 0) throw new Error(result.stderr.trim() || `${command} exited with code ${result.code}`);
  return result;
}

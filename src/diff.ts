import { createTwoFilesPatch } from "diff";

function decodeText(content: Buffer): string | undefined {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(content); }
  catch { return undefined; }
}

export function formatSecretDiff(file: string, encrypted: Buffer, local: Buffer): string {
  if (encrypted.equals(local)) return "";

  const oldPath = `a/${file}`;
  const newPath = `b/${file}`;
  const oldText = decodeText(encrypted);
  const newText = decodeText(local);
  if (oldText === undefined || newText === undefined) {
    return `diff --git ${oldPath} ${newPath}\nBinary files ${oldPath} and ${newPath} differ\n`;
  }

  const patch = createTwoFilesPatch(oldPath, newPath, oldText, newText, "", "", { context: 3 })
    .replace(/^=+\r?\n/, "");
  return `diff --git ${oldPath} ${newPath}\n${patch}`;
}

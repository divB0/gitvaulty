const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();

export function decodeSecretText(contents: Uint8Array): string {
  let text: string;
  try { text = utf8Decoder.decode(contents); }
  catch { throw new Error("GitVaulty native editing supports valid UTF-8 text files only."); }
  if (text.includes("\0")) throw new Error("GitVaulty native editing does not support text containing NUL bytes.");
  return text;
}

export function encodeSecretText(text: string): Uint8Array {
  if (text.includes("\0")) throw new Error("GitVaulty native editing does not support text containing NUL bytes.");
  return utf8Encoder.encode(text);
}

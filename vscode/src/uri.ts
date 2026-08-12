export const GITVAULTY_SCHEME = "gitvaulty";
const GITVAULTY_SUFFIX = ".gitvaulty";
const SUPPORTED_SOURCE_SCHEMES = new Set(["file", "vscode-remote"]);

export interface SourceUriParts {
  scheme: string;
  path: string;
  value: string;
}

export interface VirtualUriParts {
  scheme: string;
  authority: string;
  path: string;
  query: string;
}

export function sourceToVirtualParts(source: SourceUriParts): VirtualUriParts {
  if (!SUPPORTED_SOURCE_SCHEMES.has(source.scheme)) {
    throw new Error(`Unsupported GitVaulty source URI scheme: ${source.scheme}`);
  }
  if (!source.path.endsWith(GITVAULTY_SUFFIX) || source.path.length === GITVAULTY_SUFFIX.length) {
    throw new Error(`GitVaulty source path must end in ${GITVAULTY_SUFFIX}.`);
  }
  return {
    scheme: GITVAULTY_SCHEME,
    authority: "document",
    path: source.path.slice(0, -GITVAULTY_SUFFIX.length),
    query: new URLSearchParams({ source: source.value }).toString(),
  };
}

export function sourceUriFromVirtual(uri: Pick<VirtualUriParts, "scheme" | "authority" | "path" | "query">): string {
  if (uri.scheme !== GITVAULTY_SCHEME || uri.authority !== "document") {
    throw new Error("Invalid GitVaulty virtual document URI.");
  }
  const parameters = new URLSearchParams(uri.query);
  const sources = parameters.getAll("source");
  if (sources.length !== 1 || parameters.size !== 1) throw new Error("Invalid GitVaulty virtual document source.");
  let source: URL;
  try { source = new URL(sources[0]!); }
  catch { throw new Error("Invalid GitVaulty virtual document source."); }
  if (!SUPPORTED_SOURCE_SCHEMES.has(source.protocol.slice(0, -1)) || !source.pathname.endsWith(GITVAULTY_SUFFIX)) {
    throw new Error("Invalid GitVaulty virtual document source.");
  }
  return source.toString();
}

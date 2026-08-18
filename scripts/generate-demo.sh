#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly repo_root
readonly demo_output="demos/access-control.gif"

cleanup_demo_runtime() {
  rm -rf -- \
    /tmp/gitvaulty-readme-demo \
    /tmp/gitvaulty-readme-keys \
    /tmp/gitvaulty-readme-remote.git
}

trap cleanup_demo_runtime EXIT

missing_tools=()
for tool in git node npm terraform vhs; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing_tools+=("$tool")
  fi
done

if (( ${#missing_tools[@]} > 0 )); then
  printf 'Missing required demo tools: %s\n' "${missing_tools[*]}" >&2
  exit 1
fi

cd "$repo_root"

npm run build
vhs demos/access-control.tape

if [[ ! -s "$demo_output" ]]; then
  printf 'Demo generation did not produce %s.\n' "$demo_output" >&2
  exit 1
fi

printf 'Generated %s/%s\n' "$repo_root" "$demo_output"

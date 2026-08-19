#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly repo_root
readonly demo_output="demos/access-control.gif"

cleanup_demo_runtime() {
  if [[ -n "${demo_runtime_root:-}" ]]; then
    rm -rf -- "$demo_runtime_root"
  fi
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

demo_tmp_root="${GITVAULTY_DEMO_TMPDIR:-/tmp}"
readonly demo_tmp_root
demo_runtime_root="$(mktemp -d "$demo_tmp_root/gitvaulty-readme.XXXXXX")"
readonly demo_runtime_root
export DEMO_DIR="$demo_runtime_root/repository"
export DEMO_KEYS="$demo_runtime_root/keys"
export DEMO_REMOTE="$demo_runtime_root/remote.git"

cd "$repo_root"

npm run build
vhs demos/access-control.tape

if [[ ! -s "$demo_output" ]]; then
  printf 'Demo generation did not produce %s.\n' "$demo_output" >&2
  exit 1
fi

printf 'Generated %s/%s\n' "$repo_root" "$demo_output"

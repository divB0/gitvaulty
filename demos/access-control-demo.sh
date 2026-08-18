#!/usr/bin/env bash

set -euo pipefail

: "${GITVAULTY_CLI:?Set GITVAULTY_CLI to the built CLI entry point}"
: "${DEMO_KEYS:?Set DEMO_KEYS to the runtime identity directory}"

DEMO_USER=admin

finish() {
  local status=$?
  set +e
  if (( status == 0 )); then
    printf '\n\033[1;32m✓ Demo complete: access is reviewable in Git; every user keeps a private key.\033[0m\n'
  else
    printf '\n\033[1;31m✗ Demo failed with exit status %d.\033[0m\n' "$status"
  fi
}

trap finish EXIT

gitvaulty() {
  node "$GITVAULTY_CLI" "$@"
}

as_user() {
  DEMO_USER="$1"
  export DEMO_USER GITVAULTY_AGE_KEY_FILE="$DEMO_KEYS/$1.txt"
}

section() {
  printf '\033[2J\033[H\033[38;5;103m# %s\033[0m\n' "$1"
  sleep 2
}

prompt() {
  printf '\033[1;36m%s@gitvaulty\033[0m $ %s\n' "$DEMO_USER" "$1"
}

run_gitvaulty() {
  local read_seconds="$1"
  shift
  prompt "gitvaulty $*"
  gitvaulty "$@"
  sleep "$read_seconds"
}

section "Create dev + sre access groups"
run_gitvaulty 2 group create dev
run_gitvaulty 2 group create sre
run_gitvaulty 2 group add dev admin
run_gitvaulty 2 group add sre admin

section "Register initial developer and SRE users"
as_user alice
run_gitvaulty 2 user register alice
as_user sam
run_gitvaulty 2 user register sam
as_user admin
run_gitvaulty 2 group add dev alice
run_gitvaulty 2 group add sre sam
run_gitvaulty 4 group list

section "Local .env: dev + sre only"
run_gitvaulty 3 create .env --group dev --group sre

section "Production .env: sre only"
run_gitvaulty 3 create .env.production --group sre

section "Terraform production secrets: sre only"
prompt "mkdir -p terraform"
mkdir -p terraform
sleep 2
run_gitvaulty 3 create terraform/prod.auto.tfvars --group sre

section "Later, onboard a new developer"
as_user jules
run_gitvaulty 2 user register jules
as_user admin
run_gitvaulty 2 group add dev jules
run_gitvaulty 4 group list

section "Jules can materialize only the local .env"
as_user jules
run_gitvaulty 4 materialize
run_gitvaulty 4 status
prompt "gitvaulty cat .env.production >/dev/null"
gitvaulty cat .env.production >/dev/null || true
sleep 3
prompt "gitvaulty cat terraform/prod.auto.tfvars >/dev/null"
gitvaulty cat terraform/prod.auto.tfvars >/dev/null || true
sleep 3
run_gitvaulty 2 clean

section "Sam can use SRE-only files without leaving plaintext"
as_user sam
prompt "gitvaulty run -f .env.production -f terraform/prod.auto.tfvars -- terraform -chdir=terraform fmt -check prod.auto.tfvars"
gitvaulty run \
  -f .env.production \
  -f terraform/prod.auto.tfvars \
  -- terraform -chdir=terraform fmt -check prod.auto.tfvars
printf 'Terraform accepted SRE-only secrets.\n'
sleep 3
run_gitvaulty 4 status

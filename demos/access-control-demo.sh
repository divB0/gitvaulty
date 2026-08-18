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
  sleep 1
}

prompt() {
  printf '\033[1;36m%s@gitvaulty\033[0m $ %s\n' "$DEMO_USER" "$1"
}

run_gitvaulty() {
  prompt "gitvaulty $*"
  gitvaulty "$@"
  sleep 1
}

section "Create dev + sre access groups"
run_gitvaulty group create dev
run_gitvaulty group create sre
run_gitvaulty group add dev admin
run_gitvaulty group add sre admin

section "Register initial developer and SRE users"
as_user alice
run_gitvaulty user register alice
as_user sam
run_gitvaulty user register sam
as_user admin
run_gitvaulty group add dev alice
run_gitvaulty group add sre sam
run_gitvaulty group list

section "Local .env: dev + sre only"
run_gitvaulty create .env --group dev --group sre

section "Production .env: sre only"
run_gitvaulty create .env.production --group sre

section "Terraform production secrets: sre only"
prompt "mkdir -p terraform"
mkdir -p terraform
sleep 1
run_gitvaulty create terraform/prod.auto.tfvars --group sre

section "Later, onboard a new developer"
as_user jules
run_gitvaulty user register jules
as_user admin
run_gitvaulty group add dev jules
run_gitvaulty group list

section "Jules can materialize only the local .env"
as_user jules
run_gitvaulty materialize
run_gitvaulty status
prompt "gitvaulty cat .env.production >/dev/null"
gitvaulty cat .env.production >/dev/null || true
sleep 1
prompt "gitvaulty cat terraform/prod.auto.tfvars >/dev/null"
gitvaulty cat terraform/prod.auto.tfvars >/dev/null || true
sleep 1
run_gitvaulty clean

section "Sam can use SRE-only files without leaving plaintext"
as_user sam
prompt "gitvaulty run -f .env.production -f terraform/prod.auto.tfvars -- terraform -chdir=terraform fmt -check prod.auto.tfvars"
gitvaulty run \
  -f .env.production \
  -f terraform/prod.auto.tfvars \
  -- terraform -chdir=terraform fmt -check prod.auto.tfvars
printf 'Terraform accepted SRE-only secrets.\n'
sleep 1
run_gitvaulty status

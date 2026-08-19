#!/usr/bin/env bash

set -euo pipefail

: "${GITVAULTY_CLI:?Set GITVAULTY_CLI to the built CLI entry point}"
: "${DEMO_KEYS:?Set DEMO_KEYS to the runtime identity directory}"

DEMO_USER=admin
DEMO_NAME=Admin
DEMO_ROLE="repository owner"

finish() {
  local status=$?
  set +e
  if (( status == 0 )); then
    printf '\n\033[1;32m✓ Demo complete: one signed group grant unlocks every secret assigned to that group.\033[0m\n'
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
  case "$DEMO_USER" in
    admin)
      DEMO_NAME=Admin
      DEMO_ROLE="repository owner"
      ;;
    alice)
      DEMO_NAME=Alice
      DEMO_ROLE=dev
      ;;
    sam)
      DEMO_NAME=Sam
      DEMO_ROLE=sre
      ;;
    jules)
      DEMO_NAME=Jules
      DEMO_ROLE=dev
      ;;
    *)
      printf 'Unknown demo user: %s\n' "$DEMO_USER" >&2
      return 1
      ;;
  esac

  export DEMO_USER USER="$DEMO_USER" GITVAULTY_AGE_KEY_FILE="$DEMO_KEYS/$DEMO_USER.txt"
  git config user.name "$DEMO_NAME"
  git config user.email "$DEMO_USER@example.com"
}

section() {
  printf '\033[2J\033[H\033[1;38;5;117m# User: %s (%s)\033[0m\n' "$DEMO_NAME" "$DEMO_ROLE"
  printf '\033[38;5;103m# %s\033[0m\n' "$1"
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

run_git() {
  local read_seconds="$1"
  shift
  prompt "git $*"
  git "$@"
  sleep "$read_seconds"
}

run_git_commit() {
  local read_seconds="$1"
  local message="$2"
  prompt "git commit -m \"$message\""
  git commit -m "$message"
  sleep "$read_seconds"
}

run_git_merge() {
  local read_seconds="$1"
  local branch="$2"
  local message="$3"
  prompt "git merge --no-ff $branch -m \"$message\""
  git merge --no-ff "$branch" -m "$message"
  sleep "$read_seconds"
}

warn_demo_output() {
  printf '\033[1;33m# Demo only: do not print real secrets in a terminal.\033[0m\n'
}

publish_registration() {
  local username="$1"
  local display_name="$2"

  section "Self-register a public key on an onboarding branch"
  run_git 2 switch -c "onboard/$username"
  run_gitvaulty 3 user register
  run_git 1 add .gitvaulty/recipients.json
  run_git_commit 3 "chore: register $display_name"
  run_git 3 push -u origin "onboard/$username"
}

review_and_grant() {
  local username="$1"
  local display_name="$2"
  local group="$3"

  as_user admin
  section "Review and merge $display_name's public registration"
  run_git 2 switch main
  run_git 2 pull --ff-only
  run_git_merge 3 "onboard/$username" "merge: onboard $display_name"

  section "Grant $display_name access to $group and publish"
  run_gitvaulty 2 group add "$group" "$username"
  run_gitvaulty 4 group list
  run_git 1 add -A
  run_git_commit 3 "chore: grant $display_name $group access"
  run_git 3 push

  as_user "$username"
  section "$display_name can read every $group secret"
  warn_demo_output
  run_gitvaulty 4 cat .env --force
  if [[ "$group" == "sre" ]]; then
    run_gitvaulty 4 cat .env.production --force
    run_gitvaulty 4 cat terraform/prod.auto.tfvars --force
  fi
}

as_user admin
section "Demo 1: decrypt without storing plaintext"
warn_demo_output
run_gitvaulty 4 cat .env --force
prompt "test ! -e .env"
test ! -e .env
printf '\033[1;32m✓ No plaintext .env is stored.\033[0m\n'
sleep 4

section "Demo 2: create signed dev and sre groups"
run_gitvaulty 2 group create dev
run_gitvaulty 2 group create sre
run_gitvaulty 4 group list
run_git 1 add -A
run_git_commit 3 "chore: bootstrap GitVaulty access"
run_git 3 push -u origin main

as_user admin
section "Local .env: dev + sre only"
run_gitvaulty 3 access .env --group dev --group sre

section "Production .env: sre only"
run_gitvaulty 3 create .env.production --group sre

section "Terraform production secrets: sre only"
prompt "mkdir -p terraform"
mkdir -p terraform
sleep 2
run_gitvaulty 3 create terraform/prod.auto.tfvars --group sre

section "Commit and push the encrypted secret files"
run_git 1 add -A
run_git_commit 3 "chore: add environment secrets"
run_git 3 push

as_user alice
publish_registration alice Alice
review_and_grant alice Alice dev

as_user sam
publish_registration sam Sam
review_and_grant sam Sam sre

as_user jules
publish_registration jules Jules

as_user admin
section "Review and merge Jules's public registration"
run_git 2 switch main
run_git 2 pull --ff-only
run_git_merge 3 "onboard/jules" "merge: onboard Jules"

as_user alice
section "An ordinary dev cannot change signed membership"
prompt "gitvaulty group add dev jules"
gitvaulty group add dev jules || true
sleep 4

as_user admin
section "A dev manager signs and publishes Jules's access"
run_gitvaulty 2 group add dev jules
run_gitvaulty 4 group list
run_git 1 add -A
run_git_commit 3 "chore: grant Jules dev access"
run_git 3 push

as_user jules
section "Jules can read dev secrets, but no SRE secrets"
warn_demo_output
run_gitvaulty 4 cat .env --force
prompt "gitvaulty cat .env.production --force"
gitvaulty cat .env.production --force || true
sleep 3
prompt "gitvaulty cat terraform/prod.auto.tfvars --force"
gitvaulty cat terraform/prod.auto.tfvars --force || true
sleep 3

as_user sam
section "Use SRE-only files without leaving plaintext"
prompt "gitvaulty run -f .env.production -f terraform/prod.auto.tfvars -- terraform -chdir=terraform fmt -check prod.auto.tfvars"
gitvaulty run \
  -f .env.production \
  -f terraform/prod.auto.tfvars \
  -- terraform -chdir=terraform fmt -check prod.auto.tfvars
printf 'Terraform accepted SRE-only secrets.\n'
sleep 4

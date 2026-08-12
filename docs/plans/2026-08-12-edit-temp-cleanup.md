# Abandoned Edit Directory Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove abandoned plaintext edit directories on later GitVaulty CLI invocations without deleting an active or unsafe directory.

**Architecture:** Each edit session creates an owner-only `gitvaulty-edit-*` directory and holds a localhost TCP listener whose random token and port are written to an owner-only `.lock` file. Startup cleanup removes only exact-name directories that are owned by the current user, have owner-only permissions, are older than the grace period, have a regular owner-only lock file with valid metadata, and whose lock endpoint does not return the expected token. A live lock always wins over age.

**Tech Stack:** TypeScript, Node.js filesystem and `node:net`, Vitest

---

### Task 1: Implement the edit lock lifecycle

**Files:**
- Create: `src/edit-temp.ts`
- Create: `test/edit-temp.test.ts`
- Modify: `src/operations.ts`

**Step 1: Write failing tests**

Test that an edit session creates a `0700` directory and `0600` regular `.lock` file, reports itself as active while the process-held listener is open, and removes the directory when the session closes normally.

**Step 2: Run focused tests to prove failure**

Run: `npm test -- --run test/edit-temp.test.ts`

Expected: FAIL because the edit-temp module does not exist.

**Step 3: Implement the lock**

Create an ephemeral loopback listener on `127.0.0.1`, generate a cryptographically random token, atomically write `{ version: 1, port, token }` to `.lock`, and respond with the token only when the client sends it. Export an edit-session helper that closes the server and recursively removes the directory in `finally`-friendly cleanup. Use it in `editSecretFile`.

**Step 4: Run focused tests**

Run: `npm test -- --run test/edit-temp.test.ts test/operations.test.ts`

Expected: PASS.

### Task 2: Implement conservative abandoned-directory cleanup

**Files:**
- Modify: `src/edit-temp.ts`
- Modify: `test/edit-temp.test.ts`

**Step 1: Write failing cleanup tests**

Cover old unlocked cleanup, active locked retention regardless of age, grace-period retention, malformed and missing locks, symlink directories and lock files, wrong permissions, and ownership checks where supported. Also verify unrelated temporary directories are untouched.

**Step 2: Run focused tests to prove failure**

Run: `npm test -- --run test/edit-temp.test.ts`

Expected: FAIL because cleanup is not implemented.

**Step 3: Implement cleanup**

Enumerate only the direct children of the configured temp root. Use `lstat`, reject symlinks and non-directories, require current-user ownership on POSIX, require no group/other permission bits, require an old-enough directory, require a regular owner-only lock file with valid version/port/token fields, then probe the loopback lock with short bounded timeouts. Remove only when every structural check passes and the probe does not return the expected token.

**Step 4: Run focused tests**

Run: `npm test -- --run test/edit-temp.test.ts`

Expected: PASS.

### Task 3: Wire startup cleanup and document it

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `test/cli.test.ts`
- Modify: `README.md`

**Step 1: Write failing CLI test**

Verify `main` invokes abandoned-edit cleanup before parsing a command and that cleanup failure does not prevent the requested command from running.

**Step 2: Implement startup wiring**

Call cleanup at CLI startup. Keep cleanup best-effort and silent so an unavailable or unusual temp directory cannot make GitVaulty unusable. Export the cleanup function for library callers and tests.

**Step 3: Document behavior**

Explain normal immediate cleanup, process-held locks, the grace period, conservative safety checks, and automatic cleanup on a later invocation after a crash or `SIGKILL`.

**Step 4: Verify and commit**

Run: `npm run check && git diff --check`

Expected: all tests, type checking, build, CLI smoke test, and whitespace checks pass.

Run: `git add -A && git commit -m "feat: clean abandoned edit directories"`


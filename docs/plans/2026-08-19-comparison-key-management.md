# Cross-repository Key Management Comparison Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compare the backup and management burden of private keys across repositories in every competitor comparison.

**Architecture:** Add one consistently named `Key management` row to each comparison table. Keep GitVaulty's description consistent, tailor the competitor column to its documented identity scope, and reflect the distinction in each recommendation without hiding the compromise-radius trade-off.

**Tech Stack:** Markdown documentation, official upstream documentation, repository documentation checks.

---

### Task 1: Add the comparison dimension

**Files:**
- Modify: `docs/comparisons/agebox.md`
- Modify: `docs/comparisons/cottage.md`
- Modify: `docs/comparisons/dotenvx.md`

**Step 1:** Add a `Key management` row after the encryption-related row in all three tables.

**Step 2:** Describe GitVaulty's default global native age identity as one key to back up and manage across repositories, while noting the separate-identity override and global compromise radius.

**Step 3:** Contrast Agebox's externally managed keys, Cottage's repository-local default and global alternatives, and dotenvx's per-env-file keypairs.

**Step 4:** Update the recommendation and source text where the new dimension affects product choice.

**Step 5:** Set each comparison's verification date to `2026-08-19`.

### Task 2: Verify and commit

**Files:**
- Verify: `docs/comparisons/*.md`

**Step 1:** Inspect the complete diff for consistent wording and accurate trade-offs.

**Step 2:** Run the repository's full `npm run check` validation.

**Step 3:** Run the Markdown link checker used by the project documentation workflow.

**Step 4:** Commit the plan and comparison updates together with a documentation-scoped message.

# README Information Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the README into a task-oriented, multi-level chapter structure that is easier to scan and navigate.

**Architecture:** Introduce six top-level chapters and move the existing material beneath the appropriate chapter without changing its user-facing guidance. Keep established section anchors stable where practical, including an explicit `edit` anchor for the renamed editing chapter.

**Tech Stack:** Markdown, GitHub heading anchors, the repository's existing npm validation commands.

---

### Task 1: Reorganize the README

**Files:**
- Modify: `README.md`

**Step 1:** Replace the flat contents list with the approved two-level chapter hierarchy.

**Step 2:** Reorder the existing sections so the README body follows the contents order.

**Step 3:** Adjust heading levels and retain existing deep links where practical.

### Task 2: Validate and commit

**Files:**
- Test: `README.md`

**Step 1:** Check that every table-of-contents fragment resolves to a heading or explicit anchor.

**Step 2:** Run the repository test suite and Markdown formatting checks.

**Step 3:** Review the final diff for unintended content changes.

**Step 4:** Commit the README and plan together with a documentation-scoped commit message.

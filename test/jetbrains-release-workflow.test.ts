import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface WorkflowStep {
  name?: string;
  run?: string;
}

interface WorkflowJob {
  name?: string;
  if?: string;
  needs?: string | string[];
  steps?: WorkflowStep[];
}

interface Workflow {
  jobs: Record<string, WorkflowJob>;
}

function releaseWorkflow(): Workflow {
  return parse(
    readFileSync(path.join(repositoryRoot, ".github/workflows/jetbrains-release.yml"), "utf8"),
  ) as Workflow;
}

function stepScript(job: WorkflowJob, name: string): string {
  const step = job.steps?.find((candidate) => candidate.name === name);
  expect(step, `missing workflow step: ${name}`).toBeDefined();
  return step?.run ?? "";
}

describe("JetBrains release workflow", () => {
  it("publishes GitHub assets before automatically publishing a tagged plugin", () => {
    const workflow = releaseWorkflow();
    const githubRelease = workflow.jobs["github-release"];
    const marketplace = workflow.jobs.marketplace;

    expect(githubRelease?.name).toBe("Publish GitHub Release");
    expect(stepScript(githubRelease ?? {}, "Prepare release notes")).toContain(
      "jetbrains/CHANGELOG.md",
    );
    const releaseScript = stepScript(githubRelease ?? {}, "Publish release assets");
    const createIndex = releaseScript.indexOf("gh release create");
    expect(createIndex).toBeGreaterThanOrEqual(0);
    const createInvocation = releaseScript.slice(createIndex);
    expect(createInvocation).not.toMatch(/\n\s+--draft(?:\s|\\)/);
    expect(releaseScript).toContain('gh release edit "$RELEASE_TAG"');
    expect(releaseScript.match(/--draft=false/g)).toHaveLength(1);
    expect(releaseScript.match(/--latest=false/g)).toHaveLength(2);
    expect(releaseScript.match(/--notes-file release-notes\.md/g)).toHaveLength(2);

    expect(marketplace?.if).toContain("github.event_name == 'push'");
    expect(marketplace?.if).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.publish_marketplace",
    );
    expect(marketplace?.needs).toBe("github-release");
  });
});

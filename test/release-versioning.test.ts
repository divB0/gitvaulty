import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface WorkflowStep {
  uses?: string;
  with?: Record<string, unknown>;
  run?: string;
}

interface WorkflowJob {
  if?: string;
  steps?: WorkflowStep[];
}

interface Workflow {
  on?: { push?: { tags?: string[] }; release?: { types?: string[] } };
  env?: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
}

function text(file: string): string {
  return readFileSync(path.join(repositoryRoot, file), "utf8");
}

function jsonVersion(file: string): string {
  return (JSON.parse(text(file)) as { version: string }).version;
}

function workflow(file: string): Workflow {
  return parse(text(file)) as Workflow;
}

function checkoutSteps(releaseWorkflow: Workflow): WorkflowStep[] {
  return Object.values(releaseWorkflow.jobs).flatMap((job) =>
    (job.steps ?? []).filter((step) => step.uses?.startsWith("actions/checkout@")),
  );
}

describe("unified release versioning", () => {
  it("keeps every shipped editor version synchronized with the root package", () => {
    const expected = jsonVersion("package.json");

    expect(jsonVersion("vscode/package.json")).toBe(expected);
    expect(jsonVersion("vscode/package-lock.json")).toBe(expected);
    expect(jsonVersion("editor-runtime/package.json")).toBe(expected);
    expect(jsonVersion("editor-runtime/package-lock.json")).toBe(expected);
    expect(text("jetbrains/build.gradle.kts")).toContain(`version = "${expected}"`);
    expect(text("editor-runtime/scripts/package-tools.mjs")).toContain(
      `RUNTIME_VERSION = "${expected}"`,
    );
    expect(text("editor-runtime/src/bridge.ts")).toContain(`runtimeVersion: "${expected}"`);
    expect(JSON.parse(text("jetbrains/src/main/resources/gitvaulty-runtime-manifest.json")))
      .toMatchObject({ runtimeVersion: expected });
  });

  it("uses one vX.Y.Z tag and checks out that exact tag in every publisher", () => {
    const jetbrains = workflow(".github/workflows/jetbrains-release.yml");
    const vscode = workflow(".github/workflows/vscode-release.yml");
    const npm = workflow(".github/workflows/publish.yml");

    expect(jetbrains.on?.push?.tags).toEqual(["v*"]);
    expect(vscode.on?.push?.tags).toEqual(["v*"]);
    expect(npm.on?.release?.types).toEqual(["published"]);

    for (const releaseWorkflow of [jetbrains, vscode]) {
      expect(releaseWorkflow.env?.RELEASE_TAG).toContain("github.ref_name");
    }
    expect(npm.env?.RELEASE_TAG).toContain("github.event.release.tag_name");
    for (const releaseWorkflow of [jetbrains, vscode, npm]) {
      const checkouts = checkoutSteps(releaseWorkflow);
      expect(checkouts.length).toBeGreaterThan(0);
      expect(checkouts.every((step) => step.with?.ref === "${{ env.RELEASE_TAG }}")).toBe(true);
    }

    const sources = [
      text(".github/workflows/jetbrains-release.yml"),
      text(".github/workflows/vscode-release.yml"),
      text(".github/workflows/publish.yml"),
    ].join("\n");
    expect(sources).not.toContain("jetbrains-v");
    expect(sources).not.toContain("vscode-v");
    expect(sources).toContain("require('./package.json').version");
    expect(npm.jobs.publish?.if).toContain("github.event.release.tag_name");
  });
});

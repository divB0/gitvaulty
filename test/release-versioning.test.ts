import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface WorkflowStep {
  id?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  run?: string;
}

interface WorkflowJob {
  if?: string;
  needs?: string;
  environment?: string;
  permissions?: Record<string, string>;
  steps?: WorkflowStep[];
  uses?: string;
  with?: Record<string, unknown>;
}

interface Workflow {
  on?: {
    push?: { tags?: string[] };
    workflow_call?: { inputs?: { tag?: { required?: boolean; type?: string } } };
  };
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
    expect(npm.on?.workflow_call?.inputs?.tag).toMatchObject({ required: true, type: "string" });

    for (const releaseWorkflow of [jetbrains, vscode]) {
      expect(releaseWorkflow.env?.RELEASE_TAG).toContain("github.ref_name");
    }
    expect(npm.env?.RELEASE_TAG).toBe("${{ inputs.tag }}");
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
    expect(jetbrains.jobs.npm).toMatchObject({
      needs: "github-release",
      uses: "./.github/workflows/publish.yml",
      with: { tag: "${{ github.event_name == 'push' && github.ref_name || inputs.tag }}" },
    });
  });

  it("publishes Homebrew immediately after npm with a repository-scoped App token", () => {
    const release = workflow(".github/workflows/jetbrains-release.yml");
    const homebrew = release.jobs.homebrew;

    expect(homebrew).toMatchObject({
      needs: "npm",
      permissions: { contents: "read" },
    });
    if (!homebrew) throw new Error("Homebrew release job is missing.");

    const token = homebrew.steps?.find((step) => step.id === "app-token");
    expect(token).toMatchObject({
      uses: "actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1",
      with: {
        "client-id": "${{ vars.HOMEBREW_APP_CLIENT_ID }}",
        "private-key": "${{ secrets.HOMEBREW_APP_PRIVATE_KEY }}",
        owner: "${{ github.repository_owner }}",
        repositories: "homebrew-tap",
        "permission-actions": "write",
      },
    });

    const publish = homebrew.steps?.find((step) => step.run?.includes("gh workflow run update.yml"));
    expect(publish?.env).toEqual({ GH_TOKEN: "${{ steps.app-token.outputs.token }}" });
    expect(publish?.run).toMatch(/\[\[ "\$RELEASE_TAG" =~ \^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$ \]\]/);
    expect(publish?.run).toContain("--repo divB0/homebrew-tap");
    expect(publish?.run).toContain('-f version="$version"');
    expect(publish?.run).toContain('-f request_id="$request_id"');
    expect(publish?.run).toContain("display_title == $run_title");
    expect(publish?.run).toContain('gh run watch "$run_id"');
    expect(publish?.run).toContain("--exit-status");
  });

  it("publishes VS Code packages with a federated Entra identity", () => {
    const source = text(".github/workflows/vscode-release.yml");
    const release = workflow(".github/workflows/vscode-release.yml");
    const publish = release.jobs.publish;
    const extensionPackage = JSON.parse(text("vscode/package.json")) as {
      devDependencies?: Record<string, string>;
    };

    expect(publish?.environment).toBe("vscode-marketplace");
    expect(publish?.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(extensionPackage.devDependencies?.["@vscode/vsce"]).toBe("3.9.2");
    expect(source).not.toContain("VSCE_PAT");
    expect(source).not.toContain("--pat");
    expect(source).not.toContain("--oidc");

    const azureLogin = publish?.steps?.find((step) => step.uses?.startsWith("Azure/login@"));
    expect(azureLogin).toMatchObject({
      uses: "Azure/login@f5d393ae46f8fde4be8b75f32e3fc50e654ad0ca",
      with: {
        "client-id": "${{ vars.AZURE_CLIENT_ID }}",
        "tenant-id": "${{ vars.AZURE_TENANT_ID }}",
        "subscription-id": "${{ vars.AZURE_SUBSCRIPTION_ID }}",
      },
    });

    const download = publish?.steps?.find(
      (step) => step.uses === "actions/download-artifact@v6",
    );
    expect(download?.with).toMatchObject({ pattern: "gitvaulty-*", "merge-multiple": true });

    const publishPackages = publish?.steps?.find((step) =>
      step.run?.includes("npx vsce publish"),
    );
    expect(publishPackages?.run).toContain('test "${#packages[@]}" -eq 5');
    expect(publishPackages?.run).toContain(
      'npx vsce publish --azure-credential --packagePath "$package"',
    );

    const identity = workflow(".github/workflows/vscode-publisher-identity.yml");
    const resolve = identity.jobs.resolve;
    expect(resolve).toMatchObject({
      environment: "vscode-marketplace",
      permissions: { contents: "read", "id-token": "write" },
    });
    expect(resolve?.steps?.find((step) => step.uses?.startsWith("Azure/login@"))).toEqual(
      azureLogin,
    );
    const profile = resolve?.steps?.find((step) => step.run?.includes("profiles/me"));
    expect(profile?.run).toContain("499b84ac-1321-427f-aa17-267ca6975798");
    expect(profile?.run).toContain("Marketplace publisher identity");
  });
});

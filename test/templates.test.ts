import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/templates.js";

describe("renderTemplate", () => {
  it("renders nested primitives and JSON values", () => {
    expect(renderTemplate("PORT={{env.PORT}}\nCONFIG={{json terraform.config}}\n", {
      env: { PORT: 3000 }, terraform: { config: { enabled: true } },
    })).toBe('PORT=3000\nCONFIG={"enabled":true}\n');
  });

  it("rejects missing and unencoded object values", () => {
    expect(() => renderTemplate("{{missing}}", {})).toThrow("Template value not found");
    expect(() => renderTemplate("{{config}}", { config: {} })).toThrow("requires the json helper");
  });
});


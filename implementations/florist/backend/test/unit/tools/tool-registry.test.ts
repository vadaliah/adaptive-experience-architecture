import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTool } from "../../support/fixtures.js";


type Registry = typeof import("../../../src/tools/tool-registry.js");

let registry: Registry;


/*
 * The registry is module-level state with no reset, so each
 * test loads a fresh module instance.
 */
beforeEach(async () => {
  vi.resetModules();
  registry = await import("../../../src/tools/tool-registry.js");
});


describe("tool-registry", () => {

  it("returns a registered tool by name", () => {
    const tool = createTestTool({ name: "alpha" });

    registry.appendTool(tool);

    expect(registry.getTool("alpha")).toBe(tool);
  });


  it("returns undefined for an unknown tool name", () => {
    expect(registry.getTool("missing")).toBeUndefined();
  });


  it("returns an empty list when no tools are registered", () => {
    expect(registry.getAllTools()).toEqual([]);
  });


  it("returns all registered tools in registration order", () => {
    const alpha = createTestTool({ name: "alpha" });
    const beta = createTestTool({ name: "beta" });

    registry.appendTool(alpha);
    registry.appendTool(beta);

    expect(registry.getAllTools()).toEqual([alpha, beta]);
  });


  it("rejects a duplicate tool name and keeps the original", () => {
    const original = createTestTool({ name: "alpha" });
    const duplicate = createTestTool({ name: "alpha" });

    registry.appendTool(original);

    expect(() => registry.appendTool(duplicate)).toThrow(
      "Tool already exists: alpha"
    );

    expect(registry.getTool("alpha")).toBe(original);
    expect(registry.getAllTools()).toHaveLength(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolDefinition } from "../../../src/tools/tool-registry.js";


const { searchProducts, CatalogRepository } = vi.hoisted(() => {
  const searchProducts = vi.fn();

  const CatalogRepository = vi.fn(function (this: any) {
    this.searchProducts = searchProducts;
  });

  return { searchProducts, CatalogRepository };
});

vi.mock("../../../src/repositories/catalog-repository.js", () => ({
  CatalogRepository
}));


let tool: ToolDefinition<any, any>;


/*
 * The tool registers itself on import, so each test loads a
 * fresh registry and tool module.
 */
beforeEach(async () => {
  vi.resetModules();
  searchProducts.mockReset();
  CatalogRepository.mockClear();

  vi.spyOn(console, "log").mockImplementation(() => {});

  await import("../../../src/tools/search-products-tool.js");

  const registry = await import("../../../src/tools/tool-registry.js");

  tool = registry.getTool("searchProducts")!;
});


describe("searchProducts tool", () => {

  it("registers itself as searchProducts on import", () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe("searchProducts");
    expect(tool.description).toEqual(expect.any(String));
  });


  it("creates a single catalog repository at import time", () => {
    expect(CatalogRepository).toHaveBeenCalledTimes(1);
  });


  it("maps its result dataset from the products field", () => {
    expect(tool.resultDefinition.datasetField).toBe("products");
  });


  it("requires returnAllProducts in its request schema", () => {
    expect(tool.inputSchema).toMatchObject({
      type: "object",
      properties: {
        returnAllProducts: { type: "boolean" }
      },
      required: ["returnAllProducts"]
    });
  });


  it("declares title and qualifiers in its metadata schema", () => {
    const { metadataSchema } = tool.resultDefinition;

    expect(metadataSchema.title.type).toBe("string");
    expect(metadataSchema.qualifiers.type).toBe("array");
    expect(metadataSchema.qualifiers.items).toEqual({ type: "string" });
  });


  it("delegates the request to the repository and wraps the products", async () => {
    const products = [{ productId: 1 }, { productId: 2 }];
    searchProducts.mockResolvedValue(products);

    const input = { returnAllProducts: true };

    const result = await tool.execute(input);

    expect(searchProducts).toHaveBeenCalledTimes(1);
    expect(searchProducts).toHaveBeenCalledWith(input);

    expect(result).toEqual({
      function: "searchProducts",
      request: input,
      products
    });
  });


  it("propagates repository errors", async () => {
    searchProducts.mockRejectedValue(new Error("db unavailable"));

    await expect(
      tool.execute({ returnAllProducts: true })
    ).rejects.toThrow("db unavailable");
  });
});

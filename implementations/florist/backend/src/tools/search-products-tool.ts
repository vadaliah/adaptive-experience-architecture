import type { ProductSearchRequest } from "../models/product-search-request.js";
import type { ToolDefinition } from "./tool-registry.js";
import { appendTool } from "./tool-registry.js";
import { CatalogRepository } from "../repositories/catalog-repository.js";

type ProductSearchResult = {
  function: string;
  request: ProductSearchRequest;
  products: unknown[];
};

const catalogRepository = new CatalogRepository();

const searchProductsTool: ToolDefinition<
  ProductSearchRequest,
  ProductSearchResult
> = {
  name: "searchProducts",

  description:
    "Search Lily's product inventory. Use this function when the customer wants to view products Lily offers.",

  inputSchema: {
    type: "object",
    properties: {
      returnAllProducts: {
        type: "boolean",
        description:
          "Set to true when the customer wants to see everything Lily has to offer."
      }
    },
    required: ["returnAllProducts"]
  },

  execute: async (input) => {
    console.log("Executing searchProducts");
    console.log("returnAllProducts:", input.returnAllProducts);

    const products =
      await catalogRepository.searchProducts(input);

    return {
      function: "searchProducts",
      request: input,
      products
    };
  }
};

appendTool(searchProductsTool);
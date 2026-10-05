import { beforeEach, describe, expect, it, vi } from "vitest";


const { query, Pool } = vi.hoisted(() => {
  const query = vi.fn();

  const Pool = vi.fn(function (this: any) {
    this.query = query;
  });

  return { query, Pool };
});

vi.mock("pg", () => ({
  default: { Pool }
}));


import { CatalogRepository } from "../../../src/repositories/catalog-repository.js";


function stubDatabaseEnv(): void {
  vi.stubEnv("DB_HOST", "db.test.local");
  vi.stubEnv("DB_PORT", undefined);
  vi.stubEnv("DB_NAME", "catalog");
  vi.stubEnv("DB_USER", "tester");
  vi.stubEnv("DB_PASSWORD", "secret");
}


beforeEach(() => {
  query.mockReset();
  Pool.mockClear();

  vi.spyOn(console, "log").mockImplementation(() => {});

  stubDatabaseEnv();
});


describe("CatalogRepository constructor", () => {

  it.each(["DB_HOST", "DB_NAME", "DB_USER"])(
    "throws when %s is missing",
    (name) => {
      vi.stubEnv(name, undefined);

      expect(() => new CatalogRepository()).toThrow(
        "DB_HOST, DB_NAME and DB_USER environment variables are required."
      );

      expect(Pool).not.toHaveBeenCalled();
    }
  );


  it("configures the pool from the environment", () => {
    new CatalogRepository();

    expect(Pool).toHaveBeenCalledTimes(1);
    expect(Pool).toHaveBeenCalledWith({
      host: "db.test.local",
      port: 5432,
      database: "catalog",
      user: "tester",
      password: "secret",
      ssl: {
        rejectUnauthorized: false
      }
    });
  });


  it("parses DB_PORT as a number", () => {
    vi.stubEnv("DB_PORT", "6543");

    new CatalogRepository();

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ port: 6543 })
    );
  });


  it("does not require DB_PASSWORD", () => {
    vi.stubEnv("DB_PASSWORD", undefined);

    new CatalogRepository();

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ password: undefined })
    );
  });
});


describe("CatalogRepository.searchProducts", () => {

  it("maps database rows to product records", async () => {
    query.mockResolvedValue({
      rowCount: 2,
      rows: [
        {
          product_id: "P001",
          product_name: "Lily Bouquet",
          product_short_description: "White lilies",
          product_type: "bouquet",
          product_price_usd: "49.99",
          quantity: "12"
        },
        {
          product_id: "P002",
          product_name: "Rose Vase",
          product_short_description: null,
          product_type: null,
          product_price_usd: 19,
          quantity: 0
        }
      ]
    });

    const repository = new CatalogRepository();

    const products = await repository.searchProducts({
      returnAllProducts: true
    });

    expect(products).toEqual([
      {
        productId: "P001",
        productName: "Lily Bouquet",
        productDescription: "White lilies",
        productType: "bouquet",
        priceUsd: 49.99,
        quantity: 12
      },
      {
        productId: "P002",
        productName: "Rose Vase",
        productDescription: null,
        productType: null,
        priceUsd: 19,
        quantity: 0
      }
    ]);
  });


  it("keeps null and undefined price and quantity as null", async () => {
    query.mockResolvedValue({
      rowCount: 2,
      rows: [
        {
          product_id: "P001",
          product_name: "No Price",
          product_short_description: null,
          product_type: null,
          product_price_usd: null,
          quantity: null
        },
        {
          product_id: "P002",
          product_name: "Missing Joins",
          product_short_description: null,
          product_type: null
        }
      ]
    });

    const repository = new CatalogRepository();

    const products = await repository.searchProducts({
      returnAllProducts: true
    });

    expect(products.map((p) => [p.priceUsd, p.quantity])).toEqual([
      [null, null],
      [null, null]
    ]);
  });


  it("returns an empty list when no rows are found", async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const repository = new CatalogRepository();

    await expect(
      repository.searchProducts({ returnAllProducts: true })
    ).resolves.toEqual([]);
  });


  it("executes a single unparameterized query", async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const repository = new CatalogRepository();

    await repository.searchProducts({ returnAllProducts: true });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.any(String));
  });


  /*
   * Documents current behavior: the request is not used to
   * filter results. returnAllProducts: false still returns the
   * full catalog.
   */
  it("currently ignores returnAllProducts and returns all rows", async () => {
    query.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          product_id: "P001",
          product_name: "Lily Bouquet",
          product_short_description: null,
          product_type: null,
          product_price_usd: "10",
          quantity: "1"
        }
      ]
    });

    const repository = new CatalogRepository();

    const products = await repository.searchProducts({
      returnAllProducts: false
    });

    expect(products).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(expect.any(String));
  });


  it("propagates query errors", async () => {
    query.mockRejectedValue(new Error("connection refused"));

    const repository = new CatalogRepository();

    await expect(
      repository.searchProducts({ returnAllProducts: true })
    ).rejects.toThrow("connection refused");
  });
});

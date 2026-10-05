import pg from "pg";
import type { ProductSearchRequest } from "../models/product-search-request.js";

const { Pool } = pg;

export type ProductRecord = {
  productId: string;
  productName: string;
  productDescription: string | null;
  productType: string | null;
  priceUsd: number | null;
  quantity: number | null;
};

export class CatalogRepository {
  private readonly pool: pg.Pool;

  constructor() {
    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT ?? 5432);
    const database = process.env.DB_NAME;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;

    if (!host || !database || !user) {
      throw new Error(
        "DB_HOST, DB_NAME and DB_USER environment variables are required."
      );
    }

    this.pool = new Pool({
        host,
        port,
        database,
        user,
        password,
        ssl: {
          rejectUnauthorized: false
        }
      });
  }

  async searchProducts(
    request: ProductSearchRequest
  ): Promise<ProductRecord[]> {

    console.log("CatalogRepository.searchProducts");
    console.log("Request:", request);

    const sql = `
      SELECT
        p.product_id,
        p.product_name,
        p.product_short_description,
        p.product_type,
        pp.product_price_usd,
        pi.quantity
      FROM product p
      LEFT JOIN product_price pp
        ON pp.product_id = p.product_id
      LEFT JOIN product_inventory pi
        ON pi.product_id = p.product_id
      ORDER BY p.product_name
    `;

    const start = Date.now();

    const result = await this.pool.query(sql);

    const durationMs = Date.now() - start;

    console.log(
        `CatalogRepository.searchProducts returned ${result.rowCount ?? 0} rows in ${durationMs} ms`
      );

    return result.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      productDescription: row.product_short_description,
      productType: row.product_type,
      priceUsd:
        row.product_price_usd == null
          ? null
          : Number(row.product_price_usd),
      quantity:
        row.quantity == null
          ? null
          : Number(row.quantity)
    }));
  }
}
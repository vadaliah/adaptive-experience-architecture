import pg from "pg";
import type { ProductRecord } from "./catalog-repository.js";

export interface Campaign {
  campaignId: string;
  campaignName: string;
  campaignDescription: string | null;
  displaySequence: number;
}
export interface CampaignStore {
  listCampaigns(): Promise<Campaign[]>;
  findCampaign(campaignId: string): Promise<Campaign | undefined>;
  getCampaignProducts(campaignId: string): Promise<ProductRecord[]>;
}

export class CampaignRepository implements CampaignStore {
  private pool?: Pick<pg.Pool, "query">;
  constructor(pool?: Pick<pg.Pool, "query">) {
    this.pool = pool;
  }
  private get db(): Pick<pg.Pool, "query"> {
    if (!this.pool) {
      const {
        DB_HOST: host,
        DB_NAME: database,
        DB_USER: user,
        DB_PASSWORD: password,
      } = process.env;
      if (!host || !database || !user)
        throw new Error(
          "DB_HOST, DB_NAME and DB_USER environment variables are required.",
        );
      this.pool = new pg.Pool({
        host,
        database,
        user,
        password,
        port: Number(process.env.DB_PORT ?? 5432),
        ssl: { rejectUnauthorized: false },
      });
    }
    return this.pool;
  }
  async listCampaigns(): Promise<Campaign[]> {
    const result = await this.db.query<Campaign>(`
      SELECT campaign_id AS "campaignId", campaign_name AS "campaignName",
             campaign_description AS "campaignDescription", display_sequence AS "displaySequence"
      FROM marketing_campaign ORDER BY display_sequence, campaign_id`);
    return result.rows;
  }
  async findCampaign(campaignId: string): Promise<Campaign | undefined> {
    const result = await this.db.query<Campaign>(
      `
      SELECT campaign_id AS "campaignId", campaign_name AS "campaignName",
             campaign_description AS "campaignDescription", display_sequence AS "displaySequence"
      FROM marketing_campaign WHERE campaign_id = $1`,
      [campaignId],
    );
    return result.rows[0];
  }
  async getCampaignProducts(campaignId: string): Promise<ProductRecord[]> {
    const result = await this.db.query(
      `
      SELECT p.product_id, p.product_name, p.product_short_description, p.product_type,
             pp.product_price_usd, pi.quantity
      FROM product_campaign_assignment a
      JOIN product p ON p.product_id = a.product_id
      LEFT JOIN product_price pp ON pp.product_id = p.product_id
      LEFT JOIN product_inventory pi ON pi.product_id = p.product_id
      WHERE a.campaign_id = $1
      ORDER BY p.product_name, p.product_id`,
      [campaignId],
    );
    return result.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      productDescription: row.product_short_description,
      productType: row.product_type,
      priceUsd:
        row.product_price_usd == null ? null : Number(row.product_price_usd),
      quantity: row.quantity == null ? null : Number(row.quantity),
    }));
  }
}

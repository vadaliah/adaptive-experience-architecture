-- 003-reconcile-historical-schema.sql
-- V003: reconcile the historical combined deployment; no business-data changes.
\set ON_ERROR_STOP on
\timing on
\echo 'START 003-reconcile-historical-schema.sql'
SELECT clock_timestamp() AS artifact_started_at;
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '10s';
-- Reject canonical or partially renamed databases before any rename.
DO $preflight$
BEGIN
  IF to_regclass('public.product_category_assignment') IS NOT NULL
     OR to_regclass('public.product_campaign_assignment') IS NOT NULL THEN
    RAISE EXCEPTION 'V003 requires the historical combined schema, not canonical/partial names';
  END IF;
  IF EXISTS (SELECT FROM unnest(ARRAY['category','product_category','product_campaign',
      'product','product_price','product_inventory','marketing_campaign']) t(name)
      WHERE to_regclass('public.' || t.name) IS NULL) THEN
    RAISE EXCEPTION 'V003 requires all historical combined-schema tables';
  END IF;
END
$preflight$;
-- Keep preflight and renames stable against concurrent DDL/writes until commit.
LOCK TABLE public.category, public.product_category, public.product_campaign,
  public.product, public.product_price, public.product_inventory, public.marketing_campaign
  IN ACCESS EXCLUSIVE MODE;
DO $structure$
DECLARE
  expected CONSTANT jsonb := $expected$
{
  "product": {
    "columns": [
      ["product_id", "character varying(50)", true, null],
      ["product_name", "character varying(150)", true, null],
      ["product_short_description", "character varying(255)", false, null],
      ["product_long_description", "text", false, null],
      ["product_thumbnail_reference", "character varying(500)", false, null],
      ["product_type", "character varying(100)", true, null]
    ],
    "indexes": [
      ["idx_product_product_type", false, false, true, true, "CREATE INDEX idx_product_product_type ON public.product USING btree (product_type)"],
      ["product_pkey", true, true, true, true, "CREATE UNIQUE INDEX product_pkey ON public.product USING btree (product_id)"]
    ],
    "constraints": [
      ["product_pkey", "p", true, false, false, "PRIMARY KEY (product_id)"]
    ]
  },
  "product_price": {
    "columns": [
      ["product_id", "character varying(50)", true, null],
      ["product_price_usd", "numeric(10,2)", true, null]
    ],
    "indexes": [
      ["product_price_pkey", true, true, true, true, "CREATE UNIQUE INDEX product_price_pkey ON public.product_price USING btree (product_id)"]
    ],
    "constraints": [
      ["fk_product_price_product", "f", true, false, false, "FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE"],
      ["product_price_pkey", "p", true, false, false, "PRIMARY KEY (product_id)"],
      ["product_price_product_price_usd_check", "c", true, false, false, "CHECK ((product_price_usd >= (0)::numeric))"]
    ]
  },
  "product_inventory": {
    "columns": [
      ["product_id", "character varying(50)", true, null],
      ["quantity", "integer", true, "0"]
    ],
    "indexes": [
      ["product_inventory_pkey", true, true, true, true, "CREATE UNIQUE INDEX product_inventory_pkey ON public.product_inventory USING btree (product_id)"]
    ],
    "constraints": [
      ["fk_product_inventory_product", "f", true, false, false, "FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE"],
      ["product_inventory_pkey", "p", true, false, false, "PRIMARY KEY (product_id)"],
      ["product_inventory_quantity_check", "c", true, false, false, "CHECK ((quantity >= 0))"]
    ]
  },
  "category": {
    "columns": [
      ["category_id", "character varying(50)", true, null],
      ["category_name", "character varying(100)", true, null],
      ["category_description", "text", false, null],
      ["seasonal_flag", "boolean", true, "false"]
    ],
    "indexes": [
      ["category_category_name_key", true, false, true, true, "CREATE UNIQUE INDEX category_category_name_key ON public.category USING btree (category_name)"],
      ["category_pkey", true, true, true, true, "CREATE UNIQUE INDEX category_pkey ON public.category USING btree (category_id)"]
    ],
    "constraints": [
      ["category_category_name_key", "u", true, false, false, "UNIQUE (category_name)"],
      ["category_pkey", "p", true, false, false, "PRIMARY KEY (category_id)"]
    ]
  },
  "product_category": {
    "columns": [
      ["product_id", "character varying(50)", true, null],
      ["category_id", "character varying(50)", true, null]
    ],
    "indexes": [
      ["idx_product_category_category", false, false, true, true, "CREATE INDEX idx_product_category_category ON public.product_category USING btree (category_id)"],
      ["product_category_pkey", true, true, true, true, "CREATE UNIQUE INDEX product_category_pkey ON public.product_category USING btree (product_id, category_id)"]
    ],
    "constraints": [
      ["fk_product_category_category", "f", true, false, false, "FOREIGN KEY (category_id) REFERENCES category(category_id) ON DELETE CASCADE"],
      ["fk_product_category_product", "f", true, false, false, "FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE"],
      ["product_category_pkey", "p", true, false, false, "PRIMARY KEY (product_id, category_id)"]
    ]
  },
  "marketing_campaign": {
    "columns": [
      ["campaign_id", "character varying(50)", true, null],
      ["campaign_name", "character varying(100)", true, null],
      ["campaign_description", "text", false, null],
      ["display_sequence", "integer", true, "0"]
    ],
    "indexes": [
      ["idx_marketing_campaign_display_sequence", false, false, true, true, "CREATE INDEX idx_marketing_campaign_display_sequence ON public.marketing_campaign USING btree (display_sequence)"],
      ["marketing_campaign_campaign_name_key", true, false, true, true, "CREATE UNIQUE INDEX marketing_campaign_campaign_name_key ON public.marketing_campaign USING btree (campaign_name)"],
      ["marketing_campaign_pkey", true, true, true, true, "CREATE UNIQUE INDEX marketing_campaign_pkey ON public.marketing_campaign USING btree (campaign_id)"]
    ],
    "constraints": [
      ["marketing_campaign_campaign_name_key", "u", true, false, false, "UNIQUE (campaign_name)"],
      ["marketing_campaign_display_sequence_check", "c", true, false, false, "CHECK ((display_sequence >= 0))"],
      ["marketing_campaign_pkey", "p", true, false, false, "PRIMARY KEY (campaign_id)"]
    ]
  },
  "product_campaign": {
    "columns": [
      ["product_id", "character varying(50)", true, null],
      ["campaign_id", "character varying(50)", true, null]
    ],
    "indexes": [
      ["idx_product_campaign_campaign", false, false, true, true, "CREATE INDEX idx_product_campaign_campaign ON public.product_campaign USING btree (campaign_id)"],
      ["product_campaign_pkey", true, true, true, true, "CREATE UNIQUE INDEX product_campaign_pkey ON public.product_campaign USING btree (product_id, campaign_id)"]
    ],
    "constraints": [
      ["fk_product_campaign_campaign", "f", true, false, false, "FOREIGN KEY (campaign_id) REFERENCES marketing_campaign(campaign_id) ON DELETE CASCADE"],
      ["fk_product_campaign_product", "f", true, false, false, "FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE"],
      ["product_campaign_pkey", "p", true, false, false, "PRIMARY KEY (product_id, campaign_id)"]
    ]
  }
}
$expected$::jsonb;
  item record;
  target regclass;
  actual_structure jsonb;
BEGIN
  FOR item IN SELECT key AS table_name, value AS spec FROM jsonb_each(expected) LOOP
    target := to_regclass(format('public.%I', item.table_name));
    SELECT jsonb_build_object(
  'columns', (SELECT jsonb_agg(jsonb_build_array(a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
              FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
              WHERE a.attrelid=target AND a.attnum>0 AND NOT a.attisdropped),
  'constraints', (SELECT jsonb_agg(jsonb_build_array(c.conname, c.contype, c.convalidated, c.condeferrable, c.condeferred, pg_get_constraintdef(c.oid)) ORDER BY c.conname)
                  FROM pg_constraint c WHERE c.conrelid=target AND c.contype <> 'n'),
  'indexes', (SELECT jsonb_agg(jsonb_build_array(i.relname, x.indisunique, x.indisprimary, x.indisvalid, x.indisready, pg_get_indexdef(i.oid)) ORDER BY i.relname)
              FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid WHERE x.indrelid=target)
) INTO actual_structure;
    IF actual_structure IS DISTINCT FROM item.spec THEN
      RAISE EXCEPTION 'V003 historical structure mismatch: %', item.table_name;
    END IF;
  END LOOP;
END
$structure$;

ALTER TABLE public.product_category RENAME TO product_category_assignment;
ALTER TABLE public.category RENAME TO product_category;
ALTER TABLE public.product_campaign RENAME TO product_campaign_assignment;

-- Renaming PK/UNIQUE constraints also renames their backing indexes.
ALTER TABLE public.product_category_assignment RENAME CONSTRAINT product_category_pkey TO product_category_assignment_pkey;
ALTER TABLE public.product_category_assignment RENAME CONSTRAINT fk_product_category_product TO fk_product_category_assignment_product;
ALTER TABLE public.product_category_assignment RENAME CONSTRAINT fk_product_category_category TO fk_product_category_assignment_category;
ALTER TABLE public.product_category RENAME CONSTRAINT category_pkey TO product_category_pkey;
ALTER TABLE public.product_category RENAME CONSTRAINT category_category_name_key TO product_category_category_name_key;
ALTER TABLE public.product_campaign_assignment RENAME CONSTRAINT product_campaign_pkey TO product_campaign_assignment_pkey;
ALTER TABLE public.product_campaign_assignment RENAME CONSTRAINT fk_product_campaign_product TO fk_product_campaign_assignment_product;
ALTER TABLE public.product_campaign_assignment RENAME CONSTRAINT fk_product_campaign_campaign TO fk_product_campaign_assignment_campaign;
ALTER INDEX public.idx_product_category_category RENAME TO idx_product_category_assignment_category;
ALTER INDEX public.idx_product_campaign_campaign RENAME TO idx_product_campaign_assignment_campaign;

-- PostgreSQL 18 names NOT NULL constraints; PostgreSQL 17 has no such catalog rows.
-- Keep disposable PG18 rebuilds equivalent without adding constraints on PG17.
DO $not_null_names$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT c.conname, t.relname, a.attname
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=c.conkey[1]
    WHERE n.nspname='public' AND c.contype='n'
      AND t.relname IN ('product_category','product_category_assignment','product_campaign_assignment')
  LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
      item.relname, item.conname, item.relname || '_' || item.attname || '_not_null');
  END LOOP;
END
$not_null_names$;
COMMIT;
SELECT clock_timestamp() AS artifact_completed_at;
\echo 'SUCCESS 003-reconcile-historical-schema.sql'

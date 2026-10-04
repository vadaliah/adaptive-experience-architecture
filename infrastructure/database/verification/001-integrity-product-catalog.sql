-- 001-integrity-product-catalog.sql: read-only deployment gate for the released baseline.
-- Fingerprints cover every column/value, ordered with C collation; counts are explicit.
-- Expected structure and fingerprints were captured from the immutable release artifacts.
\set ON_ERROR_STOP on
\timing on
\echo 'START 001-integrity-product-catalog.sql'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = public, pg_catalog;
DO $verify$
DECLARE
  expected CONSTANT jsonb := $baseline$
{
  "product": {
    "structure": {
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
    "count": 25,
    "fingerprint": "b0103582b85872da3157fd59935db5b1"
  },
  "product_price": {
    "structure": {
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
    "count": 25,
    "fingerprint": "6bf0f513ba4eb258d653b357d3d6f9be"
  },
  "product_inventory": {
    "structure": {
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
    "count": 25,
    "fingerprint": "fff585e83a7c0a3427af2c5b63a680fa"
  },
  "product_category": {
    "structure": {
      "columns": [
        ["category_id", "character varying(50)", true, null],
        ["category_name", "character varying(100)", true, null],
        ["category_description", "text", false, null],
        ["seasonal_flag", "boolean", true, "false"]
      ],
      "indexes": [
        ["product_category_category_name_key", true, false, true, true, "CREATE UNIQUE INDEX product_category_category_name_key ON public.product_category USING btree (category_name)"],
        ["product_category_pkey", true, true, true, true, "CREATE UNIQUE INDEX product_category_pkey ON public.product_category USING btree (category_id)"]
      ],
      "constraints": [
        ["product_category_category_name_key", "u", true, false, false, "UNIQUE (category_name)"],
        ["product_category_pkey", "p", true, false, false, "PRIMARY KEY (category_id)"]
      ]
    },
    "count": 15,
    "fingerprint": "a9965dbe41629b9be6a58e270f1aa905"
  },
  "product_category_assignment": {
    "structure": {
      "columns": [
        ["product_id", "character varying(50)", true, null],
        ["category_id", "character varying(50)", true, null]
      ],
      "indexes": [
        ["idx_product_category_assignment_category", false, false, true, true, "CREATE INDEX idx_product_category_assignment_category ON public.product_category_assignment USING btree (category_id)"],
        ["product_category_assignment_pkey", true, true, true, true, "CREATE UNIQUE INDEX product_category_assignment_pkey ON public.product_category_assignment USING btree (product_id, category_id)"]
      ],
      "constraints": [
        ["fk_product_category_assignment_category", "f", true, false, false, "FOREIGN KEY (category_id) REFERENCES product_category(category_id) ON DELETE CASCADE"],
        ["fk_product_category_assignment_product", "f", true, false, false, "FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE"],
        ["product_category_assignment_pkey", "p", true, false, false, "PRIMARY KEY (product_id, category_id)"]
      ]
    },
    "count": 71,
    "fingerprint": "1978ba07abb6ba22c1fb24b110854ee9"
  }
}
$baseline$::jsonb;
  item record;
  target regclass;
  actual_structure jsonb;
  actual_count bigint;
  actual_fingerprint text;
BEGIN
  FOR item IN SELECT key AS table_name, value AS spec FROM jsonb_each(expected) LOOP
    target := to_regclass(format('public.%I', item.table_name));
    IF target IS NULL OR NOT EXISTS (SELECT FROM pg_class WHERE oid=target AND relkind='r') THEN
      RAISE EXCEPTION 'Missing release table: %', item.table_name;
    END IF;
    SELECT jsonb_build_object(
  'columns', (SELECT jsonb_agg(jsonb_build_array(a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
              FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
              WHERE a.attrelid=target AND a.attnum>0 AND NOT a.attisdropped),
  'constraints', (SELECT jsonb_agg(jsonb_build_array(c.conname, c.contype, c.convalidated, c.condeferrable, c.condeferred, pg_get_constraintdef(c.oid)) ORDER BY c.conname)
                  FROM pg_constraint c WHERE c.conrelid=target AND c.contype <> 'n'),
  'indexes', (SELECT jsonb_agg(jsonb_build_array(i.relname, x.indisunique, x.indisprimary, x.indisvalid, x.indisready, pg_get_indexdef(i.oid)) ORDER BY i.relname)
              FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid WHERE x.indrelid=target)
) INTO actual_structure;
    IF actual_structure IS DISTINCT FROM item.spec->'structure' THEN
      RAISE EXCEPTION 'Structure/constraints/indexes mismatch: %', item.table_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM public.product_price c LEFT JOIN public.product p ON c.product_id=p.product_id WHERE p.product_id IS NULL) THEN
    RAISE EXCEPTION 'Orphan relationship: product_price.product_id';
  END IF;
  IF EXISTS (SELECT FROM public.product_inventory c LEFT JOIN public.product p ON c.product_id=p.product_id WHERE p.product_id IS NULL) THEN
    RAISE EXCEPTION 'Orphan relationship: product_inventory.product_id';
  END IF;
  IF EXISTS (SELECT FROM public.product_category_assignment c LEFT JOIN public.product p ON c.product_id=p.product_id WHERE p.product_id IS NULL) THEN
    RAISE EXCEPTION 'Orphan relationship: product_category_assignment.product_id';
  END IF;
  IF EXISTS (SELECT FROM public.product_category_assignment c LEFT JOIN public.product_category p ON c.category_id=p.category_id WHERE p.category_id IS NULL) THEN
    RAISE EXCEPTION 'Orphan relationship: product_category_assignment.category_id';
  END IF;
  FOR item IN SELECT key AS table_name, value AS spec FROM jsonb_each(expected) LOOP
    EXECUTE format('SELECT count(*), md5(string_agg(to_jsonb(t)::text, E''\n'' ORDER BY to_jsonb(t)::text COLLATE "C")) FROM public.%I t', item.table_name)
      INTO actual_count, actual_fingerprint;
    IF actual_count <> (item.spec->>'count')::bigint THEN
      RAISE EXCEPTION 'Row count mismatch: %, expected %, actual %', item.table_name, item.spec->>'count', actual_count;
    END IF;
    IF actual_fingerprint IS DISTINCT FROM item.spec->>'fingerprint' THEN
      RAISE EXCEPTION 'Controlled/static values mismatch: %', item.table_name;
    END IF;
  END LOOP;
END
$verify$;
COMMIT;
\echo 'SUCCESS 001-integrity-product-catalog.sql'

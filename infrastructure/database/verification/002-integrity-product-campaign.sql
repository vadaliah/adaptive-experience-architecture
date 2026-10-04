-- 002-integrity-product-campaign.sql: read-only deployment gate for the released baseline.
-- Fingerprints cover every column/value, ordered with C collation; counts are explicit.
-- Expected structure and fingerprints were captured from the immutable release artifacts.
\set ON_ERROR_STOP on
\timing on
\echo 'START 002-integrity-product-campaign.sql'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = public, pg_catalog;
DO $verify$
DECLARE
  expected CONSTANT jsonb := $baseline$
{
  "marketing_campaign": {
    "structure": {
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
    "count": 5,
    "fingerprint": "293676e2a8dc8333ad92ddf9979526ef"
  },
  "product_campaign_assignment": {
    "structure": {
      "columns": [
        ["product_id", "character varying(50)", true, null],
        ["campaign_id", "character varying(50)", true, null]
      ],
      "indexes": [
        ["idx_product_campaign_assignment_campaign", false, false, true, true, "CREATE INDEX idx_product_campaign_assignment_campaign ON public.product_campaign_assignment USING btree (campaign_id)"],
        ["product_campaign_assignment_pkey", true, true, true, true, "CREATE UNIQUE INDEX product_campaign_assignment_pkey ON public.product_campaign_assignment USING btree (product_id, campaign_id)"]
      ],
      "constraints": [
        ["fk_product_campaign_assignment_campaign", "f", true, false, false, "FOREIGN KEY (campaign_id) REFERENCES marketing_campaign(campaign_id) ON DELETE CASCADE"],
        ["fk_product_campaign_assignment_product", "f", true, false, false, "FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE"],
        ["product_campaign_assignment_pkey", "p", true, false, false, "PRIMARY KEY (product_id, campaign_id)"]
      ]
    },
    "count": 28,
    "fingerprint": "c7f7e08c66b4460695b1721910685f84"
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
  IF EXISTS (SELECT FROM public.product_campaign_assignment c LEFT JOIN public.product p ON c.product_id=p.product_id WHERE p.product_id IS NULL) THEN
    RAISE EXCEPTION 'Orphan relationship: product_campaign_assignment.product_id';
  END IF;
  IF EXISTS (SELECT FROM public.product_campaign_assignment c LEFT JOIN public.marketing_campaign p ON c.campaign_id=p.campaign_id WHERE p.campaign_id IS NULL) THEN
    RAISE EXCEPTION 'Orphan relationship: product_campaign_assignment.campaign_id';
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
\echo 'SUCCESS 002-integrity-product-campaign.sql'

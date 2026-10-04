-- Canonical V001/V002 structure and controlled baseline must pass after V003.
\set ON_ERROR_STOP on
\echo 'START 003-integrity-schema-reconciliation.sql'
BEGIN TRANSACTION READ ONLY;
DO $verify$
BEGIN
  IF to_regclass('public.category') IS NOT NULL OR to_regclass('public.product_campaign') IS NOT NULL THEN
    RAISE EXCEPTION 'V003 historical table names remain';
  END IF;
END
$verify$;
COMMIT;
\ir 001-integrity-product-catalog.sql
\ir 002-integrity-product-campaign.sql
\echo 'SUCCESS 003-integrity-schema-reconciliation.sql'

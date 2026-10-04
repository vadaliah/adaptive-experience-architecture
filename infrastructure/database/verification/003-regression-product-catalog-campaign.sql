-- Reuse established gates for all V001/V002 values, counts and relationships.
\set ON_ERROR_STOP on
\echo 'START 003-regression-product-catalog-campaign.sql'
\ir 002-regression-product-catalog.sql
\ir 002-integrity-product-campaign.sql
\echo 'SUCCESS 003-regression-product-catalog-campaign.sql'

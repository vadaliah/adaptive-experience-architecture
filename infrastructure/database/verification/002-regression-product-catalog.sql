-- V002 must retain the complete V001 baseline, including structure and static values.
\set ON_ERROR_STOP on
\echo 'START 002-regression-product-catalog.sql'
\ir 001-integrity-product-catalog.sql
\echo 'SUCCESS 002-regression-product-catalog.sql'

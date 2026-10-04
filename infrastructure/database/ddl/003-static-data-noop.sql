-- V003 changes object names only. Existing business data must remain untouched.
\set ON_ERROR_STOP on
\timing on
\echo 'START 003-static-data-noop.sql'
BEGIN TRANSACTION READ ONLY;
SELECT clock_timestamp() AS artifact_completed_at,
       'V003 DML intentionally empty: no data changes required' AS operation;
COMMIT;
\echo 'SUCCESS 003-static-data-noop.sql'

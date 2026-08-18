-- NNN-operation-name.sql
-- AEA SQL Operation Template
--
-- Use this mold for future DDL/DML database artifacts.

\set ON_ERROR_STOP on
\timing on

\echo ''
\echo '======================================================================'
\echo 'AEA DATABASE OPERATION'
\echo 'Artifact : NNN-operation-name.sql'
\echo 'Purpose  : <describe operation>'
\echo '======================================================================'

SELECT clock_timestamp() AS artifact_started_at,
       'START NNN-operation-name.sql' AS operation;

BEGIN;

\echo ''
\echo '--- OPERATION 1: <DESCRIPTION> ----------------------------------------'
SELECT clock_timestamp() AS operation_started_at,
       '<operation description>' AS operation;

-- SQL statements go here.

SELECT clock_timestamp() AS operation_completed_at,
       '<entity or operation>' AS operation;

COMMIT;

\echo ''
\echo '--- POST-OPERATION VALIDATION -----------------------------------------'

-- Validation/count queries go here.

SELECT clock_timestamp() AS artifact_completed_at,
       'SUCCESS NNN-operation-name.sql' AS operation;

\echo '======================================================================'
\echo 'Database operation completed successfully.'
\echo '======================================================================'

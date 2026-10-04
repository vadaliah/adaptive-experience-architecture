-- 002-create-product-campaign.sql
-- AEA / Lily's Florist
-- V002 Product Campaign schema; requires V001

\set ON_ERROR_STOP on
\timing on
\echo '======================================================================'
\echo 'Artifact : 002-create-product-campaign.sql'
SELECT clock_timestamp() AS artifact_started_at,
       'START 002-create-product-campaign.sql' AS operation;

BEGIN;

CREATE TABLE marketing_campaign (
    campaign_id          VARCHAR(50) PRIMARY KEY,
    campaign_name        VARCHAR(100) NOT NULL UNIQUE,
    campaign_description TEXT,
    display_sequence     INTEGER NOT NULL DEFAULT 0 CHECK (display_sequence >= 0)
);

CREATE TABLE product_campaign_assignment (
    product_id  VARCHAR(50) NOT NULL,
    campaign_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (product_id, campaign_id),
    CONSTRAINT fk_product_campaign_assignment_product
        FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE,
    CONSTRAINT fk_product_campaign_assignment_campaign
        FOREIGN KEY (campaign_id) REFERENCES marketing_campaign(campaign_id) ON DELETE CASCADE
);

CREATE INDEX idx_product_campaign_assignment_campaign
    ON product_campaign_assignment(campaign_id);

CREATE INDEX idx_marketing_campaign_display_sequence
    ON marketing_campaign(display_sequence);

COMMIT;

\echo '--- POST-OPERATION VALIDATION -----------------------------------------'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT clock_timestamp() AS artifact_completed_at,
       'SUCCESS 002-create-product-campaign.sql' AS operation;
\echo '======================================================================'

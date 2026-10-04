-- 002-seed-product-campaign.sql
-- AEA / Lily's Florist
-- V002 Product Campaign controlled/static data; requires V001 data

\set ON_ERROR_STOP on
\timing on
\echo '======================================================================'
\echo 'Artifact : 002-seed-product-campaign.sql'
SELECT clock_timestamp() AS artifact_started_at,
       'START 002-seed-product-campaign.sql' AS operation;

BEGIN;

INSERT INTO marketing_campaign (campaign_id, campaign_name, campaign_description, display_sequence) VALUES
('CMP001','Lily''s Recommendations','A curated selection of products recommended by Lily.',1),
('CMP002','Season''s Best','Featured products selected to reflect the current season.',2),
('CMP003','Clearance Items','Selected products offered as clearance merchandise.',3),
('CMP004','Featured Gifts','Gift-oriented products highlighted for easy discovery.',4),
('CMP005','Valentine''s Favorites','A curated collection of Valentine''s Day favorites.',5);

INSERT INTO product_campaign_assignment (product_id, campaign_id) VALUES
('P001','CMP001'),('P001','CMP005'),
('P002','CMP001'),('P002','CMP005'),
('P003','CMP002'),
('P005','CMP002'),
('P007','CMP001'),('P007','CMP004'),
('P008','CMP004'),
('P009','CMP003'),
('P010','CMP003'),
('P011','CMP004'),('P011','CMP005'),
('P012','CMP004'),
('P013','CMP001'),('P013','CMP004'),('P013','CMP005'),
('P014','CMP004'),
('P015','CMP004'),
('P016','CMP005'),
('P017','CMP002'),
('P018','CMP001'),
('P020','CMP001'),('P020','CMP005'),
('P021','CMP002'),
('P023','CMP004'),
('P024','CMP001'),
('P025','CMP002');

COMMIT;

\echo '--- POST-OPERATION VALIDATION -----------------------------------------'
SELECT 'marketing_campaign' AS table_name, count(*) AS row_count FROM marketing_campaign
UNION ALL
SELECT 'product_campaign_assignment' AS table_name, count(*) AS row_count FROM product_campaign_assignment;

SELECT clock_timestamp() AS artifact_completed_at,
       'SUCCESS 002-seed-product-campaign.sql' AS operation;
\echo '======================================================================'

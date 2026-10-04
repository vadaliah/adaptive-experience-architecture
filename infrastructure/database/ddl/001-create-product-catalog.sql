-- 001-create-product-catalog.sql
-- AEA / Lily's Florist
-- V001 Product Catalog schema

\set ON_ERROR_STOP on
\timing on
\echo '======================================================================'
\echo 'Artifact : 001-create-product-catalog.sql'
SELECT clock_timestamp() AS artifact_started_at,
       'START 001-create-product-catalog.sql' AS operation;

BEGIN;

CREATE TABLE product (
    product_id                   VARCHAR(50) PRIMARY KEY,
    product_name                 VARCHAR(150) NOT NULL,
    product_short_description    VARCHAR(255),
    product_long_description     TEXT,
    product_thumbnail_reference VARCHAR(500),
    product_type                 VARCHAR(100) NOT NULL
);

CREATE TABLE product_price (
    product_id        VARCHAR(50) PRIMARY KEY,
    product_price_usd NUMERIC(10,2) NOT NULL CHECK (product_price_usd >= 0),
    CONSTRAINT fk_product_price_product
        FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE
);

CREATE TABLE product_inventory (
    product_id VARCHAR(50) PRIMARY KEY,
    quantity   INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    CONSTRAINT fk_product_inventory_product
        FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE
);

CREATE TABLE product_category (
    category_id          VARCHAR(50) PRIMARY KEY,
    category_name        VARCHAR(100) NOT NULL UNIQUE,
    category_description TEXT,
    seasonal_flag        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE product_category_assignment (
    product_id  VARCHAR(50) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (product_id, category_id),
    CONSTRAINT fk_product_category_assignment_product
        FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE,
    CONSTRAINT fk_product_category_assignment_category
        FOREIGN KEY (category_id) REFERENCES product_category(category_id) ON DELETE CASCADE
);

CREATE INDEX idx_product_product_type
    ON product(product_type);

CREATE INDEX idx_product_category_assignment_category
    ON product_category_assignment(category_id);

COMMIT;

\echo '--- POST-OPERATION VALIDATION -----------------------------------------'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT clock_timestamp() AS artifact_completed_at,
       'SUCCESS 001-create-product-catalog.sql' AS operation;
\echo '======================================================================'

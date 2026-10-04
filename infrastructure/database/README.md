# Database releases

DDL and controlled/static DML are versioned together. `ddl/current/schema.sql` and
`ddl/current/static-data.sql` describe the complete database through V002. Numbered
SQL files directly under `ddl/` are chronological incremental releases; preserve
released files and add the next number for future changes, updating current artifacts
in the same change. `000-sql-operation-template.sql` is a template, not a release.
There is no database version-tracking table. Git/PRs retain detailed history.

## Database Release History

| Release | Responsibility |
| --- | --- |
| V001 — Product Catalog | Product, price, inventory, category master and product/category assignments; 25 products, 25 prices, 25 inventory rows, 15 categories and 71 category assignments. |
| V002 — Product Campaign | `marketing_campaign`, `product_campaign_assignment`, their constraints/indexes, 5 campaigns and 28 product/campaign assignments. Requires V001. |

Category remains Product Catalog classification data. V002 adds no category or
other metadata structures. The former duplicate `scripts/ddl` directory is removed;
`scripts/run-sql.sh` accepts any explicit artifact path.

## Rebuild and upgrade

For an **empty database**, apply either current `schema.sql` then `static-data.sql`,
or the following files in order (paths relative to this directory):

1. `ddl/001-create-product-catalog.sql`
2. `ddl/001-seed-product-catalog.sql`
3. `ddl/002-create-product-campaign.sql`
4. `ddl/002-seed-product-campaign.sql`

For a database already at V001, apply only steps 3–4. Do not combine the current
and incremental paths, or replay already applied artifacts. Each file is transactional
and uses psql error-stop, timing, timestamp logging and post-operation validation.
Deployment remains a separate explicit operation using the existing runner.

This split corrects the original combined V001 artifact boundary once: the previous
V001 included campaigns. An environment built from that old combined artifact already
has the V002 objects/data; do not replay V002 there. Inspect its schema/data before
planning any upgrade. No live database migration is performed by this restructuring.

## Local validation

Run `python3 infrastructure/database/scripts/validate-releases.py` with PostgreSQL
server/client binaries on `PATH`. It creates a disposable, Unix-socket-only local
cluster, verifies V001 in isolation, upgrades it with V002, and compares the result
with a separate current-artifact rebuild, including schema, all rows and row counts.
It never uses configured database credentials or connects to an existing database.

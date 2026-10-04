# Database releases

Each release package consists of versioned DDL, versioned controlled/static DML,
integrity verification, and prior-release regression verification where applicable. `ddl/current/schema.sql` and
`ddl/current/static-data.sql` describe the complete database through V002. Numbered
SQL files directly under `ddl/` are chronological incremental releases; preserve
released V001/V002 DDL/DML files unchanged and use V003 or later for future database
changes, updating current artifacts
in the same change. `000-sql-operation-template.sql` is a template, not a release.
Verification/framework improvements alone do not create a database release; a new
version is required when structure or controlled/static data changes. There is no
database version-tracking table. Git/PRs retain detailed history.

## Database Release History

| Release | Responsibility |
| --- | --- |
| V001 — Product Catalog | Product, price, inventory, category master and product/category assignments; 25 products, 25 prices, 25 inventory rows, 15 categories and 71 category assignments. |
| V002 — Product Campaign | `marketing_campaign`, `product_campaign_assignment`, their constraints/indexes, 5 campaigns and 28 product/campaign assignments. Requires V001. |

Category remains Product Catalog classification data. V002 adds no category or
other metadata structures. The former duplicate `scripts/ddl` directory is removed;
`scripts/run-sql.sh` accepts any explicit artifact path.

## Rebuild and upgrade

`scripts/run-sql.sh <sql-file>` is the common execution utility. Release selection
and ordering belong to the deployment process; the runner never infers versions.
The process must stop on any non-zero exit. Successful DDL/DML alone is not a
successful deployment: every required stage must pass.

Apply these explicitly selected packages (paths relative to this directory):

| Release | DDL → DML → integrity → prior-release regression |
| --- | --- |
| V001 | `ddl/001-create-product-catalog.sql` → `ddl/001-seed-product-catalog.sql` → `verification/001-integrity-product-catalog.sql`; no prior release. |
| V002 | `ddl/002-create-product-campaign.sql` → `ddl/002-seed-product-campaign.sql` → `verification/002-integrity-product-campaign.sql` → `verification/002-regression-product-catalog.sql`. |

After database verification, run applicable application regression tests. The current
backend gates are `npm run typecheck`, `npm run typecheck:test`, and
`npm run test:coverage` from `implementations/florist/backend`. All must succeed.

For an **empty database**, apply V001 then V002, or provision using
`ddl/current/schema.sql` then `ddl/current/static-data.sql` and run both integrity
gates followed by application regression. Current artifacts represent the complete
latest database for clean provisioning/reconstruction, **not incremental upgrades**.
For an established V001 database, apply only the V002 package and application gates.
Do not combine the current and incremental paths, replay applied artifacts, or
add DROP/CREATE workarounds. Numbered released DDL/DML remain immutable.

Verification runs in read-only, repeatable-read transactions and raises exceptions
on structure, constraints/indexes, count, orphan or static-value mismatches. Static
fingerprints cover every released column/value in C-sorted JSONB rows; they are
fixed expectations captured from the immutable seed artifacts, not recalculated
from the database being verified. These gates target the controlled release baseline,
including seeded inventory; a database with intentional operational changes needs
an explicitly reviewed verification policy, not silently refreshed expectations.
The V002 regression gate reuses V001 integrity verification without duplicating it.
psql error-stop and the runner propagate failures as non-zero exit codes.

This split corrects the original combined V001 artifact boundary once: the previous
V001 included campaigns. An environment built from that old combined artifact already
has the V002 objects/data; do not replay V002 there. Inspect its schema/data before
planning any upgrade. No live database migration is performed by this restructuring.

## Local validation

Install backend dependencies with `npm ci` in `implementations/florist/backend`,
then run `python3 infrastructure/database/scripts/validate-releases.py` with Python 3,
PostgreSQL server/client binaries, Node.js and npm on `PATH` (validated with PostgreSQL
18). It creates a disposable Unix-socket-only local cluster and routes **all** release,
current and verification artifacts through the common runner's explicit local mode:

```sh
scripts/run-sql.sh --local <absolute-socket-directory> <database> <user> <sql-file>
```

Local mode uses port 5432 on that socket directory, requires an explicit database,
rejects `florist_db`, and does not perform AWS discovery or authentication. The existing
remote runner path is unchanged apart from ignoring psql startup files for predictable
execution. The validator strips ambient PostgreSQL connection settings and never
connects to an existing database.

Validation gates V001 before capturing its state, gates V002 and V001 regression,
compares complete schema/all rows with an independent current rebuild, and verifies
27 negative cases: missing prerequisites/seeds, missing tables, altered column types,
constraints/indexes (including unvalidated FKs), missing rows, same-count static-value
changes, and six orphan relationships. Each corruption uses a disposable database
copy and must fail with the intended diagnostic. The cluster is stopped/removed,
then backend typechecks and unit tests run only after all database checks pass.
No live database deployment is performed by this validation.

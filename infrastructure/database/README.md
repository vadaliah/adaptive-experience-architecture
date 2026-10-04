# Database releases

Each release package consists of versioned DDL, versioned controlled/static DML,
integrity verification, and prior-release regression verification where applicable. `ddl/current/schema.sql` and
`ddl/current/static-data.sql` describe the complete database through V003. Numbered
SQL files directly under `ddl/` are chronological incremental releases; preserve
released numbered DDL/DML files unchanged; future releases after V003 use V004 or
later, updating current artifacts in the same change. `000-sql-operation-template.sql` is a template, not a release.
Verification/framework improvements alone do not create a database release; a new
version is required when structure or controlled/static data changes. There is no
database version-tracking table. Git/PRs retain detailed history.

## Database Release History

| Release | Responsibility |
| --- | --- |
| V001 — Product Catalog | Product, price, inventory, category master and product/category assignments; 25 products, 25 prices, 25 inventory rows, 15 categories and 71 category assignments. |
| V002 — Product Campaign | `marketing_campaign`, `product_campaign_assignment`, their constraints/indexes, 5 campaigns and 28 product/campaign assignments. Requires V001. |
| V003 — Historical Schema Reconciliation | Rename the original combined deployment to canonical V001/V002 object names; no business-data changes. Applies only to the historical schema, not a canonical V002 database. |

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

For the **historical combined deployment only**, explicitly execute:

1. `ddl/003-reconcile-historical-schema.sql`
2. `ddl/003-static-data-noop.sql` (explicit no-op; no DML required)
3. `verification/003-integrity-schema-reconciliation.sql`
4. `verification/003-regression-product-catalog-campaign.sql`

V003 renames the category junction first, then its master and the campaign junction,
followed by eight PK/unique/FK constraint names and two standalone index names.
PK/unique backing indexes follow their constraint renames. PostgreSQL 18 named
NOT NULL constraints are renamed when present; PostgreSQL 17 needs no such operation.
The preflight checks historical columns/defaults/nullability, constraints and indexes
for all seven tables under exclusive locks. Canonical/partial/inconsistent states
fail non-zero. A 10-second lock timeout prevents indefinite lock acquisition; plan a
controlled maintenance window. All renames are in one transaction and roll back on
failure. Take a backup and run the full verification/application gates as part of an
approved deployment; this package does not automatically select or run releases.

The deployment target remains Aurora database `aea`; SQL contains no physical
database name or connection switch. No CDK, backend database-name setting or AWS
runner-path change is part of V003. V003 is not replayable: already-canonical V002
and current rebuilds skip its DDL/DML and may run its verification gates directly.

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
has campaign objects/data under old names; do not replay V001/V002 there. Its
reconciliation path is the explicitly selected V003 package after preflight review.

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
The validator also builds a historical database from the frozen original DDL in
`verification/fixtures/historical-combined-schema.sql` (test-only), with the existing
seed values mapped to historical table names. V003 must preserve every row and match
the current schema dump exactly. Twelve additional negative cases cover partial
renames, missing/malformed historical objects, canonical/replay rejection, regression
corruption and a late rename collision; failed migrations must leave schema unchanged.
Current artifacts differ only in their release-label comments because V003 restores
an already-defined canonical schema. No live database deployment is performed by
this validation.

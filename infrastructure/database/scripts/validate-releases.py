#!/usr/bin/env python3
"""Validate releases using only a disposable PostgreSQL cluster (no external DB)."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
COUNTS = {'product': 25, 'product_price': 25, 'product_inventory': 25,
          'product_category': 15, 'product_category_assignment': 71,
          'marketing_campaign': 5, 'product_campaign_assignment': 28}
CATALOG = set(COUNTS) - {'marketing_campaign', 'product_campaign_assignment'}
ENV = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
ENV['LC_ALL'] = 'C'


def run(*args):
    return subprocess.check_output(args, env=ENV, text=True, stderr=subprocess.STDOUT)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    for tool in ('initdb', 'pg_ctl', 'psql', 'pg_dump', 'npm'):
        if not shutil.which(tool):
            raise SystemExit(f'Required PostgreSQL binary missing: {tool}')
    with tempfile.TemporaryDirectory(prefix='lilys-release-', dir='/tmp') as tmp:
        data, sock = Path(tmp) / 'data', Path(tmp) / 'socket'
        sock.mkdir()
        run('initdb', '-D', str(data), '-A', 'trust', '-U', 'release_validator', '--no-locale', '-E', 'UTF8')
        started = False
        try:
            run('pg_ctl', '-D', str(data), '-l', str(Path(tmp) / 'server.log'),
                '-o', f"-c listen_addresses='' -k {sock}", '-w', 'start')
            started = True
            connection = ['-h', str(sock), '-U', 'release_validator', '-p', '5432']

            def sql(db, statement):
                return run('psql', '-X', *connection, '-d', db, '-v', 'ON_ERROR_STOP=1', '-At', '-c', statement).strip()

            def apply(db, filename):
                run('bash', str(ROOT / 'scripts/run-sql.sh'), '--local', str(sock), db, 'release_validator', str(ROOT / filename))

            def rows(db):
                return {table: sql(db, f'SELECT row_to_json(t)::text FROM {table} t ORDER BY row_to_json(t)::text') for table in COUNTS}

            def schema(db):
                dump = run('pg_dump', *connection, '-d', db, '--schema-only', '--no-owner', '--no-privileges')
                return re.sub(r'^\\(?:un)?restrict .*\n', '', dump, flags=re.M)

            def expect_failure(db, artifact, message):
                try:
                    apply(db, artifact)
                except subprocess.CalledProcessError as error:
                    if message not in error.output or 'SQL execution completed successfully.' in error.output:
                        raise RuntimeError(f'Unexpected failure for {artifact}: {error.output}') from error
                else:
                    raise RuntimeError(f'Gate incorrectly accepted invalid state: {artifact}')

            catalog_gate = 'verification/001-integrity-product-catalog.sql'
            campaign_gate = 'verification/002-integrity-product-campaign.sql'
            regression_gate = 'verification/002-regression-product-catalog.sql'
            sql('postgres', 'CREATE DATABASE release_incremental')
            sql('postgres', 'CREATE DATABASE release_current')
            expect_failure('release_incremental', 'ddl/002-create-product-campaign.sql', 'relation "product" does not exist')
            apply('release_incremental', 'ddl/001-create-product-catalog.sql')
            expect_failure('release_incremental', catalog_gate, 'Row count mismatch')
            apply('release_incremental', 'ddl/001-seed-product-catalog.sql')
            apply('release_incremental', catalog_gate)
            tables = sql('release_incremental', "SELECT tablename FROM pg_tables WHERE schemaname='public'").splitlines()
            require(set(tables) == CATALOG, f'Unexpected V001 tables: {tables}')
            catalog_before = {t: sql('release_incremental', f'SELECT row_to_json(t)::text FROM {t} t ORDER BY row_to_json(t)::text') for t in CATALOG}
            # Separate connections/files model an independent upgrade from established V001.
            apply('release_incremental', 'ddl/002-create-product-campaign.sql')
            expect_failure('release_incremental', campaign_gate, 'Row count mismatch')
            apply('release_incremental', 'ddl/002-seed-product-campaign.sql')
            apply('release_incremental', campaign_gate)
            apply('release_incremental', regression_gate)
            apply('release_current', 'ddl/current/schema.sql')
            apply('release_current', 'ddl/current/static-data.sql')
            apply('release_current', catalog_gate)
            apply('release_current', campaign_gate)
            require(schema('release_incremental') == schema('release_current'), 'Schema mismatch')
            incremental_rows = rows('release_incremental')
            require(incremental_rows == rows('release_current'), 'Static data mismatch')
            require(all(incremental_rows[t] == catalog_before[t] for t in CATALOG), 'V002 changed catalog data')
            for table, expected in COUNTS.items():
                require(int(sql('release_incremental', f'SELECT count(*) FROM {table}')) == expected, table)
            print('PASS: isolated V001, independent V002 upgrade, current rebuild schema/data equivalence, unchanged catalog and expected counts.')
            print(COUNTS)
            # Each mutation uses a separate disposable copy of the valid V002 database.
            cases = [
                ('missing_table', 'DROP TABLE product_inventory', catalog_gate, 'Missing release table'),
                ('wrong_column_type', 'ALTER TABLE product ALTER COLUMN product_name TYPE varchar(151)', catalog_gate, 'Structure/constraints/indexes mismatch'),
                ('missing_primary_key', 'ALTER TABLE product_category_assignment DROP CONSTRAINT product_category_assignment_pkey', catalog_gate, 'Structure/constraints/indexes mismatch'),
                ('missing_unique', 'ALTER TABLE marketing_campaign DROP CONSTRAINT marketing_campaign_campaign_name_key', campaign_gate, 'Structure/constraints/indexes mismatch'),
                ('missing_check', 'ALTER TABLE product_inventory DROP CONSTRAINT product_inventory_quantity_check', catalog_gate, 'Structure/constraints/indexes mismatch'),
                ('missing_index', 'DROP INDEX idx_product_campaign_assignment_campaign', campaign_gate, 'Structure/constraints/indexes mismatch'),
                ('missing_fk', 'ALTER TABLE product_campaign_assignment DROP CONSTRAINT fk_product_campaign_assignment_campaign', campaign_gate, 'Structure/constraints/indexes mismatch'),
                ('unvalidated_fk', 'ALTER TABLE product_campaign_assignment DROP CONSTRAINT fk_product_campaign_assignment_campaign; ALTER TABLE product_campaign_assignment ADD CONSTRAINT fk_product_campaign_assignment_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaign(campaign_id) ON DELETE CASCADE NOT VALID', campaign_gate, 'Structure/constraints/indexes mismatch'),
                ('missing_price', "DELETE FROM product_price WHERE product_id='P001'", regression_gate, 'Row count mismatch'),
                ('missing_campaign', "DELETE FROM marketing_campaign WHERE campaign_id='CMP005'", campaign_gate, 'Row count mismatch'),
                ('missing_assignment', "DELETE FROM product_campaign_assignment WHERE product_id='P001' AND campaign_id='CMP001'", campaign_gate, 'Row count mismatch'),
                ('changed_product', "UPDATE product SET product_name='Changed' WHERE product_id='P001'", regression_gate, 'Controlled/static values mismatch'),
                ('changed_price', "UPDATE product_price SET product_price_usd=80 WHERE product_id='P001'", regression_gate, 'Controlled/static values mismatch'),
                ('changed_inventory', "UPDATE product_inventory SET quantity=19 WHERE product_id='P001'", regression_gate, 'Controlled/static values mismatch'),
                ('changed_category', "UPDATE product_category SET category_name='Changed' WHERE category_id='CAT001'", regression_gate, 'Controlled/static values mismatch'),
                ('changed_category_assignment', "UPDATE product_category_assignment SET category_id='CAT003' WHERE product_id='P001' AND category_id='CAT001'", regression_gate, 'Controlled/static values mismatch'),
                ('changed_campaign', "UPDATE marketing_campaign SET display_sequence=99 WHERE campaign_id='CMP001'", campaign_gate, 'Controlled/static values mismatch'),
                ('changed_campaign_assignment', "UPDATE product_campaign_assignment SET campaign_id='CMP002' WHERE product_id='P001' AND campaign_id='CMP001'", campaign_gate, 'Controlled/static values mismatch'),
            ]
            for table, column, gate in [
                ('product_price', 'product_id', catalog_gate),
                ('product_inventory', 'product_id', catalog_gate),
                ('product_category_assignment', 'product_id', regression_gate),
                ('product_category_assignment', 'category_id', regression_gate),
                ('product_campaign_assignment', 'product_id', campaign_gate),
                ('product_campaign_assignment', 'campaign_id', campaign_gate),
            ]:
                # Preserve constraints while simulating corrupt rows loaded with FK triggers disabled.
                mutation = f"SET session_replication_role=replica; UPDATE {table} SET {column}='ORPHAN' WHERE ctid=(SELECT ctid FROM {table} LIMIT 1)"
                cases.append((f'orphan_{table}_{column}', mutation, gate, 'Orphan relationship'))
            for index, (label, mutation, gate, message) in enumerate(cases):
                db = f'release_failure_{index}'
                sql('postgres', f'CREATE DATABASE {db} TEMPLATE release_incremental')
                try:
                    sql(db, mutation)
                    expect_failure(db, gate, message)
                    print(f'PASS rejection: {label}')
                finally:
                    sql('postgres', f'DROP DATABASE {db}')
            print(f'PASS: {len(cases) + 3} negative deployment/verification scenarios.')
        finally:
            if started:
                run('pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop')

    # Database validation must succeed before the application regression gate runs.
    backend = ROOT.parents[1] / 'implementations/florist/backend'
    for script in ('typecheck', 'typecheck:test', 'test:coverage'):
        print(run('npm', '--prefix', str(backend), 'run', script))
    print('PASS: database and application deployment gates.')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.output) from error

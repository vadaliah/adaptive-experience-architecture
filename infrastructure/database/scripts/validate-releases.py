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


def main():
    for tool in ('initdb', 'pg_ctl', 'psql', 'pg_dump'):
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
                run('psql', '-X', *connection, '-d', db, '-v', 'ON_ERROR_STOP=1', '-f', str(ROOT / 'ddl' / filename))

            def rows(db):
                return {table: sql(db, f'SELECT row_to_json(t)::text FROM {table} t ORDER BY row_to_json(t)::text') for table in COUNTS}

            def schema(db):
                dump = run('pg_dump', *connection, '-d', db, '--schema-only', '--no-owner', '--no-privileges')
                return re.sub(r'^\\(?:un)?restrict .*\n', '', dump, flags=re.M)

            sql('postgres', 'CREATE DATABASE release_incremental')
            sql('postgres', 'CREATE DATABASE release_current')
            apply('release_incremental', '001-create-product-catalog.sql')
            apply('release_incremental', '001-seed-product-catalog.sql')
            tables = sql('release_incremental', "SELECT tablename FROM pg_tables WHERE schemaname='public'").splitlines()
            assert set(tables) == CATALOG, tables
            catalog_before = {t: sql('release_incremental', f'SELECT row_to_json(t)::text FROM {t} t ORDER BY row_to_json(t)::text') for t in CATALOG}
            # Separate connections/files model an independent upgrade from established V001.
            apply('release_incremental', '002-create-product-campaign.sql')
            apply('release_incremental', '002-seed-product-campaign.sql')
            apply('release_current', 'current/schema.sql')
            apply('release_current', 'current/static-data.sql')
            assert schema('release_incremental') == schema('release_current'), 'Schema mismatch'
            incremental_rows = rows('release_incremental')
            assert incremental_rows == rows('release_current'), 'Static data mismatch'
            assert all(incremental_rows[t] == catalog_before[t] for t in CATALOG), 'V002 changed catalog data'
            for table, expected in COUNTS.items():
                assert int(sql('release_incremental', f'SELECT count(*) FROM {table}')) == expected, table
            print('PASS: isolated V001, independent V002 upgrade, current rebuild schema/data equivalence, unchanged catalog and expected counts.')
            print(COUNTS)
        finally:
            if started:
                run('pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.output) from error

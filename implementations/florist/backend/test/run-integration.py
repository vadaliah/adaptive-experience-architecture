#!/usr/bin/env python3
"""Rebuild only a disposable local PostgreSQL cluster, never an external database."""
import getpass, os, pathlib, shutil, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[4]
backend = pathlib.Path(__file__).resolve().parents[1]
bin_dir = os.environ.get("PG_BIN") or subprocess.check_output(["pg_config", "--bindir"], text=True).strip()
def pg(name, *args):
    subprocess.run([str(pathlib.Path(bin_dir) / name), *map(str,args)], check=True, stdout=subprocess.DEVNULL)
with tempfile.TemporaryDirectory(prefix="lily-campaign-test-") as tmp:
    data = pathlib.Path(tmp)/"data"
    pg("initdb", "-D", data, "-A", "trust", "--no-locale", "-E", "UTF8")
    started = False
    try:
        pg("pg_ctl", "-D", data, "-l", pathlib.Path(tmp)/"postgres.log", "-o", f"-c listen_addresses='' -k {tmp}", "-w", "start")
        started = True
        for name in ("schema.sql", "static-data.sql"):
            pg("psql", "-X", "-h", tmp, "-U", getpass.getuser(), "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", root/"infrastructure/database/ddl/current"/name)
        env = dict(os.environ, CAMPAIGN_TEST_SOCKET=tmp, CAMPAIGN_TEST_USER=getpass.getuser())
        subprocess.run(["npx", "vitest", "run", "--config", "vitest.integration.config.ts"], cwd=backend, env=env, check=True)
    finally:
        if started: pg("pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")

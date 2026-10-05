# Backend Tests

Backend tests are separated by the kind of behavior they verify.

| Category | Location | Status | External systems |
|---|---|---|---|
| Deterministic unit tests | `test/unit/` | Active, run in CI | None. Bedrock, Aurora (`pg`), AWS and SSM are mocked. |
| Agent evaluation tests | `test/agent-eval/` | Future | Live Claude/Bedrock. Evaluates intent interpretation and tool selection. |
| PostgreSQL/API integration tests | `test/integration/` | Active, run in CI | Disposable local PostgreSQL and loopback HTTP only. |

The existing `src/tests/*.ts` scripts (`npm run test:bedrock`,
`npm run test:product-search`) are live smoke scripts that require the
runtime initialized by `scripts/init-runtime.sh`. They are not part of
the unit suite.

## Unit tests

```bash
npm test                # run once
npm run test:watch      # watch mode
npm run test:coverage   # run with coverage report (coverage/)
npm run typecheck:test  # typecheck src + tests
```

Unit tests must:

- make no network calls;
- not require AWS credentials, `AWS_*`, `BEDROCK_*` or `DB_*` variables
  from the environment (tests stub the variables they need);
- not assert anything about Claude's semantic or tool-selection behavior.

## Campaign integration and UI tests

`npm run test:integration` starts a disposable PostgreSQL cluster on a temporary
Unix socket, loads the canonical current artifacts, and verifies seeded campaign
ordering, exact membership, prices/inventory, and HTTP behavior. It stops/removes
the cluster on completion or failure. It never uses the application's `DB_*`
variables or connects to Aurora. Install PostgreSQL binaries first; optionally
set `PG_BIN` to their directory. Run as a non-root user.

From `../ui`, run `npm run typecheck`, `npm test`, and `npm run build`.
UI tests cover controlled ribbon states, atomic updates, stale results, and
independent prompt/campaign request bodies. Agent unit tests inject model decisions;
they verify orchestration and rejection of unsupported selections, not live model
accuracy. No live Bedrock/Aurora evaluation is required by CI.

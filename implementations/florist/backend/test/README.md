# Backend Tests

Backend tests are separated by the kind of behavior they verify.

| Category | Location | Status | External systems |
|---|---|---|---|
| Deterministic unit tests | `test/unit/` | Active, run in CI | None. Bedrock, Aurora (`pg`), AWS and SSM are mocked. |
| Agent evaluation tests | `test/agent-eval/` | Future | Live Claude/Bedrock. Evaluates intent interpretation and tool selection. |
| Infrastructure/integration tests | `test/integration/` | Future | Aurora, AWS, SSM tunnel. |

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

# AEA AWS Infrastructure

AWS infrastructure for the Adaptive Experience Architecture sandbox.

## Layout

```text
infrastructure/
├── bin/                      CDK application entry point
├── lib/                      CDK stack and constructs
├── config/                   environment examples
├── database/
│   ├── ddl/                  versioned SQL artifacts
│   ├── logs/                 local execution logs (not committed)
│   └── scripts/              database execution/bootstrap utilities
├── docs/                     setup and reproducibility documentation
└── scripts/                  local/AWS/CDK automation
```

## Database artifact convention

Database changes use ordered numeric prefixes:

- `001-create-product-catalog.sql`
- `001-seed-product-catalog.sql`
- future changes use `002-*`, `003-*`, etc.

Once an increment has been applied to a shared environment, its SQL artifacts are treated as immutable. Future changes are introduced through new forward migrations.

## Normal workflow

```bash
aws sso login --profile aea-sandbox
./scripts/validate-aws-env.sh
./scripts/synth-infra.sh
```

Deployment is intentionally separated:

```bash
aws sso login --profile aea-deploy
./scripts/deploy-sandbox.sh
```

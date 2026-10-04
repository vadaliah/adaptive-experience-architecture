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

See [Database releases](database/README.md) for current artifacts, incremental releases, and rebuild instructions.

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

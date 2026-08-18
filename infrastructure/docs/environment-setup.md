# AEA Environment Setup Inventory

This document is the running inventory for recreating the AEA development environment.

## Validated local toolchain

| Component | Validated version / configuration | Purpose |
|---|---|---|
| nvm | 0.40.6 | Node version management |
| Node.js | 22.23.2 | JavaScript / TypeScript runtime |
| npm | 10.9.8 | Package management |
| Expo | SDK 57 | React Native / web UI runtime |
| AWS CLI | 2.36.24 | AWS CLI and SSO |
| PostgreSQL client | psql 18.6 | Database SQL execution |
| Session Manager Plugin | 1.2.835.0 | Secure tunnel to private Aurora |
| AWS CDK | v2 / TypeScript | Infrastructure as Code |

## AWS environment

- Organization management account: `artofdream`
- Application member account: `AEA-Sandbox`
- AWS account ID: `287238357427`
- Workload region: `us-east-2`
- Normal developer CLI profile: `aea-sandbox`
- Elevated CDK deployment profile: `aea-deploy`
- CDK stack: `AeaSandboxStack`

## Current infrastructure

- Two-AZ VPC
- Private isolated subnets
- No NAT gateways
- SSM / SSM Messages / EC2 Messages VPC endpoints
- Aurora PostgreSQL Serverless v2
- Aurora PostgreSQL engine 17.4
- Database: `aea`
- Secrets Manager admin secret: `aea/sandbox/database/admin`
- IAM database authentication enabled
- Normal database user: `aea_developer`
- SSM-managed EC2 database access host
- PostgreSQL access limited to the access host on port 5432

## Local setup

From `infrastructure/`:

```bash
./scripts/setup-local-env.sh
```

Then ensure the current shell can find libpq and the official Session Manager Plugin:

```bash
export PATH="/usr/local/bin:$(brew --prefix libpq)/bin:$PATH"
```

## AWS login

Normal development:

```bash
aws sso login --profile aea-sandbox
```

Deployment:

```bash
aws sso login --profile aea-deploy
```

## Validate

```bash
./scripts/validate-aws-env.sh
```

## Build / synthesize

```bash
./scripts/synth-infra.sh
```

## Bootstrap a new sandbox

One-time per AWS account/region:

```bash
./scripts/bootstrap-aws.sh
```

## Deploy

```bash
./scripts/deploy-sandbox.sh
```

## Initialize the database IAM user

After infrastructure deployment:

```bash
./database/scripts/bootstrap-db-user.sh
```

## Apply SQL artifacts

```bash
./database/scripts/run-sql.sh database/ddl/001-create-product-catalog.sql
./database/scripts/run-sql.sh database/ddl/001-seed-product-catalog.sql
```

Execution logs are written to `database/logs/` and are intentionally excluded from Git.

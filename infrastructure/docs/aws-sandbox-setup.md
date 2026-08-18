# AWS Sandbox Setup

## One-time administrative foundation

The initial AWS administrative setup remains intentionally semi-manual because it involves organization-level and identity-security decisions.

1. Create or use the AWS Organizations management account.
2. Enable IAM Identity Center in `us-east-2`.
3. Create member account `AEA-Sandbox`.
4. Create Identity Center user(s).
5. Create group `AEA-Sandbox-Developers`.
6. Create permission set `AEA-Sandbox-PowerUser` based on `PowerUserAccess`.
7. Assign the developer group to `AEA-Sandbox` with `AEA-Sandbox-PowerUser`.
8. Create permission set `AEA-CDK-Deployment-Admin` based on `AdministratorAccess`.
9. Assign the elevated deployment permission only to approved deployment user(s).
10. Configure CLI SSO profiles:
    - `aea-sandbox` for normal development
    - `aea-deploy` for CDK bootstrap/deployment

## CLI validation

```bash
aws sts get-caller-identity --profile aea-sandbox
aws sts get-caller-identity --profile aea-deploy
```

The `aea-sandbox` ARN should resolve to the PowerUser permission set.
The `aea-deploy` ARN should resolve to `AEA-CDK-Deployment-Admin`.

## Automated portion

After Identity Center and CLI profiles exist, the repository automation covers:

- local dependency validation
- CDK build and synth
- CDK bootstrap
- infrastructure diff/deployment
- Aurora/SSM resource discovery
- database IAM user initialization
- secure SQL execution through SSM
- database execution logging

See `environment-setup.md` for commands.

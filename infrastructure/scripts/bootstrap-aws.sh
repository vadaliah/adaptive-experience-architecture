#!/usr/bin/env bash
set -euo pipefail

AWS_DEPLOY_PROFILE="${AWS_DEPLOY_PROFILE:-aea-deploy}"
AWS_REGION="${AWS_REGION:-us-east-2}"
EXPECTED_ACCOUNT="${EXPECTED_ACCOUNT:-287238357427}"

ACCOUNT="$(
  aws sts get-caller-identity \
    --profile "$AWS_DEPLOY_PROFILE" \
    --query Account \
    --output text
)"

if [[ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then
  echo "ERROR: Deployment profile resolves to $ACCOUNT; expected $EXPECTED_ACCOUNT"
  exit 1
fi

echo "Bootstrapping CDK environment aws://$ACCOUNT/$AWS_REGION ..."
npx aws-cdk bootstrap \
  "aws://$ACCOUNT/$AWS_REGION" \
  --profile "$AWS_DEPLOY_PROFILE"

echo "CDK bootstrap completed successfully."

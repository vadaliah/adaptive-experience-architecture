#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-aea-sandbox}"
AWS_REGION="${AWS_REGION:-us-east-2}"
EXPECTED_ACCOUNT="${EXPECTED_ACCOUNT:-287238357427}"

echo "AEA AWS environment validation"
echo "=============================="

for cmd in aws node npm psql session-manager-plugin; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Missing required command: $cmd"
    exit 1
  fi
  echo "OK: $cmd -> $(command -v "$cmd")"
done

ACCOUNT="$(
  aws sts get-caller-identity \
    --profile "$AWS_PROFILE" \
    --query Account \
    --output text
)"

ARN="$(
  aws sts get-caller-identity \
    --profile "$AWS_PROFILE" \
    --query Arn \
    --output text
)"

if [[ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then
  echo "ERROR: Connected to AWS account $ACCOUNT; expected $EXPECTED_ACCOUNT"
  exit 1
fi

echo "AWS profile : $AWS_PROFILE"
echo "AWS region  : $AWS_REGION"
echo "AWS account : $ACCOUNT"
echo "Caller ARN  : $ARN"
echo
echo "Validation successful."

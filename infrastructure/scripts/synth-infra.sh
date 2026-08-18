#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-aea-sandbox}"
AWS_REGION="${AWS_REGION:-us-east-2}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

export CDK_DEFAULT_ACCOUNT="$(
  aws sts get-caller-identity \
    --profile "$AWS_PROFILE" \
    --query Account \
    --output text
)"
export CDK_DEFAULT_REGION="$AWS_REGION"

cd "$INFRA_DIR"

echo "Building CDK TypeScript..."
npm run build

echo "Synthesizing AeaSandboxStack..."
npx aws-cdk synth --profile "$AWS_PROFILE"

echo "CDK synth completed successfully."

#!/usr/bin/env bash
set -euo pipefail

AWS_DEPLOY_PROFILE="${AWS_DEPLOY_PROFILE:-aea-deploy}"
AWS_REGION="${AWS_REGION:-us-east-2}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

export CDK_DEFAULT_ACCOUNT="$(
  aws sts get-caller-identity \
    --profile "$AWS_DEPLOY_PROFILE" \
    --query Account \
    --output text
)"
export CDK_DEFAULT_REGION="$AWS_REGION"

cd "$INFRA_DIR"

echo "Building CDK TypeScript..."
npm run build

echo "Showing deployment diff..."
npx aws-cdk diff --profile "$AWS_DEPLOY_PROFILE"

echo
read -r -p "Deploy AeaSandboxStack? [y/N] " reply
case "$reply" in
  y|Y|yes|YES)
    npx aws-cdk deploy --profile "$AWS_DEPLOY_PROFILE"
    ;;
  *)
    echo "Deployment cancelled."
    ;;
esac

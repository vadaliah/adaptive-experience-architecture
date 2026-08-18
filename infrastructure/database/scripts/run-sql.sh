#!/usr/bin/env bash
set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-aea-sandbox}"
AWS_REGION="${AWS_REGION:-us-east-2}"
STACK_NAME="${STACK_NAME:-AeaSandboxStack}"
DB_NAME="${DB_NAME:-aea}"
DB_USER="${DB_USER:-aea_developer}"
DB_PORT="${DB_PORT:-5432}"
LOCAL_PORT="${LOCAL_PORT:-15432}"
SQL_FILE="${1:-}"

[[ -n "$SQL_FILE" ]] || { echo "Usage: $0 <sql-file>"; exit 1; }
[[ -f "$SQL_FILE" ]] || { echo "ERROR: SQL file not found: $SQL_FILE"; exit 1; }

for cmd in aws psql session-manager-plugin nc; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: Required command not found: $cmd"; exit 1; }
done

aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" >/dev/null

INSTANCE_ID="$(aws ec2 describe-instances --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --filters "Name=tag:aws:cloudformation:stack-name,Values=$STACK_NAME" "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[?contains(Tags[?Key=='Name'].Value | [0], 'DatabaseAccess/AccessHost')].InstanceId | [0]" \
  --output text)"

CLUSTER_ID="$(aws cloudformation list-stack-resources --stack-name "$STACK_NAME" --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query "StackResourceSummaries[?ResourceType=='AWS::RDS::DBCluster'].PhysicalResourceId | [0]" --output text)"

DB_HOST="$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query "DBClusters[0].Endpoint" --output text)"

[[ -n "$INSTANCE_ID" && "$INSTANCE_ID" != "None" ]] || { echo "ERROR: Access host not found."; exit 1; }
[[ -n "$DB_HOST" && "$DB_HOST" != "None" ]] || { echo "ERROR: Aurora endpoint not found."; exit 1; }

TUNNEL_LOG="$(mktemp -t aea-db-tunnel.XXXXXX)"
aws ssm start-session --profile "$AWS_PROFILE" --region "$AWS_REGION" --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$DB_HOST\"],\"portNumber\":[\"$DB_PORT\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}" \
  >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

cleanup() {
  unset PGPASSWORD || true
  kill "$TUNNEL_PID" 2>/dev/null || true
  wait "$TUNNEL_PID" 2>/dev/null || true
  rm -f "$TUNNEL_LOG"
}
trap cleanup EXIT INT TERM

for _ in {1..20}; do
  nc -z 127.0.0.1 "$LOCAL_PORT" 2>/dev/null && break
  kill -0 "$TUNNEL_PID" 2>/dev/null || { cat "$TUNNEL_LOG"; exit 1; }
  sleep 1
done
nc -z 127.0.0.1 "$LOCAL_PORT" 2>/dev/null || { echo "ERROR: Tunnel unavailable."; cat "$TUNNEL_LOG"; exit 1; }

export PGPASSWORD="$(aws rds generate-db-auth-token --hostname "$DB_HOST" --port "$DB_PORT" \
  --region "$AWS_REGION" --username "$DB_USER" --profile "$AWS_PROFILE")"

echo "Executing $SQL_FILE as $DB_USER on $DB_NAME..."
psql "host=$DB_HOST hostaddr=127.0.0.1 port=$LOCAL_PORT dbname=$DB_NAME user=$DB_USER sslmode=require" \
  --set ON_ERROR_STOP=1 --file "$SQL_FILE"
echo "SQL execution completed successfully."

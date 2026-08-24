#!/usr/bin/env bash

set -euo pipefail

echo "======================================================"
echo " AEA Backend Runtime Initialization"
echo "======================================================"

# -------------------------------------------------------
# Locate repository
# -------------------------------------------------------

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"

if [[ -z "${REPO_ROOT}" ]]; then
    echo "ERROR: Unable to determine Git repository root."
    exit 1
fi

BACKEND_DIR="${REPO_ROOT}/implementations/florist/backend"

# -------------------------------------------------------
# Load environment
# -------------------------------------------------------

source "${BACKEND_DIR}/scripts/init-env.sh" local

echo
echo "Checking AWS authentication..."

if ! aws sts get-caller-identity \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" \
    >/dev/null 2>&1
then
    echo "AWS session is missing or expired."
    echo "Starting AWS SSO login..."

    aws sso login --profile "${AWS_PROFILE}"
fi

echo "AWS authentication OK."

# -------------------------------------------------------
# Discover AccessHost
# -------------------------------------------------------

echo
echo "Discovering database AccessHost..."

ACCESS_HOST_ID=$(
    aws ec2 describe-instances \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --filters \
          "Name=instance-state-name,Values=running" \
          "Name=tag:Name,Values=AeaSandboxStack/DatabaseAccess/AccessHost" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text
)

if [[ -z "${ACCESS_HOST_ID}" || "${ACCESS_HOST_ID}" == "None" ]]; then
    echo "ERROR: Unable to locate running database AccessHost."
    exit 1
fi

echo "AccessHost : ${ACCESS_HOST_ID}"

# -------------------------------------------------------
# Verify AccessHost is available through SSM
# -------------------------------------------------------

SSM_STATUS=$(
    aws ssm describe-instance-information \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --filters "Key=InstanceIds,Values=${ACCESS_HOST_ID}" \
        --query 'InstanceInformationList[0].PingStatus' \
        --output text
)

if [[ "${SSM_STATUS}" != "Online" ]]; then
    echo "ERROR: AccessHost is not online in SSM."
    echo "SSM status: ${SSM_STATUS}"
    exit 1
fi

echo "SSM status : ${SSM_STATUS}"

# -------------------------------------------------------
# Discover Aurora
# -------------------------------------------------------

echo
echo "Discovering Aurora endpoint..."

AURORA_ENDPOINT=$(
    aws rds describe-db-clusters \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --query "DBClusters[?DatabaseName=='${DB_NAME}'].Endpoint | [0]" \
        --output text
)

if [[ -z "${AURORA_ENDPOINT}" || "${AURORA_ENDPOINT}" == "None" ]]; then
    echo "ERROR: Unable to locate Aurora database ${DB_NAME}."
    exit 1
fi

echo "Aurora     : ${AURORA_ENDPOINT}"
echo "Database   : ${DB_NAME}"
echo
echo "======================================================"
echo " AEA runtime infrastructure discovery successful"
echo "======================================================"


echo
echo "Starting SSM database tunnel..."

LOCAL_PORT="${DB_PORT}"
REMOTE_PORT="5432"
TUNNEL_LOG="/tmp/aea-ssm-tunnel.log"

aws ssm start-session \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" \
    --target "${ACCESS_HOST_ID}" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters \
      "{\"host\":[\"${AURORA_ENDPOINT}\"],\"portNumber\":[\"${REMOTE_PORT}\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}" \
    > "${TUNNEL_LOG}" 2>&1 &

SSM_PID=$!

echo "SSM tunnel process started."
echo "PID        : ${SSM_PID}"
echo "Local port : ${LOCAL_PORT}"

cleanup() {
    echo
    echo "Stopping SSM tunnel..."

    kill "${SSM_PID}" 2>/dev/null || true
    wait "${SSM_PID}" 2>/dev/null || true

    echo "SSM tunnel stopped."
}

trap cleanup EXIT INT TERM

echo
echo "Waiting for tunnel readiness..."

TUNNEL_READY=false

for ATTEMPT in {1..20}; do
    if nc -z 127.0.0.1 "${LOCAL_PORT}" >/dev/null 2>&1; then
        TUNNEL_READY=true
        break
    fi

    sleep 1
done

if [[ "${TUNNEL_READY}" != "true" ]]; then
    echo "ERROR: SSM tunnel did not become ready."
    echo
    echo "Tunnel log:"
    cat "${TUNNEL_LOG}"
    exit 1
fi

echo "SSM tunnel ready."
echo "Database route:"
echo "127.0.0.1:${LOCAL_PORT} -> ${AURORA_ENDPOINT}:${REMOTE_PORT}"

echo

if [[ $# -eq 0 ]]; then
    echo "ERROR: No runtime command supplied."
    exit 1
fi

echo "======================================================"
echo " Executing Runtime Command"
echo "======================================================"
echo
cd "${REPO_ROOT}"
"$@"
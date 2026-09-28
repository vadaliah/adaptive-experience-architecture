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
RUNTIME_DIR="${BACKEND_DIR}/runtime"

mkdir -p "${RUNTIME_DIR}"


# -------------------------------------------------------
# Runtime files
#
# PID and log files are maintained inside the backend
# runtime directory. Generated runtime files are excluded
# from Git.
# -------------------------------------------------------

BACKEND_PID_FILE="${RUNTIME_DIR}/backend.pid"
SSM_PID_FILE="${RUNTIME_DIR}/ssm.pid"

BACKEND_LOG="${RUNTIME_DIR}/backend.log"
TUNNEL_LOG="${RUNTIME_DIR}/ssm.log"


# -------------------------------------------------------
# Load application environment
# -------------------------------------------------------

source "${BACKEND_DIR}/scripts/init-env.sh" local


# -------------------------------------------------------
# AWS runtime configuration
#
# Export the profile and region so child processes,
# including npm, Node.js and the AWS SDK, inherit the
# same AWS runtime configuration.
# -------------------------------------------------------

export AWS_PROFILE="${AWS_PROFILE:-aea-deploy}"
export AWS_REGION="${AWS_REGION:-us-east-2}"


# -------------------------------------------------------
# Prevent duplicate runtime
#
# PID files identify processes owned by this AEA runtime.
# If a PID file exists but its process no longer exists,
# the file is treated as stale and removed.
# -------------------------------------------------------

if [[ -f "${BACKEND_PID_FILE}" ]]; then

    EXISTING_BACKEND_PID="$(cat "${BACKEND_PID_FILE}")"

    if kill -0 "${EXISTING_BACKEND_PID}" 2>/dev/null; then
        echo
        echo "ERROR: AEA backend is already running."
        echo "Backend PID : ${EXISTING_BACKEND_PID}"
        echo
        echo "Use:"
        echo "  npm run stop:backend"
        exit 1
    fi

    rm -f "${BACKEND_PID_FILE}"
fi


if [[ -f "${SSM_PID_FILE}" ]]; then

    EXISTING_SSM_PID="$(cat "${SSM_PID_FILE}")"

    if kill -0 "${EXISTING_SSM_PID}" 2>/dev/null; then
        echo
        echo "ERROR: AEA SSM tunnel is already running."
        echo "SSM PID : ${EXISTING_SSM_PID}"
        echo
        echo "Use:"
        echo "  npm run stop:backend"
        exit 1
    fi

    rm -f "${SSM_PID_FILE}"
fi


# -------------------------------------------------------
# Verify AWS authentication
#
# If the configured SSO session is unavailable or expired,
# initiate AWS SSO login before continuing.
# -------------------------------------------------------

echo
echo "Checking AWS authentication..."

if ! aws sts get-caller-identity \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" \
    >/dev/null 2>&1
then
    echo "AWS session is missing or expired."
    echo "Starting AWS SSO login..."

    aws sso login \
        --profile "${AWS_PROFILE}"
fi

echo "AWS authentication OK."


# -------------------------------------------------------
# Discover database AccessHost
#
# The AccessHost provides the network path between the
# local development environment and private Aurora.
#
# Discover it regardless of whether it is currently
# running or stopped.
# -------------------------------------------------------

echo
echo "Discovering database AccessHost..."

ACCESS_HOST_ID=$(
    aws ec2 describe-instances \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --filters \
          "Name=tag:Name,Values=AeaSandboxStack/DatabaseAccess/AccessHost" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text
)

if [[ -z "${ACCESS_HOST_ID}" || "${ACCESS_HOST_ID}" == "None" ]]; then
    echo "ERROR: Unable to locate database AccessHost."
    exit 1
fi


# -------------------------------------------------------
# Determine AccessHost state
# -------------------------------------------------------

ACCESS_HOST_STATE=$(
    aws ec2 describe-instances \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --instance-ids "${ACCESS_HOST_ID}" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text
)

echo "AccessHost : ${ACCESS_HOST_ID}"
echo "EC2 state  : ${ACCESS_HOST_STATE}"


# -------------------------------------------------------
# Start AccessHost when required
# -------------------------------------------------------

if [[ "${ACCESS_HOST_STATE}" == "stopped" ]]; then

    echo
    echo "AccessHost is stopped. Starting..."

    aws ec2 start-instances \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --instance-ids "${ACCESS_HOST_ID}" \
        >/dev/null

    echo "Waiting for AccessHost to enter running state..."

    aws ec2 wait instance-running \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --instance-ids "${ACCESS_HOST_ID}"

    echo "AccessHost is running."

elif [[ "${ACCESS_HOST_STATE}" != "running" ]]; then

    echo "ERROR: AccessHost is in unsupported state:"
    echo "       ${ACCESS_HOST_STATE}"
    exit 1

fi


# -------------------------------------------------------
# Wait for AccessHost SSM availability
#
# EC2 may report "running" before the SSM Agent is ready.
# Wait until Systems Manager reports the host Online.
# -------------------------------------------------------

echo
echo "Waiting for AccessHost SSM availability..."

SSM_ONLINE=false

for ATTEMPT in {1..30}; do

    SSM_STATUS=$(
        aws ssm describe-instance-information \
            --profile "${AWS_PROFILE}" \
            --region "${AWS_REGION}" \
            --filters "Key=InstanceIds,Values=${ACCESS_HOST_ID}" \
            --query 'InstanceInformationList[0].PingStatus' \
            --output text \
            2>/dev/null || true
    )

    if [[ "${SSM_STATUS}" == "Online" ]]; then
        SSM_ONLINE=true
        break
    fi

    echo "Waiting for SSM... (${ATTEMPT}/30)"
    sleep 5

done


if [[ "${SSM_ONLINE}" != "true" ]]; then
    echo "ERROR: AccessHost did not become online in SSM."
    exit 1
fi

echo "SSM status : Online"


# -------------------------------------------------------
# Discover Aurora cluster
#
# Locate Aurora using the configured database name rather
# than depending on the generated CDK cluster identifier.
# -------------------------------------------------------

echo
echo "Discovering Aurora cluster..."

AURORA_CLUSTER_ID=$(
    aws rds describe-db-clusters \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --query "DBClusters[?DatabaseName=='${DB_NAME}'].DBClusterIdentifier | [0]" \
        --output text
)

if [[ -z "${AURORA_CLUSTER_ID}" || "${AURORA_CLUSTER_ID}" == "None" ]]; then
    echo "ERROR: Unable to locate Aurora database ${DB_NAME}."
    exit 1
fi


# -------------------------------------------------------
# Determine Aurora state
# -------------------------------------------------------

AURORA_STATUS=$(
    aws rds describe-db-clusters \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --db-cluster-identifier "${AURORA_CLUSTER_ID}" \
        --query 'DBClusters[0].Status' \
        --output text
)

echo "Aurora cluster : ${AURORA_CLUSTER_ID}"
echo "Aurora status  : ${AURORA_STATUS}"


# -------------------------------------------------------
# Start Aurora when required
# -------------------------------------------------------

if [[ "${AURORA_STATUS}" == "stopped" ]]; then

    echo
    echo "Aurora is stopped. Starting..."
    echo "This may take several minutes."

    aws rds start-db-cluster \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --db-cluster-identifier "${AURORA_CLUSTER_ID}" \
        >/dev/null

    echo "Waiting for Aurora to become available..."

    aws rds wait db-cluster-available \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --db-cluster-identifier "${AURORA_CLUSTER_ID}"

    echo "Aurora is available."

elif [[ "${AURORA_STATUS}" != "available" ]]; then

    echo
    echo "Aurora is currently ${AURORA_STATUS}."
    echo "Waiting for Aurora to become available..."

    aws rds wait db-cluster-available \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --db-cluster-identifier "${AURORA_CLUSTER_ID}"

    echo "Aurora is available."

fi


# -------------------------------------------------------
# Retrieve current Aurora endpoint
# -------------------------------------------------------

AURORA_ENDPOINT=$(
    aws rds describe-db-clusters \
        --profile "${AWS_PROFILE}" \
        --region "${AWS_REGION}" \
        --db-cluster-identifier "${AURORA_CLUSTER_ID}" \
        --query 'DBClusters[0].Endpoint' \
        --output text
)

if [[ -z "${AURORA_ENDPOINT}" || "${AURORA_ENDPOINT}" == "None" ]]; then
    echo "ERROR: Unable to determine Aurora endpoint."
    exit 1
fi

echo
echo "Aurora       : ${AURORA_ENDPOINT}"
echo "Database     : ${DB_NAME}"

echo
echo "======================================================"
echo " AEA runtime infrastructure discovery successful"
echo "======================================================"


# -------------------------------------------------------
# Start SSM database tunnel
#
# Local PostgreSQL connections are made to:
#
#   127.0.0.1:${DB_PORT}
#
# SSM forwards them through AccessHost to:
#
#   Aurora:5432
# -------------------------------------------------------

echo
echo "Starting SSM database tunnel..."

LOCAL_PORT="${DB_PORT}"
REMOTE_PORT="5432"

: > "${TUNNEL_LOG}"

aws ssm start-session \
    --profile "${AWS_PROFILE}" \
    --region "${AWS_REGION}" \
    --target "${ACCESS_HOST_ID}" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters \
      "{\"host\":[\"${AURORA_ENDPOINT}\"],\"portNumber\":[\"${REMOTE_PORT}\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}" \
    > "${TUNNEL_LOG}" 2>&1 &

SSM_PID=$!

echo "${SSM_PID}" > "${SSM_PID_FILE}"

echo "SSM tunnel process started."
echo "PID        : ${SSM_PID}"
echo "Local port : ${LOCAL_PORT}"


# -------------------------------------------------------
# Startup failure cleanup
#
# Once initialization succeeds, stop-runtime.sh owns the
# runtime lifecycle. This cleanup function is only used
# when startup fails after the SSM tunnel was created.
# -------------------------------------------------------

cleanup_startup_failure() {

    if [[ -n "${SSM_PID:-}" ]] &&
       kill -0 "${SSM_PID}" 2>/dev/null; then

        echo
        echo "Cleaning up SSM tunnel..."

        kill "${SSM_PID}" 2>/dev/null || true
        wait "${SSM_PID}" 2>/dev/null || true
    fi

    rm -f "${SSM_PID_FILE}"
}


# -------------------------------------------------------
# Wait for tunnel readiness
#
# Verify:
#
#   1. The SSM process remains alive.
#   2. The local forwarding port accepts connections.
# -------------------------------------------------------

echo
echo "Waiting for tunnel readiness..."

TUNNEL_READY=false

for ATTEMPT in {1..20}; do

    if ! kill -0 "${SSM_PID}" 2>/dev/null; then

        echo "ERROR: SSM tunnel process terminated unexpectedly."
        echo
        echo "Tunnel log:"
        cat "${TUNNEL_LOG}"

        cleanup_startup_failure
        exit 1
    fi

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

    cleanup_startup_failure
    exit 1
fi

echo "SSM tunnel ready."
echo
echo "Database route:"
echo "127.0.0.1:${LOCAL_PORT} -> ${AURORA_ENDPOINT}:${REMOTE_PORT}"


# -------------------------------------------------------
# Validate runtime command
# -------------------------------------------------------

echo

if [[ $# -eq 0 ]]; then
    echo "ERROR: No runtime command supplied."
    cleanup_startup_failure
    exit 1
fi


# -------------------------------------------------------
# Start backend application in background
#
# The backend and SSM tunnel remain running after this
# initialization script exits.
#
# Their PIDs are persisted in backend/runtime so the
# stop-runtime.sh script can terminate exactly the
# processes belonging to this AEA runtime.
# -------------------------------------------------------

echo "======================================================"
echo " Starting Backend Runtime"
echo "======================================================"
echo

cd "${REPO_ROOT}"

: > "${BACKEND_LOG}"

"$@" > "${BACKEND_LOG}" 2>&1 &

BACKEND_PID=$!

echo "${BACKEND_PID}" > "${BACKEND_PID_FILE}"


# -------------------------------------------------------
# Verify backend survived startup
# -------------------------------------------------------

sleep 2

if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then

    echo "ERROR: Backend process terminated during startup."
    echo
    echo "Backend log:"
    cat "${BACKEND_LOG}"

    rm -f "${BACKEND_PID_FILE}"

    cleanup_startup_failure

    exit 1
fi


# -------------------------------------------------------
# Runtime successfully started
# -------------------------------------------------------

echo "AEA backend runtime started successfully."
echo
echo "Backend PID : ${BACKEND_PID}"
echo "SSM PID     : ${SSM_PID}"
echo
echo "Backend log : ${BACKEND_LOG}"
echo "Tunnel log  : ${TUNNEL_LOG}"
echo
echo "Backend URL : http://localhost:3001"
echo
echo "Use:"
echo "  npm run stop:backend"
echo
echo "to stop the backend runtime."
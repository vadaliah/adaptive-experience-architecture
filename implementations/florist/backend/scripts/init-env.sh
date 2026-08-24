#!/usr/bin/env bash

# =============================================================================
# AEA Backend Environment Initialization
#
# May be sourced from anywhere inside the Git repository.
# =============================================================================

ENVIRONMENT="${1:-local}"

# ---------------------------------------------------------------------------
# Resolve project locations
# ---------------------------------------------------------------------------

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"

if [[ -z "${REPO_ROOT}" ]]; then
    echo "ERROR: Unable to determine Git repository root."
    return 1
fi

BACKEND_DIR="${REPO_ROOT}/implementations/florist/backend"
ENV_FILE="${BACKEND_DIR}/config/.env.${ENVIRONMENT}"

echo "======================================================"
echo " AEA Backend Environment Initialization"
echo "======================================================"
echo "Environment : ${ENVIRONMENT}"
echo "Repository  : ${REPO_ROOT}"
echo "Backend dir : ${BACKEND_DIR}"
echo "Config file : ${ENV_FILE}"
echo

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: Environment file not found:"
    echo "       ${ENV_FILE}"
    return 1
fi

set -a
source "${ENV_FILE}"
set +a

REQUIRED_VARIABLES=(
    AWS_REGION
    BEDROCK_MODEL_ID
    DB_NAME
    DB_USER
    DB_PORT
    VOCABULARY_CACHE_TTL_SECONDS
)

for VAR_NAME in "${REQUIRED_VARIABLES[@]}"; do
    VALUE="$(printenv "${VAR_NAME}")"

    if [[ -z "${VALUE}" ]]; then
        echo "ERROR: Required environment variable is missing: ${VAR_NAME}"
        return 1
    fi
done

echo "Environment variables loaded successfully."
echo
echo "AWS_REGION=${AWS_REGION}"
echo "BEDROCK_MODEL_ID=${BEDROCK_MODEL_ID}"
echo
echo "DB_NAME=${DB_NAME}"
echo "DB_USER=${DB_USER}"
echo "DB_HOST=${DB_HOST:-<not-configured>}"
echo "DB_PORT=${DB_PORT}"
echo
echo "VOCABULARY_CACHE_TTL_SECONDS=${VOCABULARY_CACHE_TTL_SECONDS}"
echo "LOG_LEVEL=${LOG_LEVEL:-INFO}"
echo
echo "======================================================"
echo " AEA backend environment initialization complete"
echo "======================================================"
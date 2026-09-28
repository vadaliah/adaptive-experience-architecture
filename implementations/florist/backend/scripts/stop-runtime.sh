#!/usr/bin/env bash

set -euo pipefail

echo "======================================================"
echo " AEA Backend Runtime Shutdown"
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

BACKEND_PID_FILE="${RUNTIME_DIR}/backend.pid"
SSM_PID_FILE="${RUNTIME_DIR}/ssm.pid"


# -------------------------------------------------------
# Stop process using its runtime PID file
#
# We deliberately use PID files rather than searching for
# generic Node.js or AWS processes. This prevents the AEA
# shutdown routine from terminating unrelated processes
# on the developer workstation.
# -------------------------------------------------------

stop_process() {

    local NAME="$1"
    local PID_FILE="$2"

    if [[ ! -f "${PID_FILE}" ]]; then
        echo "${NAME}: not running (no PID file)."
        return
    fi

    local PID
    PID="$(cat "${PID_FILE}")"

    if ! kill -0 "${PID}" 2>/dev/null; then
        echo "${NAME}: process ${PID} is no longer running."
        rm -f "${PID_FILE}"
        return
    fi

    echo "Stopping ${NAME} (PID ${PID})..."

    kill "${PID}" 2>/dev/null || true

    # Allow the process up to ten seconds to terminate
    # gracefully before forcing termination.
    for ATTEMPT in {1..10}; do

        if ! kill -0 "${PID}" 2>/dev/null; then
            break
        fi

        sleep 1

    done

    if kill -0 "${PID}" 2>/dev/null; then
        echo "${NAME} did not stop gracefully."
        echo "Forcing termination..."

        kill -9 "${PID}" 2>/dev/null || true
    fi

    rm -f "${PID_FILE}"

    echo "${NAME} stopped."
}


# -------------------------------------------------------
# Stop application before removing its database route
# -------------------------------------------------------

echo

stop_process \
    "Backend" \
    "${BACKEND_PID_FILE}"

stop_process \
    "SSM tunnel" \
    "${SSM_PID_FILE}"

echo
echo "AEA backend runtime stopped."
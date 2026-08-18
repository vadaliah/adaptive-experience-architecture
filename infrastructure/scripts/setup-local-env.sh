#!/usr/bin/env bash
set -euo pipefail

echo "AEA local environment setup"
echo "==========================="

if ! command -v brew >/dev/null 2>&1; then
  echo "ERROR: Homebrew is required before running this script."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Installing Homebrew dependencies from $INFRA_DIR/Brewfile..."
brew bundle --file "$INFRA_DIR/Brewfile"

LIBPQ_BIN="$(brew --prefix libpq)/bin"

echo
echo "For the current terminal, run:"
echo "  export PATH=\"/usr/local/bin:$LIBPQ_BIN:\$PATH\""
echo
echo "If Session Manager resolves incorrectly, ensure the AWS binary is linked:"
echo "  sudo mkdir -p /usr/local/bin"
echo "  sudo ln -sf /usr/local/sessionmanagerplugin/bin/session-manager-plugin /usr/local/bin/session-manager-plugin"

echo
echo "Installing infrastructure npm dependencies..."
cd "$INFRA_DIR"
npm install

echo
echo "Local environment setup complete."

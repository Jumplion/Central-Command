#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Running unit tests..."
npm run test

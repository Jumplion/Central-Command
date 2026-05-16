#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Running TypeScript typecheck..."
npm run typecheck

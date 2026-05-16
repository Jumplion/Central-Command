#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Compiling production bundles (no app launch — use start.sh to run, package.sh to package)..."
npm run build

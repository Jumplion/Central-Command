#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building production bundles..."
npm run build

echo "Launching the production build..."
npm run start

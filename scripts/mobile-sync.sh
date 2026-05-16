#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building mobile web app and syncing Android project..."
npm run mobile:sync

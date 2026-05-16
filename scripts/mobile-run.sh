#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building mobile web app, syncing, and running on connected Android device..."
npm run mobile:run

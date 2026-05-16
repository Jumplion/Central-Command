#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building mobile web assets..."
npm run build:mobile

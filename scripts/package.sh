#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Packaging the app..."
npm run package

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "No dedicated lint command is configured in package.json."
echo "Running the TypeScript typecheck as a project validation step..."
npm run typecheck

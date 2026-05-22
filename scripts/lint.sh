#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Running ESLint..."
npm run lint:fix --if-present

echo "Checking Prettier formatting..."
npx prettier --write .

echo "Running TypeScript type check..."
npm run typecheck

echo "✓ All lint checks passed!"

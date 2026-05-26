#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "🔍 Running validation pipeline..."
echo ""

echo "1️⃣  Running lint checks..."
npm run lint:fix --if-present
npx prettier --write .
npm run typecheck
echo "✓ Lint checks passed!"
echo ""

echo "2️⃣  Running unit tests..."
npm run test
echo "✓ Tests passed!"
echo ""

echo "3️⃣  Building production bundles..."
npm run build
echo "✓ Build successful!"
echo ""

echo "4️⃣  Launching the application..."
npm run start

echo ""
echo "✅ Validation pipeline completed successfully!"

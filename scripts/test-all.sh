#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/run-memory-limited.sh"
cd "$(dirname "$0")/.."

npm run lint
npm run build:static
node --require ./tests/common/test_output_buffer.cjs --test --test-reporter=./tests/common/spec_reporter.cjs --test-concurrency=1 tests/all.mjs

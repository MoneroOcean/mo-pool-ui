#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/run-memory-limited.sh"
cd "$(dirname "$0")/.."

SHA="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
if ! git diff --quiet -- . 2>/dev/null || ! git diff --cached --quiet -- . 2>/dev/null; then
  SHA="${SHA}-dirty-$(date +%s)"
fi

rm -rf build
mkdir -p build

npx esbuild script.js --bundle --format=iife --target=es2022 --minify --outfile=build/script.esbuild.js --log-level=warning
npx terser build/script.esbuild.js --compress passes=10,booleans_as_integers=true,unsafe=true,unsafe_arrows=true,unsafe_methods=true,unsafe_comps=true,unsafe_math=true,pure_getters=true,module=true,hoist_props=true,keep_fargs=false --mangle --ecma 2022 -o build/script.js
rm build/script.esbuild.js
npx esbuild style.css --bundle --minify --outfile=build/style.css --log-level=warning
npx csso-cli build/style.css --output build/style.css

sed \
  -e "s|href=\"style.css\"|href=\"style.css?v=${SHA}\"|" \
  -e "s|src=\"script.js\" type=\"module\"|src=\"script.js?v=${SHA}\" defer|" \
  index.html > build/index.html
npx html-minifier-terser build/index.html --collapse-whitespace --remove-comments --remove-redundant-attributes --collapse-boolean-attributes --remove-attribute-quotes --remove-optional-tags --use-short-doctype --minify-css true --minify-js true -o build/index.html

printf 'Built build/index.html, build/script.js, build/style.css using cache key %s\n' "$SHA"

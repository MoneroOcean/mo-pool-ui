#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

update_nginx_csp_hash() {
  local hash="$1"
  local config=""
  local candidate
  local target
  local backup
  local tmp
  local rc

  for candidate in /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default; do
    [ -f "$candidate" ] || continue
    config="$candidate"
    break
  done
  [ -n "$config" ] || return 0

  target="$(readlink -f "$config")"
  [ -f "$target" ] || return 0

  tmp="$(mktemp)"
  set +e
  node - "$target" "$hash" "$tmp" <<'NODE'
const fs = require("node:fs");

const [configPath, hash, outputPath] = process.argv.slice(2);
const source = fs.readFileSync(configPath, "utf8");
const blocks = [];
const serverRe = /\bserver\s*\{/g;
let match;

while ((match = serverRe.exec(source))) {
  let depth = 1;
  let index = serverRe.lastIndex;
  let quote = "";

  for (; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (char === quote && previous !== "\\") quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        blocks.push({ start: match.index, end: index + 1, text: source.slice(match.index, index + 1) });
        serverRe.lastIndex = index + 1;
        break;
      }
    }
  }
}

const candidates = blocks.filter(({ text }) =>
  /\broot\s+\/var\/www\/mo-pool-ui\s*;/.test(text) &&
  /add_header\s+Content-Security-Policy\b/.test(text)
);

if (candidates.length === 0) process.exit(2);
if (candidates.length !== 1) {
  console.error(`Refusing to update ${configPath}: found ${candidates.length} mo-pool-ui CSP server blocks`);
  process.exit(3);
}

const block = candidates[0];
const hashes = block.text.match(/sha256-[A-Za-z0-9+/=]+/g) || [];
if (hashes.length !== 1) {
  console.error(`Refusing to update ${configPath}: found ${hashes.length} sha256 hashes in mo-pool-ui CSP block`);
  process.exit(4);
}
if (hashes[0] === hash) process.exit(5);

const updatedBlock = block.text.replace(hashes[0], hash);
const next = source.slice(0, block.start) + updatedBlock + source.slice(block.end);
fs.writeFileSync(outputPath, next);
NODE
  rc=$?
  set -e

  if [ "$rc" -eq 2 ] || [ "$rc" -eq 5 ]; then
    rm -f "$tmp"
    return 0
  fi
  if [ "$rc" -ne 0 ]; then
    rm -f "$tmp"
    return "$rc"
  fi

  backup="${target}.bak-csp-$(date +%Y%m%d%H%M%S)"
  run_privileged cp "$target" "$backup"
  if [ -w "$(dirname "$target")" ]; then
    cp "$tmp" "${target}.csp-new"
    chmod --reference="$target" "${target}.csp-new"
    chown --reference="$target" "${target}.csp-new" 2>/dev/null || true
    mv "${target}.csp-new" "$target"
  else
    run_privileged cp "$tmp" "${target}.csp-new"
    run_privileged chmod --reference="$target" "${target}.csp-new"
    run_privileged chown --reference="$target" "${target}.csp-new"
    run_privileged mv "${target}.csp-new" "$target"
  fi
  rm -f "$tmp"

  if command -v nginx >/dev/null 2>&1; then
    if ! run_privileged nginx -t; then
      run_privileged cp "$backup" "$target"
      run_privileged nginx -t
      printf 'Restored nginx config backup after failed CSP hash update: %s\n' "$backup" >&2
      return 1
    fi
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
      run_privileged systemctl reload nginx
    elif pgrep -x nginx >/dev/null 2>&1; then
      run_privileged nginx -s reload
    else
      printf 'nginx is not running; updated config was validated but not reloaded\n'
      printf 'Updated nginx CSP hash in %s to %s; backup: %s\n' "$target" "$hash" "$backup"
      return 0
    fi
    printf 'Reloaded nginx with updated CSP hash\n'
  fi

  printf 'Updated nginx CSP hash in %s to %s; backup: %s\n' "$target" "$hash" "$backup"
}

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

npm test

SUDO=""
if [ -d /var/www ] && [ ! -w /var/www ]; then
  SUDO="sudo"
fi

$SUDO rm -rf /var/www/mo-pool-ui
$SUDO mkdir -p /var/www/mo-pool-ui
$SUDO cp -r build/. /var/www/mo-pool-ui/

CSP_HASH="$(./csp-hash.sh build/index.html)"
update_nginx_csp_hash "$CSP_HASH"

printf 'Built build/index.html, build/script.js, build/style.css using cache key %s\n' "$SHA"
PACKED_SIZE="$(node - <<'NODE'
const { readFileSync } = require("node:fs");
const { gzipSync } = require("node:zlib");
const parts = ["build/index.html", "build/style.css", "build/script.js"].map((path) => readFileSync(path));
process.stdout.write(String(gzipSync(Buffer.concat(parts)).byteLength));
NODE
)"
printf 'Build gzip packed size: %s bytes / 40000 byte target\n' "$PACKED_SIZE"
printf 'Deployed to /var/www/mo-pool-ui\n'
printf 'Current JSON-LD CSP hash is %s\n' "$CSP_HASH"

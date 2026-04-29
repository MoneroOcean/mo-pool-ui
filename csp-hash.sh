#!/usr/bin/env bash
set -euo pipefail

index_file="${1:-build/index.html}"

if [ ! -f "$index_file" ]; then
  if [ "$index_file" = "build/index.html" ] && [ -f "index.html" ]; then
    echo "build/index.html not found; using source index.html. Run npm run build first for the deployed hash." >&2
    index_file="index.html"
  else
    echo "Usage: $0 [path/to/index.html]" >&2
    exit 1
  fi
fi

node - "$index_file" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");

const indexPath = process.argv[2];
const html = fs.readFileSync(indexPath, "utf8");
const match = html.match(/<script\b(?=[^>]*\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json(?:\s|>)))[^>]*>([\s\S]*?)<\/script>/i);

if (!match) {
  console.error(`No application/ld+json script found in ${indexPath}`);
  process.exit(1);
}

const hash = crypto.createHash("sha256").update(match[1], "utf8").digest("base64");
console.log(`sha256-${hash}`);
NODE

#!/bin/bash -x
# sudo DEBIAN_FRONTEND=noninteractive apt-get install -y chromium-browser
# npm install -g uglifycss uglify-js html-minifier
# npm install -D critical@latest
# snap install chromium

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd $SCRIPT_DIR
if command -v chromium-browser >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH="$(command -v chromium-browser)"
elif command -v chromium >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH="$(command -v chromium)"
elif [ -x /snap/bin/chromium ]; then
    export PUPPETEER_EXECUTABLE_PATH=/snap/bin/chromium
else
    PLAYWRIGHT_CHROMIUM="$(find "$HOME/.cache/ms-playwright" -path '*/chrome-linux64/chrome' -type f -perm -111 2>/dev/null | sort -V | tail -n 1)"
    if [ -z "$PLAYWRIGHT_CHROMIUM" ]; then
        echo "No Chromium executable found" >&2
        exit 1
    fi
    export PUPPETEER_EXECUTABLE_PATH="$PLAYWRIGHT_CHROMIUM"
fi
NPM_BIN="$SCRIPT_DIR/node_modules/.bin"
mkdir `pwd`/tmp 2>/dev/null

"$NPM_BIN/uglifycss" --output build/style_min.css style.css &&\
#uglifyjs  --output build/script_min.js script.js web_miner/miner.js &&\
#uglifyjs  --output build/worker.js web_miner/worker.js &&\
"$NPM_BIN/uglifyjs"  --output build/script_min.js script.js &&\
#cp web_miner/cn.min.js build/cn.min.js &&\
"$NPM_BIN/html-minifier" --output build/index-raw.html index.html --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true &&\
TMP=`pwd`/tmp node critical.mjs &&\
rm build/index-raw.html &&\
sudo rm -rf /var/www/mo &&\
sudo cp -r build /var/www/mo &&\
echo OK

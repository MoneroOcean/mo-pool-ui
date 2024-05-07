#!/bin/bash -x
# sudo DEBIAN_FRONTEND=noninteractive apt-get install -y chromium-browser
# npm install -g uglifycss uglify-js html-minifier
# npm install -D critical@latest
# snap install chromium

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd $SCRIPT_DIR
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
mkdir `pwd`/tmp 2>/dev/null

uglifycss --output build/style_min.css style.css &&\
#uglifyjs  --output build/script_min.js script.js web_miner/miner.js &&\
#uglifyjs  --output build/worker.js web_miner/worker.js &&\
uglifyjs  --output build/script_min.js script.js &&\
#cp web_miner/cn.min.js build/cn.min.js &&\
html-minifier --output build/index-raw.html index.html --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true &&\
TMP=`pwd`/tmp node critical.mjs &&\
rm build/index-raw.html &&\
sudo rm -rf /var/www/mo &&\
sudo cp build /var/www/mo &&\
echo OK

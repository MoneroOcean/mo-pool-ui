import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { gzipSync } from "node:zlib";

test("source HTML has SEO metadata and no legacy asset references", async () => {
  const index = await readFile("index.html", "utf8");
  assert.match(index, /MoneroOcean Pool Dashboard/);
  assert.match(index, /application\/ld\+json/);
  assert.match(index, /noscript/);
  assert.doesNotMatch(index, /font\/|assets\/|minerbox|web_miner|script_min|style_min/);

  const constants = await readFile("src/constants.js", "utf8");
  assert.match(constants, /SUPPORT_EMAIL_CODES/);
  assert.match(constants, /atob\(SUPPORT_EMAIL_CODES\)/);
  assert.doesNotMatch(constants, /support@moneroocean\.stream/);
});

test("detail explanations use an owning tooltip element", async () => {
  const files = (await readdir("src/views")).filter((name) => name.endsWith(".js"));
  for (const file of files) {
    const path = `src/views/${file}`;
    const source = await readFile(path, "utf8");
    for (const match of source.matchAll(/<([a-z][\w-]*)([^>]*\bdx\b[^>]*)>/g)) {
      const tag = match[0];
      const index = match.index || 0;
      assert.doesNotMatch(tag, /\btitle=/, `${path}: dx text must not own its tooltip`);

      const ownerWindow = source.slice(Math.max(0, index - 1600), index);
      assert.match(ownerWindow, /\btitle=/, `${path}: dx text must have a nearby owning tooltip element`);
    }
  }
});

test("production build contains only deployable three-file output when present", async (t) => {
  if (!existsSync("build")) {
    t.skip("build directory is created by ./build.sh");
    return;
  }

  const files = (await readdir("build")).sort();
  if (!files.length) {
    t.skip("build directory is empty until ./build.sh completes");
    return;
  }
  assert.deepEqual(files, ["index.html", "script.js", "style.css"]);

  for (const name of files) {
    assert.equal(name.endsWith(".map"), false, `${name} must not be a sourcemap`);
  }

  const index = await readFile("build/index.html", "utf8");
  assert.match(index, /script\.js\?v=/);
  assert.match(index, /style\.css\?v=/);
  assert.doesNotMatch(index, /font\/|assets\/|minerbox|web_miner|script_min|style_min/);

  const script = await readFile("build/script.js");
  const css = await readFile("build/style.css");
  assert.match(script.toString("utf8"), /startApp|Auto refresh on|hashchange/, "production bundle must include app startup path");
  assert.doesNotMatch(script.toString("utf8"), /support@moneroocean\.stream/, "support email must stay obfuscated");
  assert.ok(script.byteLength + css.byteLength + Buffer.byteLength(index) <= 100_000, "deployable raw budget exceeded");
  assert.ok(gzipSync(script).byteLength < 180_000, "script gzip budget exceeded");
  assert.ok(gzipSync(css).byteLength < 45_000, "css gzip budget exceeded");

  for (const name of files) {
    assert.ok((await stat(`build/${name}`)).size > 0, `${name} is empty`);
  }
});

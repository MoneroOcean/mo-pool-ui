import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "resource-guard-"));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "bin"));
  mkdirSync(join(root, "working"));
  const runner = join(root, "scripts/run-memory-limited.sh");
  copyFileSync(new URL("../scripts/run-memory-limited.sh", import.meta.url), runner);
  const env = { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}` };
  delete env.RESOURCE_GUARD_CGROUP;
  delete env.RESOURCE_GUARD_PENDING;
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, runner, env, cwd: join(root, "working") };
}

function tool(f, name, body) {
  writeFileSync(join(f.root, "bin", name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
}

function run(f, args, env = {}) {
  const result = spawnSync("bash", [f.runner, ...args], {
    cwd: f.cwd, env: { ...f.env, ...env }, encoding: "utf8", timeout: 15000
  });
  assert.ifError(result.error);
  return result;
}

function requireScope(t, f) {
  if (process.platform !== "linux") {
    t.skip("hard cgroup limits apply on Linux");
    return false;
  }
  const args = [
    ...(process.getuid() === 0 ? [] : ["--user"]), "--scope", "--quiet",
    "-p", "MemoryMax=2G", "-p", "MemorySwapMax=0", "-p", "OOMPolicy=kill", "true"
  ];
  const probe = spawnSync("systemd-run", args, { env: f.env, encoding: "utf8", timeout: 10000 });
  if (probe.error || probe.status !== 0) {
    t.skip("systemd memory scopes are unavailable; fail-closed behavior is tested separately");
    return false;
  }
  const result = run(f, ["true"]);
  assert.equal(result.status, 0, result.stderr);
  return true;
}

test.describe("memory resource guard", { concurrency: false }, () => {
  test("a failed scope launch never falls back to running the command", (t) => {
    if (process.platform !== "linux") return t.skip("Linux enforcement");
    if (!existsSync("/sys/fs/cgroup/cgroup.controllers")) return t.skip("scope launch requires cgroup v2");
    const f = fixture(t);
    const capture = join(f.root, "arguments");
    tool(f, "systemd-run", 'printf "%s\\n" "$@" > "$CAPTURE"; exit 71');
    const result = run(f, ["touch", join(f.root, "executed")], { CAPTURE: capture });
    assert.equal(result.status, 71);
    assert.equal(existsSync(join(f.root, "executed")), false);
    const args = readFileSync(capture, "utf8").split("\n");
    for (const property of ["MemoryMax=2G", "MemorySwapMax=0", "OOMPolicy=kill"]) {
      assert.ok(args.includes(property), `${property} must be requested`);
    }
  });

  test("environment markers alone cannot bypass enforcement", (t) => {
    if (process.platform !== "linux") return t.skip("Linux enforcement");
    const f = fixture(t);
    for (const env of [{ RESOURCE_GUARD_CGROUP: "/invalid.scope" }, { RESOURCE_GUARD_PENDING: "1" }]) {
      const result = run(f, ["touch", join(f.root, "executed")], env);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Resource guard:/);
      assert.equal(existsSync(join(f.root, "executed")), false);
    }
  });

  test("non-Linux invocation preserves arguments and exit status", (t) => {
    const f = fixture(t);
    tool(f, "uname", "printf 'Darwin\\n'");
    const result = run(f, ["bash", "-c", 'printf "%s\\n" "$@"; exit 23', "--", "one two", "literal*", "$(literal)"]);
    assert.equal(result.status, 23);
    assert.equal(result.stdout, "one two\nliteral*\n$(literal)\n");
    assert.match(result.stderr, /hard memory cap is unavailable/);
  });

  test("a real scope enforces hard limits and preserves command context", (t) => {
    const f = fixture(t);
    if (!requireScope(t, f)) return;
    const code = `
      const fs = require('node:fs');
      const group = process.env.RESOURCE_GUARD_CGROUP;
      const dir = '/sys/fs/cgroup' + group;
      console.log(JSON.stringify({ args: process.argv.slice(1), cwd: process.cwd(),
        env: process.env.GUARD_TEST_VALUE, node: process.env.NODE_OPTIONS,
        max: fs.readFileSync(dir + '/memory.max', 'utf8').trim(),
        swap: fs.readFileSync(dir + '/memory.swap.max', 'utf8').trim(),
        oom: fs.readFileSync(dir + '/memory.oom.group', 'utf8').trim() }));
      process.exit(23);
    `;
    const result = run(f, [process.execPath, "-e", code, "one two", "literal*", "$(literal)"], {
      GUARD_TEST_VALUE: "preserved", NODE_OPTIONS: "--max-old-space-size=4096"
    });
    assert.equal(result.status, 23, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.deepEqual(data.args, ["one two", "literal*", "$(literal)"]);
    assert.equal(data.cwd, f.cwd);
    assert.equal(data.env, "preserved");
    assert.equal(data.node, "--max-old-space-size=4096 --max-old-space-size=512");
    assert.ok(Number(data.max) > 0 && Number(data.max) <= 2147483648);
    assert.equal(data.swap, "0");
    assert.equal(data.oom, "1");
  });

  test("nested Node children reuse the boundary after closing extra descriptors", (t) => {
    const f = fixture(t);
    if (!requireScope(t, f)) return;
    const code = `
      const { spawnSync } = require('node:child_process');
      const result = spawnSync('bash', [process.argv[1], 'bash', '-c',
        'printf "%s\\n" "$RESOURCE_GUARD_CGROUP"; exit 17'], { encoding: 'utf8' });
      if (result.stdout.trim() !== process.env.RESOURCE_GUARD_CGROUP) process.exit(90);
      process.stderr.write(result.stderr);
      process.exit(result.status);
    `;
    const result = run(f, [process.execPath, "-e", code, f.runner]);
    assert.equal(result.status, 17, result.stderr);
  });

  test("sourced entrypoints reenter once and return to their body", (t) => {
    const f = fixture(t);
    if (!requireScope(t, f)) return;
    const entry = join(f.root, "entry.sh");
    writeFileSync(entry, '#!/usr/bin/env bash\nsource "$(dirname "$0")/scripts/run-memory-limited.sh"\nprintf "%s\\n" "$1" "$RESOURCE_GUARD_CGROUP"\nexit 19\n');
    const result = spawnSync("bash", [entry, "preserved argument"], {
      cwd: f.cwd, env: f.env, encoding: "utf8", timeout: 15000
    });
    assert.ifError(result.error);
    assert.equal(result.status, 19, result.stderr);
    assert.match(result.stdout, /^preserved argument\n\//);
  });

  test("a second outer run fails immediately while the repository lock is held", async (t) => {
    const f = fixture(t);
    if (!requireScope(t, f)) return;
    const release = join(f.root, "release");
    const code = `
      const fs = require('node:fs');
      console.log('ready');
      const timer = setInterval(() => { if (fs.existsSync(process.argv[1])) process.exit(0); }, 25);
      setTimeout(() => { clearInterval(timer); process.exit(99); }, 10000);
    `;
    const child = spawn("bash", [f.runner, process.execPath, "-e", code, release], {
      cwd: f.cwd, env: f.env, stdio: ["ignore", "pipe", "pipe"]
    });
    const completion = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (status) => resolve(status));
    });
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("guarded command did not become ready")), 5000);
        child.stdout.once("data", () => { clearTimeout(timeout); resolve(); });
        child.once("error", (error) => { clearTimeout(timeout); reject(error); });
      });
      const result = run(f, ["touch", join(f.root, "executed")]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /already running/);
      assert.equal(existsSync(join(f.root, "executed")), false);
    } finally {
      writeFileSync(release, "");
      assert.equal(await completion, 0);
    }
  });
});

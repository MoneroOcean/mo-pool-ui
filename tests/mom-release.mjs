import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";

const RELEASE_ROOT_ENV = "MOM_TEST_RELEASE_ROOT";
const RELEASE_VERSION_ENV = "MOM_TEST_RELEASE_VERSION";
const LAUNCH_TIMEOUT_MS = 5000;
const MAX_LAUNCH_OUTPUT_BYTES = 256 * 1024;

function quoteWindowsCmdPath(value) {
  // cmd.exe expands percent expressions and cannot preserve control characters in a path.
  // eslint-disable-next-line no-control-regex -- intentional path-safety validation
  if (/["%\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Windows cmd.exe cannot safely preserve the launcher path");
  }
  if (!/[\s&|<>()^]/.test(value)) return value;
  return `"${value.replace(/(\\+)$/, "$1$1")}"`;
}

function windowsLauncherInvocation(launcherPath, command = process.env.ComSpec || "cmd.exe") {
  return {
    file: command,
    args: ["/d", "/v:off", "/s", "/c", `"${quoteWindowsCmdPath(launcherPath)}"`],
    windowsVerbatimArguments: true
  };
}

function runLauncher(invocation, releaseRoot) {
  return new Promise((resolve, reject) => {
    execFile(invocation.file, invocation.args, {
      cwd: releaseRoot,
      env: { ...process.env, MOM_GPU_BACKEND: "none", MOM_COMMAND: "./mom" },
      timeout: LAUNCH_TIMEOUT_MS,
      maxBuffer: MAX_LAUNCH_OUTPUT_BYTES,
      windowsHide: true,
      windowsVerbatimArguments: invocation.windowsVerbatimArguments
    }, (error, stdout, stderr) => {
      if (error && (error.killed || error.signal || error.code === "ETIMEDOUT"
        || error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")) {
        reject(error);
        return;
      }
      if (error && typeof error.code !== "number") {
        reject(error);
        return;
      }
      resolve({
        code: error?.code ?? 0,
        signal: error?.signal ?? null,
        stdout,
        stderr
      });
    });
  });
}

test.describe("MoM release consumer", { concurrency: false }, () => {
  test("Windows launcher paths quote ordinary spaces and ampersands safely", () => {
    const pathWithShellCharacters = String.raw`C:\release dir & punctuation\mom.cmd`;
    const invocation = windowsLauncherInvocation(pathWithShellCharacters, "cmd.exe");
    assert.deepEqual(invocation.args, [
      "/d",
      "/v:off",
      "/s",
      "/c",
      `""${pathWithShellCharacters}""`
    ]);
    for (const invalidPath of [
      String.raw`C:\release"quote\mom.cmd`,
      String.raw`C:\release%PATH%\mom.cmd`,
      "C:\\release\nmom.cmd",
      "C:\\release\u0000mom.cmd"
    ]) {
      assert.throws(() => windowsLauncherInvocation(invalidPath, "cmd.exe"), /cannot safely preserve/);
    }
  });

  test("the explicitly supplied release has a working no-argument launcher", async (t) => {
    const configuredRoot = process.env[RELEASE_ROOT_ENV];
    if (!configuredRoot) {
      t.skip(`${RELEASE_ROOT_ENV} is not set`);
      return;
    }

    const releaseRoot = path.resolve(configuredRoot);
    const packagePath = path.join(releaseRoot, "package.json");
    const launcherPath = path.join(releaseRoot, process.platform === "win32" ? "mom.cmd" : "mom");
    const packageData = JSON.parse(await readFile(packagePath, "utf8"));
    const version = packageData?.version;

    assert.equal(typeof version, "string", `${packagePath} must contain a string version`);
    assert.match(version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, `${packagePath} has an invalid version`);
    const expectedVersion = process.env[RELEASE_VERSION_ENV];
    if (expectedVersion) assert.equal(version, expectedVersion, "release package version mismatch");

    const launcherStat = await stat(launcherPath);
    assert.equal(launcherStat.isFile(), true, `${launcherPath} must be a file`);
    if (process.platform !== "win32") await access(launcherPath, constants.X_OK);

    const invocation = process.platform === "win32"
      ? windowsLauncherInvocation(launcherPath)
      : { file: launcherPath, args: [], windowsVerbatimArguments: false };
    const result = await runLauncher(invocation, releaseRoot);

    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.signal, null, output);
    assert.equal(result.code, 1, `no-argument help must exit intentionally with status 1:\n${output}`);
    assert.match(output, new RegExp(`Node\\.js/SYCL based CPU/GPU miner v${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(output, /No directive specified/);
    assert.match(output, /Directives:/);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { BLOCK_SHARE_DUMP_BASE, COIN_EXPLORERS, COIN_HASH_EXPLORERS, COIN_HEIGHT_EXPLORERS, DONATION_XMR, EXPLANATIONS } from "../src/constants.js";
import { effortPercent } from "../src/pool.js";
import { SETUP_GPU_VENDORS, setupAddress, setupAlgoOptions, setupConfiguredPorts, setupGpuMinerOptions, setupHashrateDefaults, setupHashrateToHps, setupPlan, setupProfileOptions } from "../src/setup.js";
import { endpointKey } from "../src/api.js";
import { summarizeUptimeRobot, uptimeToneClass, UNKNOWN_UPTIME } from "../src/uptime.js";
import { sortWorkerRows, trackWalletState, workerSortDirection, workerSortMode } from "../src/wallet.js";
import { formatPayoutThresholdInput, normalizePayoutPolicy, normalizePayoutThreshold, payoutFeeEstimate, payoutFeeText, payoutPolicyFromConfig, payoutThresholdFromAtomic, validatePayoutThreshold } from "../src/settings.js";
import { walletWorkersSection } from "../src/views/wallet.js";
import { explorerHeightLink } from "../src/views/common.js";
import { referencePortList, referencePortSummary } from "../src/views/help.js";

const TEST_POLICY = payoutPolicyFromConfig({
  payout_policy: {
    minimumThreshold: 0.003,
    defaultThreshold: 0.3,
    denomination: 0.0001,
    feeFormula: { maxFee: 0.0004, zeroFeeThreshold: 4 }
  }
});

const TEST_PORTS = setupConfiguredPorts({
  configured: [
    { port: 10002, tlsPort: 20002, difficulty: 20_000, targetHashrate: 700, description: "Small CPU" },
    { port: 10008, tlsPort: 20008, difficulty: 80_000, targetHashrate: 2500, description: "Desktop CPU" },
    { port: 10016, tlsPort: 20016, difficulty: 160_000, targetHashrate: 5000, description: "Fast CPU" },
    { port: 18192, tlsPort: 28192, difficulty: 81_920_000, targetHashrate: 1_000_000, description: "Proxy/farm" }
  ]
});

function setupPlanWithPorts(options = {}) {
  return setupPlan({ ...options, ports: options.ports || TEST_PORTS });
}

function setupCommandWithPorts(options = {}) {
  return setupPlanWithPorts(options).plainRunCommand;
}

function runReleaseSelector(metadata, { os = "linux", profile = "xmrig-mo", expectedUrl = "", pretty = false, httpExit = 0, gpu, miner, algo, selectorIndex = 0, architectureAsset = "" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "ui-release-selector-"));
  try {
    const fixture = join(root, "release.json"), capture = join(root, "download.args");
    writeFileSync(fixture, typeof metadata === "string" ? metadata : JSON.stringify(metadata, null, pretty ? 2 : undefined));
    writeFileSync(join(root, "curl"), '#!/bin/bash\nif [[ "$1" == -fsSL ]]; then /bin/cat "$RELEASE_FIXTURE"; exit "$FIXTURE_HTTP_EXIT"; fi\nprintf "%s\\n" "$@" > "$DOWNLOAD_CAPTURE"\n', { mode: 0o700 });
    const command = setupPlanWithPorts({ os, profile, gpu, miner, algo }).downloadCommand;
    const lines = command.split("\n");
    const first = lines.indexOf("download_release() {");
    const last = lines.findIndex((line, index) => index > first && line === "}");
    const call = lines.filter(line => line.startsWith("download_release "))[selectorIndex];
    assert.ok(first >= 0 && last > first && call, "bind the actual shared helper and selected release call");
    const script = `${lines.slice(first, last + 1).join("\n")}\n${call.split(" &&")[0]}`;
    const result = spawnSync("bash", ["-c", script], { cwd: root, encoding: "utf8", timeout: 5000,
      env: { ...process.env, PATH: `${root}:${process.env.PATH}`, RELEASE_FIXTURE: fixture, DOWNLOAD_CAPTURE: capture, FIXTURE_HTTP_EXIT: String(httpExit), asset: architectureAsset || (os === "macos" ? "mac\\.tar\\.gz$" : "") } });
    const args = existsSync(capture) ? readFileSync(capture, "utf8").trim().split("\n") : [];
    assert.equal(result.stdout, "", "release selection must not emit its URL on stdout");
    if (args.length) {
      assert.equal(args.length, 5);
      assert.deepEqual([args[0], args[1], args[3]], ["-fL", "-o", "--"]);
    }
    return { exit: result.status, downloaded: args.length > 0, selectedExpected: args.includes(expectedUrl), output: result.stderr, unsafeMarkerCreated: existsSync(join(root, "unsafe-marker")) };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test("release selector parses compact and pretty JSON with deterministic XMRig compatibility", { skip: process.platform === "win32" }, () => {
  const prefix = "https://github.com/MoneroOcean/xmrig/releases/download/v1/";
  const compat = { name: "xmrig-v1-lin-compat.tar.gz", browser_download_url: `${prefix}xmrig-v1-lin-compat.tar.gz` };
  const normal = { name: "xmrig-v1-lin.tar.gz", browser_download_url: `${prefix}xmrig-v1-lin.tar.gz` };
  for (const pretty of [false, true]) for (const assets of [[normal, compat], [compat, normal]]) {
    const result = runReleaseSelector({ url: "https://api.github.com/decoy/lin.tar.gz", assets }, { expectedUrl: compat.browser_download_url, pretty });
    assert.equal(result.exit, 0, result.output); assert.equal(result.selectedExpected, true);
  }
});

test("release selector rejects missing, malformed, unsafe and out-of-scope assets", { skip: process.platform === "win32" }, () => {
  const name = "xmrig-v1-lin-compat.tar.gz", prefix = "https://github.com/MoneroOcean/xmrig/releases/download/v1/";
  for (const metadata of [{}, { assets: null }, { assets: {} }, { assets: [] }, { assets: [{ name, browser_download_url: 1 }] },
    { assets: [{ name, browser_download_url: `http://github.com/MoneroOcean/xmrig/releases/download/v1/${name}` }] },
    { assets: [{ name, browser_download_url: `https://github.com/other/xmrig/releases/download/v1/${name}` }] },
    { assets: [{ name, browser_download_url: `${prefix}$(touch unsafe-marker)` }] },
    { assets: [{ name, browser_download_url: `${prefix}${name}\n-o attacker` }] }, "{invalid"]) {
    const result = runReleaseSelector(metadata);
    assert.notEqual(result.exit, 0); assert.equal(result.downloaded, false); assert.equal(result.unsafeMarkerCreated, false);
  }
});

test("release selector does not hide HTTP failure behind otherwise valid metadata", { skip: process.platform === "win32" }, () => {
  const name = "xmrig-v1-lin-compat.tar.gz";
  const result = runReleaseSelector({ assets: [{ name, browser_download_url: `https://github.com/MoneroOcean/xmrig/releases/download/v1/${name}` }] }, { httpExit: 22 });
  assert.notEqual(result.exit, 0); assert.equal(result.downloaded, false);
});

test("release selector supports declared macOS jq and architecture-specific assets", { skip: process.platform === "win32" }, () => {
  for (const profile of ["xmrig-mo", "xmrig-proxy"]) {
    const repo = profile === "xmrig-mo" ? "xmrig" : "xmrig-proxy", name = `${repo}-v1-mac.tar.gz`;
    const url = `https://github.com/MoneroOcean/${repo}/releases/download/v1/${name}`;
    const plan = setupPlanWithPorts({ os: "macos", profile });
    assert.match(plan.downloadCommand, /^brew install jq\n/);
    const result = runReleaseSelector({ assets: [{ name, browser_download_url: url }] }, { os: "macos", profile, expectedUrl: url });
    assert.equal(result.exit, 0, result.output); assert.equal(result.selectedExpected, true);
  }
});

test("generated Linux release selectors cover every miner and Multi-Miner child", { skip: process.platform === "win32" }, () => {
  const gpu = "nvidia", profile = "srb-gpu", algo = "c29";
  const cases = [
    { profile, gpu, algo: "kawpow", miner: "srbminer", repo: "doktor83/SRBMiner-Multi", name: "SRBMiner-Multi-3.7.3-Linux.tar.xz" },
    { profile, gpu, algo, miner: "bzminer", repo: "bzminer/bzminer", name: "bzminer_v100_linux.tar.gz" },
    { profile, gpu, algo, miner: "lolminer", repo: "Lolliedieb/lolMiner-releases", name: "lolMiner_v1.98a_Lin64.tar.gz" },
    { profile, gpu, algo, miner: "mom", repo: "MoneroOcean/mo-miner", name: "mom-v1-lin.tgz" },
    { profile: "multi-miner", gpu, repo: "MoneroOcean/multi-miner", name: "mm-v1-lin.tar.gz", architectureAsset: "mm-v.*-lin\\.tar\\.gz" },
    { profile: "multi-miner", gpu, repo: "MoneroOcean/multi-miner", name: "mm-v1-lin-arm.tar.gz", architectureAsset: "mm-v.*-lin-arm\\.tar\\.gz" },
    { profile: "multi-miner", gpu, selectorIndex: 1, repo: "doktor83/SRBMiner-Multi", name: "SRBMiner-Multi-3.7.3-Linux.tar.gz" },
    { profile: "multi-miner", gpu, selectorIndex: 2, repo: "Lolliedieb/lolMiner-releases", name: "lolMiner_v1.98a_Lin64.tar.gz" },
    { profile: "xmrig-mo", repo: "MoneroOcean/xmrig", name: "xmrig-v1-lin-compat.tar.gz" },
    { profile: "xmrig-proxy", repo: "MoneroOcean/xmrig-proxy", name: "xmrig-proxy-v1-lin.tar.gz" }
  ];
  for (const options of cases) {
    const url = `https://github.com/${options.repo}/releases/download/v1/${options.name}`;
    for (const pretty of [false, true]) {
      const result = runReleaseSelector({ url: "https://api.github.com/decoy", assets: [
        { name: "wrong-architecture-mac.tar.gz", browser_download_url: url },
        { name: options.name, browser_download_url: url }
      ] }, { ...options, expectedUrl: url, pretty });
      assert.equal(result.exit, 0, `${options.repo}: ${result.output}`);
      assert.equal(result.selectedExpected, true);
    }
    for (const metadata of ["{invalid", { assets: [] }, { assets: "wrong-type" }, { assets: [{ name: "wrong-architecture-mac.tar.gz", browser_download_url: url }] }]) {
      const result = runReleaseSelector(metadata, options);
      assert.notEqual(result.exit, 0, options.repo);
      assert.equal(result.downloaded, false);
    }
  }
});

test("Linux SRBMiner downloads declare wget without changing other miner prerequisites", () => {
  for (const gpu of ["intel", "amd", "nvidia"]) {
    const direct = setupPlanWithPorts({ os: "linux", profile: "srb-gpu", gpu, miner: "srbminer", algo: "kawpow" });
    assert.match(direct.downloadCommand, /^sudo apt-get install curl jq wget\n/);
    const multi = setupPlanWithPorts({ os: "linux", profile: "multi-miner", gpu });
    assert.match(multi.downloadCommand, /^sudo apt-get install -y curl jq wget\n/);
    assert.equal((multi.downloadCommand.match(/sudo apt-get install/g) || []).length, 1);
  }
  for (const options of [
    { profile: "xmrig-mo" },
    { profile: "xmrig-proxy" },
    { profile: "srb-gpu", gpu: "nvidia", miner: "lolminer", algo: "c29" },
    { profile: "srb-gpu", gpu: "nvidia", miner: "bzminer", algo: "c29" }
  ]) {
    const plan = setupPlanWithPorts({ os: "linux", ...options });
    assert.match(plan.downloadCommand, /^sudo apt-get install curl jq\n/);
    assert.doesNotMatch(plan.downloadCommand, /\bwget\b/);
  }
});

test("Windows AMD recommendations preserve qualified Ergo and C29 alternatives", () => {
  for (const [algo, excluded, expected] of [
    ["autolykos2", "bzminer", ["srbminer", "mom"]],
    ["c29", "lolminer", ["bzminer", "mom"]]
  ]) {
    const plan = setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "amd", algo, miner: excluded });
    assert.deepEqual(plan.minerOptions.map(([id]) => id), expected);
    assert.equal(plan.selection.miner, expected[0], "stale selection falls back safely");
    assert.match(plan.notes, /tested RX 9060 XT\/gfx1200/);
    assert.match(plan.notes, /Other AMD models are not established/);
    assert.doesNotMatch(plan.downloadCommand, excluded === "bzminer" ? /bzminer\/bzminer/ : /Lolliedieb\/lolMiner/);
    for (const miner of expected) {
      assert.equal(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "amd", algo, miner }).selection.miner, miner);
    }
  }
});

test("Windows AMD Multi-Miner preserves C29 with BZ and other algorithms with SRB", () => {
  const plan = setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "amd" });
  assert.match(plan.downloadCommand, /bzminer\/bzminer/);
  assert.match(plan.downloadCommand, /Expand-MinerArchive 'bzminer.zip' 'bzminer.exe'/);
  assert.match(plan.downloadCommand, /doktor83\/SRBMiner-Multi/);
  assert.doesNotMatch(plan.downloadCommand, /Lolliedieb|lolMiner|lolminer/);
  assert.match(plan.tlsRunCommand, /\$Bzminer="\.\\bzminer.exe"/);
  assert.match(plan.tlsRunCommand, /--c29="\$Bzminer -a c29 -p stratum\+tcp:\/\/127\.0\.0\.1:3333 -w \$Wallet --pass mm --cpu 0"/);
  assert.doesNotMatch(plan.tlsRunCommand, /\$Lolminer|--algo CR29|\$Bzminer -a (?:ergo|cn\/gpu)/);
  for (const [algo, srbAlgo] of [["cn/gpu", "cryptonight_gpu"], ["autolykos2", "autolykos2"],
    ["kawpow", "kawpow"], ["etchash", "etchash"], ["pearlhash", "pearlhash"]]) {
    assert.ok(plan.tlsRunCommand.includes(`--${algo}="$Srbminer --algorithm ${srbAlgo} --password x`));
  }
});

test("GPU setup retains the published Intel identifier with its simplified label", () => {
  assert.deepEqual(SETUP_GPU_VENDORS, [["intel", "Intel"], ["nvidia", "NVIDIA"], ["amd", "AMD"]]);
  for (const os of ["linux", "windows"]) {
    const intel = setupPlanWithPorts({ profile: "srb-gpu", os, gpu: "intel", algo: "kawpow" });
    assert.equal(intel.selection.gpu, "intel");
    assert.equal(intel.selection.miner, "mom");
    const oldAmbiguous = setupPlanWithPorts({ profile: "srb-gpu", os, gpu: "gpu" });
    assert.equal(oldAmbiguous.selection.gpu, "gpu");
    const unpublished = setupPlanWithPorts({ profile: "srb-gpu", os, gpu: "intel-dgpu" });
    assert.equal(unpublished.selection.gpu, "gpu", "unpublished identifiers use normal unknown-GPU fallback");
    for (const gpu of ["intel", "nvidia", "amd", "gpu"]) {
      for (const profile of ["srb-gpu", "multi-miner"]) {
        const plan = setupPlanWithPorts({ profile, os, gpu });
        assert.doesNotMatch([plan.plainRunCommand, plan.tlsRunCommand, plan.notes].join("\n"), /--enable-igpu|UHD 750|Intel iGPU/);
      }
    }
  }
});

function assertPackageInstallFirst(command, label) {
  if (!/(?:sudo apt-get install|brew install)/.test(command)) return;
  assert.match(command, /^(?:sudo apt-get install|brew install)/, label);
}

function setupRunCommands(plan) {
  return ["tlsRunCommand", "plainRunCommand", "torCommand", "localCommand"]
    .map((key) => plan[key] || "")
    .filter(Boolean)
    .join("\n");
}

test("GPU auto switching offers MoM first for every vendor without changing the Multi-Miner default", () => {
  for (const os of ["linux", "windows"]) for (const gpu of ["intel", "amd", "nvidia"]) {
    const expected = ["mom", "multi-miner"];
    for (const miner of [undefined, "", "invalid", "srbminer", "multi-miner", "mom"]) {
      const plan = setupPlanWithPorts({ profile: "multi-miner", os, gpu, miner });
      assert.deepEqual(plan.minerOptions.map(([id]) => id), expected, `${os}/${gpu}/${miner}`);
      assert.equal(plan.selection.profile, "multi-miner");
      assert.equal(plan.selection.algo, "auto");
      assert.equal(plan.selection.miner, miner === "mom" ? "mom" : "multi-miner");
    }
  }
});

test("explicit GPU auto MoM reuses its installer and switches directly without algorithm restrictions", () => {
  for (const os of ["linux", "windows"]) for (const gpu of ["intel", "amd", "nvidia"]) {
    const options = { os, gpu, miner: "mom", address: DONATION_XMR, worker: "fixture" };
    const plan = setupPlanWithPorts({ ...options, profile: "multi-miner", algo: "pearlhash" });
    const fixed = setupPlanWithPorts({ ...options, profile: "srb-gpu", algo: "c29" });
    assert.equal(plan.downloadCommand, fixed.downloadCommand, `${os}/${gpu}/installer`);
    assert.equal(plan.downloadNote, fixed.downloadNote);
    assert.match(plan.downloadCommand, /(?:download_release MoneroOcean\/mo-miner |MoneroOcean\/mo-miner\/releases\/latest)/);
    assert.match(plan.downloadCommand, os === "windows" ? /\.\\install\.bat/ : /sudo \.\/install\.sh/);
    assert.doesNotMatch(plan.downloadCommand, /multi-miner|SRBMiner|lolMiner|bzminer/);
    for (const [command, tls] of [[plan.plainRunCommand, false], [plan.tlsRunCommand, true]]) {
      assert.ok(command.length > 0, `${os}/${gpu}/direct command`);
      const lines = command.split("\n");
      assert.equal(lines.length, 2, "write one config, then launch directly");
      const configMatch = lines[0].match(os === "windows"
        ? /^'([^']+)' \| Set-Content -Encoding ascii gpu-auto\.json$/
        : /^printf '%s\\n' '([^']+)' > gpu-auto\.json &&$/);
      assert.ok(configMatch, `${os}/${gpu}/JSON writer`);
      const config = JSON.parse(configMatch[1]);
      assert.deepEqual(config, {
        pools: [
          { url: "mom.moneroocean.stream", port: 20001, is_tls: true, login: "user", use_subscribe: false },
          { url: "gulf.moneroocean.stream", port: tls ? TEST_PORTS.find(row => row.port === plan.selection.port).tlsPort : plan.selection.port,
            is_tls: tls, login: DONATION_XMR, pass: "fixture", use_subscribe: false }
        ],
        pool_ids: { primary: 1, donate: 0 },
        algo_params: Object.fromEntries(["ghostrider", "panthera", "rx/0", "rx/arq", "rx/2"].map(algo => [algo, { perf: 0 }]))
      }, `${os}/${gpu}/${tls ? "tls" : "plain"}/GPU-only switching config`);
      assert.equal(lines[1], os === "windows"
        ? `if ($?) { $env:MOM_GPU_BACKEND='${gpu}'; & .\\mom.cmd mine gpu-auto.json }`
        : `MOM_GPU_BACKEND=${gpu} ./mom mine gpu-auto.json`);
      assert.doesNotMatch(command, /~|--job\.(?:algo|dev)|--bench_algo_params|"(?:job|dev|bench_algo_params)"|gpu\d|--(?:cn\/gpu|kawpow|autolykos2|etchash|pearlhash|c29)=|\.\/mm|\.\\mm\.exe/);
    }
  }
});

test("Linux auto MoM launches a stub only after its config write succeeds", { skip: process.platform === "win32" }, () => {
  for (const gpu of ["intel", "amd", "nvidia"]) for (const tls of [false, true]) {
    const plan = setupPlanWithPorts({ profile: "multi-miner", os: "linux", gpu, miner: "mom" });
    const command = tls ? plan.tlsRunCommand : plan.plainRunCommand;
    const root = mkdtempSync(join(tmpdir(), "ui-mom-config-write-"));
    try {
      for (const failWrite of [false, true]) {
        const cwd = join(root, failWrite ? "failure" : "success");
        mkdirSync(cwd);
        writeFileSync(join(cwd, "mom"), '#!/bin/bash\nprintf "%s\\n" "$MOM_GPU_BACKEND" "$@" > invoked\n', { mode: 0o700 });
        if (failWrite) mkdirSync(join(cwd, "gpu-auto.json"));
        const result = spawnSync("bash", ["-c", command], { cwd, encoding: "utf8", timeout: 5000 });
        const invoked = join(cwd, "invoked");
        if (failWrite) {
          assert.notEqual(result.status, 0, `${gpu}/${tls}/failed write`);
          assert.equal(existsSync(invoked), false, "failed writer must not launch even the stub");
        } else {
          assert.equal(result.status, 0, `${gpu}/${tls}/successful write`);
          const written = readFileSync(join(cwd, "gpu-auto.json"), "utf8");
          assert.equal(written.endsWith("\n"), true);
          assert.deepEqual(JSON.parse(written), JSON.parse(command.match(/'(\{[^\n]+\})'/)[1]));
          assert.equal(readFileSync(invoked, "utf8"), `${gpu}\nmine\ngpu-auto.json\n`, "stub receives only the config and allowlisted vendor");
        }
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test("explicit auto MoM fails closed for ambiguous or untrusted GPU input", () => {
  for (const os of ["linux", "windows"]) for (const gpu of ["", "gpu", "intel-dgpu", "nvidia-amd", "intel; touch unsafe-marker", "$(touch unsafe-marker)"]) {
    const plan = setupPlanWithPorts({ profile: "multi-miner", os, gpu, miner: "mom" });
    assert.equal(plan.selection.miner, "mom");
    assert.equal(setupRunCommands(plan), "", `${os}/${gpu}/no mining command`);
    assert.match(plan.notes, /Select a GPU vendor\./);
    assert.doesNotMatch(plan.downloadCommand + plan.notes, /unsafe-marker|touch/);
  }
});

test("Multi-Miner SRBMiner variable simplification preserves expanded child commands", () => {
  const algorithms = { "cn/gpu": "cryptonight_gpu", kawpow: "kawpow", autolykos2: "autolykos2", etchash: "etchash", pearlhash: "pearlhash" };
  for (const os of ["linux", "windows"]) for (const gpu of ["intel", "amd", "nvidia", "gpu"]) {
    const plan = setupPlanWithPorts({ profile: "multi-miner", os, gpu, miner: "multi-miner" });
    const command = plan.tlsRunCommand;
    const windows = os === "windows";
    const variable = windows ? "$Srbminer" : "$SRBMINER";
    const assignment = command.split("\n").find(line => line.startsWith(`${windows ? "$" : ""}${windows ? "Srbminer" : "SRBMINER"}=`));
    assert.ok(assignment, `${os}/${gpu}/combined variable`);
    assert.doesNotMatch(command, /^(?:SRB=|COMMON=|\$Srb=|\$Common=)/m);
    const common = assignment.slice(assignment.indexOf('="') + 2, -1)
      .replace(/\$(?:LOCAL_PROXY|LocalProxy)/g, "127.0.0.1:3333")
      .replace(/\$(?:WALLET|Wallet)/g, "WALLET")
      .replace(/\$(?:GPU_FLAGS|GpuFlags)/g, "--disable-gpu-amd --disable-gpu-nvidia");
    const expectedCommon = `${windows ? ".\\SRBMiner-MULTI.exe" : "./SRBMiner-MULTI"} --disable-cpu${gpu === "intel" ? " --disable-gpu-amd --disable-gpu-nvidia" : ""} --pool 127.0.0.1:3333 --wallet WALLET --worker mm --gpu-id 0 --keepalive true --tls false`;
    assert.equal(common, expectedCommon, `${os}/${gpu}/common semantics`);
    const children = [...command.matchAll(/--([a-z0-9/]+)="([^"]+)"/g)].filter(([, , child]) => child.startsWith(variable));
    const expectedAlgos = Object.keys(algorithms).filter(algo => !(gpu === "intel" && algo === "pearlhash") && !(windows && gpu === "nvidia" && ["cn/gpu", "autolykos2", "etchash"].includes(algo)));
    assert.deepEqual(children.map(([, algo]) => algo).sort(), expectedAlgos.sort());
    for (const [, algo, child] of children) {
      const extra = algo === "etchash" ? " --esm 2 --nicehash true" : windows && gpu === "nvidia" && algo === "kawpow" ? " --gpu-table-slow-build" : "";
      assert.equal(child.replace(variable, common), `${expectedCommon} --algorithm ${algorithms[algo]} --password x${extra}`, `${os}/${gpu}/${algo}`);
    }
  }
});

test.describe("setup, settings, uptime, and copy", { concurrency: false }, () => {
  test("Unix download snippets share one readable release helper", () => {
    const options = [
      ...["linux", "macos"].flatMap(os => ["xmrig-mo", "xmrig-proxy"].map(profile => ({ os, profile }))),
      ...["mom", "bzminer", "srbminer", "lolminer"].map(miner => ({ os: "linux", profile: "srb-gpu", gpu: "nvidia", algo: miner === "srbminer" ? "kawpow" : "c29", miner })),
      ...["intel", "amd", "nvidia"].map(gpu => ({ os: "linux", profile: "multi-miner", gpu }))
    ];
    let sharedHelper = "";
    for (const args of options) {
      const command = setupPlanWithPorts(args).downloadCommand;
      const helpers = [...command.matchAll(/^download_release\(\) \{\n[\s\S]*?^\}/gm)];
      assert.equal(helpers.length, 1, `${args.os}/${args.profile}/${args.miner || args.gpu || ""}/one helper`);
      if (!sharedHelper) sharedHelper = helpers[0][0];
      assert.equal(helpers[0][0], sharedHelper, "all Unix recipes reuse the same validating download helper");
      assert.equal((command.match(/jq -er/g) || []).length, 1);
      if (args.profile === "multi-miner") {
        assert.ok(Math.max(...command.split("\n").map(line => line.length)) <= 140, "Multi-Miner download lines stay readable");
        const calls = command.split("\n").filter(line => line.startsWith("download_release "));
        assert.equal(calls.length, args.gpu === "intel" ? 2 : 3);
        assert.ok(calls.every(line => line.endsWith(" &&")), "download/extraction chains wrap at the call boundary");
        assert.match(calls[0], /^download_release MoneroOcean\/multi-miner "\$asset" /);
      }
    }
  });

  test("setup output and ports mapping include required miners and ports", () => {
    assert.equal(COIN_EXPLORERS[18081], "https://xmrchain.net");
    assert.equal(COIN_EXPLORERS[8645], "https://etc.blockscout.com");
    assert.match(explorerHeightLink(8645, 123).html, /href="https:\/\/etc\.blockscout\.com"/);
    assert.equal(COIN_HEIGHT_EXPLORERS[18081].replace("{height}", "123"), "https://xmrchain.net/block/123");
    assert.equal(COIN_HEIGHT_EXPLORERS[12211].replace("{height}", "1142193"), "https://explorer.ryo.tools/search?value=1142193");
    assert.equal(COIN_EXPLORERS[8766], "https://blockbook.ravencoin.org");
    assert.equal(COIN_HEIGHT_EXPLORERS[8766].replace("{height}", "4343926"), "https://blockbook.ravencoin.org/api/v2/block/4343926");
    assert.equal(COIN_HEIGHT_EXPLORERS[8645].replace("{height}", "24458492"), "https://etc.blockscout.com/block/24458492");
    assert.equal(COIN_HEIGHT_EXPLORERS[17767].replace("{height}", "764069"), "https://explorer.zephyrprotocol.com/block/764069");
    assert.equal(COIN_HASH_EXPLORERS[18081].replace("{hash}", "abc"), "https://xmrchain.net/block/abc");
    assert.equal(COIN_HASH_EXPLORERS[18144].replace("{hash}", "abc"), "https://explore.tari.com/blocks/abc");
    assert.equal(COIN_HASH_EXPLORERS[12211].replace("{hash}", "abc"), "https://explorer.ryo.tools/search?value=abc");
    assert.equal(COIN_HASH_EXPLORERS[8766].replace("{hash}", "abc"), "https://blockbook.ravencoin.org/api/v2/block/abc");
    assert.equal(COIN_HASH_EXPLORERS[8645].replace("{hash}", "abc"), "https://etc.blockscout.com/block/abc");
    assert.equal(COIN_HASH_EXPLORERS[10225].replace("{hash}", "abc"), "https://explorer.bitoreum.cc/block/abc");
    for (const port of Object.keys(COIN_EXPLORERS)) {
      assert.ok(COIN_HASH_EXPLORERS[port] || COIN_HASH_EXPLORERS[Number(port)], `missing block hash explorer for ${port}`);
    }
    for (const brokenPort of [10225, 17750, 19281, 19734, 19950, 25182, 38081, 48782]) {
      assert.equal(COIN_HEIGHT_EXPLORERS[brokenPort], undefined);
    }
    assert.equal(`${BLOCK_SHARE_DUMP_BASE}/abc.cvs.xz`, "https://block-share-dumps.moneroocean.stream/abc.cvs.xz");
    assert.equal(DONATION_XMR, "89TxfrUmqJJcb1V124WsUzA78Xa3UYHt7Bg8RGMhXVeZYPN8cE5CZEk58Y1m23ZMLHN7wYeJ9da5n5MXharEjrm41hSnWHL");
    assert.match(setupCommandWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }), /xmrig/);
    const xmrigLinux = setupPlanWithPorts({ profile: "xmrig-mo", os: "linux", address: "ADDR", worker: "rig" });
    assert.match(xmrigLinux.plainRunCommand, /--config=\.\/config\.json/);
    assert.match(xmrigLinux.tlsRunCommand, /--config=\.\/config\.json .*--tls/);
    assert.match(xmrigLinux.torCommand, /--config=\.\/config\.json/);
    assert.doesNotMatch(setupCommandWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }), /--coin monero/);
    assert.doesNotMatch(setupCommandWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }), / -p rig\b/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }).tlsRunCommand, /gulf\.moneroocean\.stream:20016 .*--tls/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo" }).tlsRunNote, /TLS encrypts/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux", address: "ADDR", worker: "rig" }).torCommand, /sudo apt-get install tor && sudo systemctl enable --now tor/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos", address: "ADDR", worker: "rig" }).torCommand, /brew install tor && brew services start tor/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).torNote, /onion host.*selected non-TLS port.*127\.0\.0\.1:9050.*127\.0\.0\.1:9150.*TLS adds no security over Tor/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux", address: "ADDR", worker: "rig" }).torCommand, /\.\/xmrig --config=\.\/config\.json -o mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id\.onion:10016 .* -u YOUR_XMR_ADDRESS --rig-id rig --keepalive/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos", address: "ADDR", worker: "rig" }).torCommand, /\.\/xmrig --config=\.\/config\.json -o mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id\.onion:10016 .* -u YOUR_XMR_ADDRESS --rig-id rig --keepalive/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).torCommand, /--coin monero| -p tor|YOUR_XMR_WALLET|9150|do not add --tls|First run may benchmark|setup-step -ltn|Use 127\.0\.0\.1:9050|:20128|--tls/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).notes, /Keep config\.json beside XMRig/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /sudo apt-get install curl/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /download_release MoneroOcean\/xmrig 'lin-compat\\\.tar\\\.gz\$' xmrig\.tar\.gz/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /sudo apt-get install curl jq/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /lin64/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /tar xf xmrig\.tar\.gz && chmod \+x xmrig/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /strip-components/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).downloadNote, /Open Windows PowerShell/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).downloadNote, /antivirus alerts; allow only the mining folder if you trust the release/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).downloadCommand, /Open Windows PowerShell/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).plainRunCommand, /Open Windows PowerShell/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).plainRunCommand, /^\.\\xmrig\.exe/m);
    const xmrigWindows = setupPlanWithPorts({ profile: "xmrig-mo", os: "windows", address: "ADDR", worker: "rig" });
    assert.match(xmrigWindows.plainRunCommand, /--config="\.\\config\.json"/);
    assert.match(xmrigWindows.tlsRunCommand, /--config="\.\\config\.json" .*--tls/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).downloadCommand, /win\\\.zip\$/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).downloadCommand, /win64/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "multi-miner", os: "windows" }).plainRunCommand || "", /Open Windows PowerShell/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /asset='mac\\\.tar\\\.gz\$'/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /x86_64\|amd64.*asset='mac-intel\\\.tar\\\.gz\$'/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /download_release MoneroOcean\/xmrig "\$asset" xmrig\.tar\.gz/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /mac64/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /xattr -d com\.apple\.quarantine xmrig/);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadNote, "");
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).notes, /selects the current Apple Silicon or Intel archive/);
    assert.equal(setupPlanWithPorts({ profile: "srb-gpu", os: "macos" }).selection.profile, "xmrig-mo");
    assert.equal(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "windows" }).selection.profile, "xmrig-mo");
    assert.equal(setupPlanWithPorts({ profile: "xmrig-fixed", algo: "etchash" }).selection.profile, "xmrig-mo");
    assert.equal(setupPlanWithPorts({ profile: "xmrig-fixed", algo: "etchash" }).selection.algo, "auto");
    assert.equal(setupHashrateToHps(4, "kh"), 4000);
    assert.match(setupPlanWithPorts({ profile: 'xmr-node-proxy' }).notes, /Node\.js 22\.9/);
    assert.match(setupPlanWithPorts({ profile: 'xmr-node-proxy' }).notes, /npm 11\.10/);
    const configuredPorts = setupConfiguredPorts({
      configured: [
        { port: null, tlsPort: 9000, difficulty: 1000, targetHashrate: 1000 / 30, description: "TLS only" },
        { port: 10002, tlsPort: 20002, difficulty: 20_000, targetHashrate: 700, description: "Small CPU" },
        { port: 10016, tlsPort: 20016, difficulty: 160_000, targetHashrate: 5000, description: "Fast CPU" }
      ]
    });
    assert.deepEqual(configuredPorts.map((row) => row.port), [10002, 10016]);
    assert.equal(setupPlan({ profile: "xmrig-mo", hashrate: 4, hashrateUnit: "kh", ports: configuredPorts }).selection.port, 10016);
    assert.match(setupPlan({ profile: "xmrig-mo", hashrate: 4, hashrateUnit: "kh", ports: configuredPorts }).summary, /Fast CPU/);
    const globalPorts = setupConfiguredPorts({
      global: [
        { port: 80, tls: false, difficulty: 10000, description: "1 kH/s" },
        { port: 443, tls: true, difficulty: 10000, description: "1 kH/s" },
        { port: 10001, tls: false, difficulty: 10000, description: "1 KH/s" },
        { port: 20001, tls: true, difficulty: 10000, description: "1 KH/s" },
        { port: 10002, tls: false, difficulty: 20000, description: "2 KH/s" },
        { port: 20002, tls: true, difficulty: 20000, description: "2 KH/s" },
        { port: 10128, tls: false, difficulty: 1280000, description: "128 KH/s" },
        { port: 20128, tls: true, difficulty: 1280000, description: "128 KH/s" }
      ]
    });
    assert.deepEqual(globalPorts.map((row) => [row.port, row.tlsPort, row.targetHashrate]), [[10001, 20001, 1000], [10002, 20002, 2000], [10128, 20128, 128000]]);
    assert.match(setupPlan({ profile: "srb-gpu", gpu: "intel", algo: "c29", ports: globalPorts }).plainRunCommand, /gulf\.moneroocean\.stream:10001 /);
    assert.match(setupPlan({ profile: "srb-gpu", gpu: "intel", algo: "c29", ports: globalPorts }).tlsRunCommand, /gulf\.moneroocean\.stream:20001tls /);
    assert.equal(setupPlan().selection.port, 0);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-mo" }).selection.port, 10016);
    assert.equal(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", address: "ADDR" }).selection.address, "ADDR");
    assert.equal(setupPlanWithPorts({ profile: "xmrig-mo", hashrate: 250, hashrateUnit: "h" }).selection.port, 10002);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy" }).selection.port, 18192);
    assert.deepEqual(setupHashrateDefaults("xmrig-proxy"), { value: 64, unit: "kh" });
    assert.deepEqual(setupHashrateDefaults("xmr-node-proxy"), { value: 128, unit: "kh" });
    assert.deepEqual(setupHashrateDefaults("srb-gpu", "intel"), { value: 128, unit: "kh" });
    assert.deepEqual(setupHashrateDefaults("srb-gpu", "intel", "c29"), { value: 1, unit: "h" });
    assert.deepEqual(setupHashrateDefaults("srb-gpu", "gpu", "c29"), { value: 1, unit: "h" });
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "cn/gpu" }).plainRunCommand, /--algorithm cryptonight_gpu/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "cn/gpu" }).tlsRunCommand, /--pool gulf\.moneroocean\.stream:28192 .*--tls true/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "kawpow" }).tlsRunCommand, /--pool gulf\.moneroocean\.stream:28192 .*--algorithm kawpow .*--tls true/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "kawpow" }).tlsRunCommand, /--tls 1\b/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "kawpow" }).plainRunCommand, /--algorithm kawpow .*--tls false/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "kawpow" }).plainRunCommand, /--tls 0\b/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "intel", miner: "srbminer", algo: "cn/gpu" }).plainRunCommand, /^\.\\SRBMiner-MULTI\.exe/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "cn/gpu" }).tlsRunNote, /Use --list-devices/);
    for (const note of ["tlsRunNote", "plainRunNote"]) {
      assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "nvidia", algo: "etchash", miner: "srbminer" })[note], /start at 1 KH\/s/);
    }
    assert.doesNotMatch(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "cn/gpu" }).notes, /Use --list-devices/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", miner: "srbminer", algo: "etchash" }).plainRunCommand, /--esm 2 --nicehash true/);
    assert.equal(setupPlanWithPorts({ profile: "srb-gpu", gpu: "amd", algo: "kawpow" }).selection.gpu, "amd");
    assert.equal(setupPlanWithPorts({ profile: "srb-gpu", gpu: "nvidia", algo: "kawpow" }).selection.gpu, "nvidia");
    assert.doesNotMatch(setupPlanWithPorts({ profile: "srb-gpu", gpu: "gpu", algo: "kawpow" }).plainRunCommand, /--disable-gpu-/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "c29" }).plainRunCommand, /^MOM_GPU_BACKEND=intel \.\/mom mine gulf\.moneroocean\.stream:10002 .*--job\.algo c29 --bench_algo_params 0/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "intel", algo: "c29" }).plainRunCommand, /^\$env:MOM_GPU_BACKEND='intel'; & \.\\mom\.cmd mine gulf\.moneroocean\.stream:10002 .*--job\.algo c29 --bench_algo_params 0/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "intel", algo: "c29", address: "ADDR; Start-Process calc; #" }).plainRunCommand, /\.\\mom\.cmd mine gulf\.moneroocean\.stream:10002 YOUR_XMR_ADDRESS /);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "intel", algo: "c29" }).plainRunCommand, /mom\.exe|new\.algo_param/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "c29" }).downloadCommand, /download_release MoneroOcean\/mo-miner /);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "c29" }).downloadCommand, /mom-v\.\*-lin\\\.tgz/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "c29" }).downloadCommand, /sudo \.\/install\.sh/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "intel", algo: "c29" }).downloadCommand, /\.\\install\.bat/);
    const momWindowsNote = setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "intel", algo: "c29" }).downloadNote;
    assert.match(momWindowsNote, /install\.bat as Administrator/);
    assert.match(momWindowsNote, /install\.bat/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "gpu", algo: "c29" }).plainRunCommand, /\.\/bzminer -a c29 -p stratum\+tcp:\/\/gulf\.moneroocean\.stream:10002/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: "gpu", algo: "c29" }).plainRunCommand, /^\.\\bzminer\.exe -a c29/);
    const gpuC29LolPlan = setupPlanWithPorts({ profile: "srb-gpu", gpu: "gpu", algo: "c29", miner: "lolminer" });
    assert.equal(gpuC29LolPlan.selection.miner, "lolminer");
    assert.match(gpuC29LolPlan.plainRunCommand, /^\.\/lolMiner --algo CR29/);
    assert.match(gpuC29LolPlan.downloadCommand, /Lolliedieb\/lolMiner-releases/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "gpu", algo: "c29" }).downloadCommand, /download_release bzminer\/bzminer /);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "srb-gpu", gpu: "gpu", algo: "c29" }).downloadCommand, /Lolliedieb\/lolMiner-releases|MoneroOcean\/mo-miner/);
    assert.equal(setupPlanWithPorts({ profile: "meta-miner", gpu: "gpu" }).selection.profile, "multi-miner");
    assert.doesNotMatch(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /mm\.json/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).downloadCommand, /sudo apt-get install -y curl/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).downloadCommand, /nodejs|git clone --depth 1/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).downloadCommand, /download_release MoneroOcean\/multi-miner /);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).downloadCommand, /uname -m/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).downloadCommand, /mm-v\.\*-lin\\\.tar\\\.gz/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).downloadCommand, /mm-v\.\*-lin-arm\\\.tar\\\.gz/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).downloadCommand, /raw\.githubusercontent\.com\/MoneroOcean\/meta-miner/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).downloadCommand, /Lolliedieb\/lolMiner-releases/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "intel" }).downloadCommand, /sudo apt-get install -y curl/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "multi-miner", gpu: "intel" }).downloadCommand, /docker\.io/);
    assert.ok(!/MoneroOcean\/mo-miner/.test(setupPlanWithPorts({ profile: "multi-miner", gpu: "intel" }).downloadCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/mom-v\.\*-lin\\\.tgz/.test(setupPlanWithPorts({ profile: "multi-miner", gpu: "intel" }).downloadCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/sudo \.\/install\.sh/.test(setupPlanWithPorts({ profile: "multi-miner", gpu: "intel" }).downloadCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/MOM='\.\/mom\/mom'/.test(setupPlanWithPorts({ profile: "multi-miner", gpu: "intel" }).tlsRunCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/^export MOM_GPU_BACKEND=intel$/m.test(setupPlanWithPorts({ profile: "multi-miner", gpu: "intel" }).tlsRunCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /--no-config-save/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /--pool="\$POOL"/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /--pass=x/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /POOL='gulf\.moneroocean\.stream:ssl28192'/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /--algo_min_time=60/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /--watchdog=600/);
    assert.ok(/MoM/.test(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).notes) && /direct/i.test(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).notes), 'MM guidance must distinguish the direct MoM alternative');
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /\.\/mm --no-config-save/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /WALLET=/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /SRBMINER="\.\/SRBMiner-MULTI --disable-cpu --pool/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /GPU_FLAGS|--disable-gpu-/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /--kawpow="\$SRBMINER --algorithm kawpow/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", gpu: "gpu" }).tlsRunCommand, /--c29="\$LOLMINER --algo CR29 --pool 127\.0\.0\.1:3333 --user \$WALLET/);
    assert.ok(!/--c29="\$MOM mine 127\.0\.0\.1:3333 \$WALLET x --new\.algo_param\.c29 '\{\\"dev\\":\\"gpu1\\",\\"perf\\":1\}'"/.test(setupPlanWithPorts({ profile: "multi-miner", gpu: "intel" }).tlsRunCommand), 'Intel MM must omit unsupported C29');
    assert.match(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "gpu" }).downloadCommand, /MoneroOcean\/multi-miner\/releases\/latest/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "gpu" }).downloadCommand, /mm-v\.\*-win\\\.zip/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "gpu" }).tlsRunCommand, /\$Srbminer="\.\\SRBMiner-MULTI\.exe --disable-cpu --pool/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "gpu" }).tlsRunCommand, /\$Srb=|\$Common/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "gpu" }).tlsRunCommand, /\$Lolminer="\.\\lolMiner\.exe"/);
    assert.match(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "gpu" }).tlsRunCommand, /^\.\\mm\.exe --no-config-save/m);
    assert.ok(!/mom-v\.\*-win\\\.zip/.test(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "intel" }).downloadCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/\.\\install\.bat/.test(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "intel" }).downloadCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    const mmWindowsNote = setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "intel" }).downloadNote;
    assert.ok(!/install\.bat as Administrator/.test(mmWindowsNote), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/install\.bat/.test(mmWindowsNote), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/\$Mom="\.\\mom\.cmd"/.test(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "intel" }).tlsRunCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/^\$env:MOM_GPU_BACKEND='intel'$/m.test(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "intel" }).tlsRunCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/\$MomJson='\{\\"dev\\":\\"gpu1\\",\\"perf\\":1\}'/.test(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "intel" }).tlsRunCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.ok(!/--c29="\$Mom mine 127\.0\.0\.1:3333 \$Wallet x --new\.algo_param\.c29 '\$MomJson'"/.test(setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "intel" }).tlsRunCommand), 'MM must omit MoM downloads, wrappers, and setup instructions');
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /xmrig-proxy/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--bind 0\.0\.0\.0:3333/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--mode nicehash/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /gulf\.moneroocean\.stream:28192 .*--tls/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).localCommand, /--config=\.\/config\.json/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", worker: "rig" }).tlsRunCommand, / -p rig\b/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", worker: "rig" }).localCommand, / -p x\b/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--coin monero/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--donate-level 1/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /config\.json/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).downloadCommand, /MoneroOcean\/xmrig-proxy/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).downloadCommand, /tar xf xmrig-proxy\.tar\.gz && chmod \+x xmrig-proxy/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).downloadCommand, /xmrig-proxy\.tar\.gz --strip-components=1/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "windows" }).downloadCommand, /win\\\.zip\$/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", os: "windows" }).downloadCommand, /win64/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "windows" }).tlsRunCommand, /^\.\\xmrig-proxy\.exe/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "windows" }).localCommand, /^\.\\xmrig\.exe/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "windows" }).localCommand, /--config="\.\\config\.json"/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).localCommand, /--nicehash/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).localNote, /Replace PROXY_HOST/);
    for (const profile of ["xmrig-proxy", "xmr-node-proxy"]) {
      const localNote = setupPlanWithPorts({ profile }).localNote;
      assert.equal(/install XMRig on each worker\./.test(localNote), true, `${profile} worker prerequisite note`);
    }
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).notes, /Small proxies: start at 64-128 KH\/s/);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy", algo: "etchash" }).selection.algo, "auto");
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /node proxy\.js --config config\.json/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).localCommand, /--config=\.\/config\.json/);
    assert.equal(setupPlanWithPorts({ profile: "xmr-node-proxy", algo: "etchash" }).selection.algo, "auto");
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /"ssl": true/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /"allowSelfSignedSSL": true/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /"port": 28192/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /"password"|algo_perf|blob_type|developerShare|bindAddress|Optional production service|pm2|rx\/0 starter config/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).notes, /rx\/0 starter config/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "macos" }).downloadCommand, /Node\.js 18\+ is required/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "linux" }).downloadCommand, /sudo apt-get install git/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy" }).localCommand, /--coin monero/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).localNote, /Replace PROXY_HOST/);
    test("scope adjacent config loading to XMRig workers", () => {
      const gpuPlans = [
        setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "c29" }),
        setupPlanWithPorts({ profile: "multi-miner", gpu: "intel", algo: "c29" }),
        setupPlanWithPorts({ profile: "srb-gpu", gpu: "nvidia", algo: "kawpow" })
      ];
      for (const plan of gpuPlans) {
        assert.doesNotMatch(plan.plainRunCommand || "", /--config=/, "GPU command unchanged");
        assert.doesNotMatch(plan.tlsRunCommand || "", /--config=/, "GPU TLS command unchanged");
      }
      assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--config=/, "proxy server command unchanged");
    });
    assert.deepEqual(setupAlgoOptions("xmrig-mo"), [["auto", "Auto switch"]]);
    assert.deepEqual(setupAlgoOptions("xmrig-fixed"), [["auto", "Auto switch"]]);
    assert.equal(setupAlgoOptions("srb-gpu").some(([id]) => id === "rx/0"), false);
    assert.deepEqual(SETUP_GPU_VENDORS.map(([id]) => id), ["intel", "nvidia", "amd"]);
    assert.deepEqual(setupGpuMinerOptions({ gpu: "intel", algo: "kawpow" }).map(([id]) => id), ["mom", "srbminer"]);
    assert.deepEqual(setupGpuMinerOptions({ gpu: "intel", algo: "etchash" }).map(([id]) => id), ["mom", "srbminer"]);
    assert.match(setupGpuMinerOptions({ gpu: "intel", algo: "c29" })[1][1], /BZMiner \(Arc Battlemage\)/);
    assert.deepEqual(setupGpuMinerOptions({ gpu: "gpu", algo: "kawpow" }).map(([id]) => id), ["bzminer", "srbminer", "mom"]);
    assert.deepEqual(setupGpuMinerOptions({ gpu: "gpu", algo: "c29" }).map(([id]) => id), ["bzminer", "lolminer", "mom"]);
    assert.deepEqual(setupGpuMinerOptions({ gpu: "gpu", algo: "pearlhash" }).map(([id]) => id), ["bzminer", "srbminer", "mom"]);
    const intelDgpuMatrix = {
      autolykos2: ["mom", "srbminer"],
      kawpow: ["mom", "srbminer"],
      etchash: ["mom", "srbminer"],
      "cn/gpu": ["mom", "bzminer", "srbminer"],
      c29: ["mom", "bzminer"],
      pearlhash: ["mom", "bzminer"]
    };
    for (const [algo, expected] of Object.entries(intelDgpuMatrix)) {
      assert.deepEqual(setupGpuMinerOptions({ gpu: "intel", algo }).map(([id]) => id), expected, `Intel dGPU ${algo}`);
    }
    const nvidiaAmdMatrix = {
      autolykos2: ["bzminer", "srbminer", "mom"],
      kawpow: ["bzminer", "srbminer", "mom"],
      etchash: ["bzminer", "srbminer", "mom"],
      "cn/gpu": ["bzminer", "srbminer", "mom"],
      c29: ["bzminer", "lolminer", "mom"],
      pearlhash: ["bzminer", "srbminer", "mom"]
    };
    for (const gpu of ["nvidia", "amd", "gpu"]) {
      for (const [algo, usual] of Object.entries(nvidiaAmdMatrix)) {
        const expected = gpu === "amd" && algo === "autolykos2" ? ["srbminer", "mom"] : usual;
        assert.deepEqual(setupGpuMinerOptions({ gpu, algo }).map(([id]) => id), expected, `${gpu} ${algo}`);
      }
    }
    for (const [gpu, matrix] of [["intel", intelDgpuMatrix], ["nvidia", nvidiaAmdMatrix], ["amd", nvidiaAmdMatrix]]) {
      for (const os of ["linux", "windows"]) {
        for (const [algo, usual] of Object.entries(matrix)) {
          const expected = os === "windows" && gpu === "nvidia" && algo === "cn/gpu"
            ? ["bzminer", "mom"]
            : os === "windows" && gpu === "nvidia" && ["autolykos2", "etchash"].includes(algo)
              ? ["bzminer", "lolminer", "mom"]
              : gpu === "amd" && algo === "autolykos2"
                ? ["srbminer", "mom"]
                : os === "windows" && gpu === "amd" && algo === "c29"
                  ? ["bzminer", "mom"]
                  : usual;
          const plan = setupPlanWithPorts({ profile: "srb-gpu", gpu, os, algo });
          assert.deepEqual(plan.minerOptions.map(([id]) => id), expected, `${gpu}/${os}/${algo} option order`);
          assert.equal(plan.selection.miner, expected[0], `${gpu}/${os}/${algo} default miner`);
          assert.equal(expected.includes("srbminer") && expected.includes("lolminer"), false, `${gpu}/${os}/${algo} fallback exclusion`);
          for (const miner of ["mom", "bzminer", "srbminer", "lolminer"].filter((id) => !expected.includes(id))) {
            const fallback = setupPlanWithPorts({ profile: "srb-gpu", gpu, os, algo, miner });
            assert.equal(fallback.selection.miner, expected[0], `${gpu}/${os}/${algo} unsupported ${miner} fallback`);
          }
        }
      }
    }
    assert.deepEqual(setupAlgoOptions("srb-gpu").find(([id]) => id === "pearlhash"), ["pearlhash", "pearlhash"]);
    assert.equal(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "prl" }).selection.algo, "pearlhash");
    const intelDgpuPlan = setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "kawpow" });
    assert.equal(intelDgpuPlan.selection.miner, "mom");
    assert.deepEqual(intelDgpuPlan.minerOptions.map(([id]) => id), ["mom", "srbminer"]);
    assert.match(intelDgpuPlan.downloadCommand, /download_release MoneroOcean\/mo-miner /);
    assert.doesNotMatch(intelDgpuPlan.downloadCommand, /bzminer\/bzminer|doktor83\/SRBMiner-Multi/);
    const intelDgpuBzPlan = setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu", miner: "bzminer" });
    assert.equal(intelDgpuBzPlan.selection.miner, "bzminer");
    assert.match(intelDgpuBzPlan.plainRunCommand, /^\.\/bzminer -a cn\/gpu/);
    assert.match(intelDgpuBzPlan.downloadCommand, /download_release bzminer\/bzminer /);
    const intelDgpuSrbPlan = setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "kawpow", miner: "srbminer" });
    assert.match(intelDgpuSrbPlan.plainRunCommand, /^\.\/SRBMiner-MULTI/);
    assert.match(intelDgpuSrbPlan.downloadCommand, /download_release doktor83\/SRBMiner-Multi /);
    const nvidiaPlan = setupPlanWithPorts({ profile: "srb-gpu", gpu: "gpu", algo: "kawpow" });
    assert.equal(nvidiaPlan.selection.miner, "bzminer");
    assert.match(nvidiaPlan.downloadCommand, /download_release bzminer\/bzminer /);
    assert.doesNotMatch(nvidiaPlan.downloadCommand, /doktor83\/SRBMiner-Multi|MoneroOcean\/mo-miner/);
    const nvidiaSrbPlan = setupPlanWithPorts({ profile: "srb-gpu", gpu: "gpu", algo: "kawpow", miner: "srbminer" });
    assert.match(nvidiaSrbPlan.plainRunCommand, /^\.\/SRBMiner-MULTI/);
    assert.match(nvidiaSrbPlan.downloadCommand, /download_release doktor83\/SRBMiner-Multi /);
    const nvidiaMomPlan = setupPlanWithPorts({ profile: "srb-gpu", gpu: "nvidia", algo: "kawpow", miner: "mom" });
    assert.match(nvidiaMomPlan.plainRunCommand, /^MOM_GPU_BACKEND=nvidia \.\/mom mine/);
    assert.match(nvidiaMomPlan.downloadCommand, /download_release MoneroOcean\/mo-miner /);
    const bzAlgos = ["autolykos2", "kawpow", "etchash", "cn/gpu", "c29", "pearlhash"];
    for (const gpu of ["nvidia", "amd"]) {
      for (const os of ["linux", "windows"]) {
        for (const algo of bzAlgos) {
          const bzPlan = setupPlanWithPorts({ profile: "srb-gpu", os, gpu, algo, miner: "bzminer" });
          if (gpu === "amd" && algo === "autolykos2") {
            const srbPlan = setupPlanWithPorts({ profile: "srb-gpu", os, gpu, algo, miner: "srbminer" });
            assert.equal(bzPlan.selection.miner, "srbminer", "stale AMD Ergo BZ selection falls back to SRB");
            assert.equal(bzPlan.plainRunCommand, srbPlan.plainRunCommand);
            assert.equal(bzPlan.tlsRunCommand, srbPlan.tlsRunCommand);
            continue;
          }
          assert.equal(bzPlan.selection.miner, "bzminer", `${gpu}/${os}/${algo} selects BZMiner`);
          assert.match(bzPlan.plainRunCommand, /--cpu 0$/, `${gpu}/${os}/${algo} plain BZMiner CPU scope`);
          assert.match(bzPlan.tlsRunCommand, /--cpu 0$/, `${gpu}/${os}/${algo} TLS BZMiner CPU scope`);
        }
      }
    }
    const intelBzAlgos = ["cn/gpu", "c29", "pearlhash"];
    for (const os of ["linux", "windows"]) {
      for (const algo of bzAlgos) {
        const bzPlan = setupPlanWithPorts({ profile: "srb-gpu", os, gpu: "intel", algo, miner: "bzminer" });
        if (!intelBzAlgos.includes(algo)) {
          assert.notEqual(bzPlan.selection.miner, "bzminer", `intel/${os}/${algo} remains unsupported by BZMiner`);
          continue;
        }
        assert.equal(bzPlan.selection.miner, "bzminer", `intel/${os}/${algo} selects BZMiner`);
        assert.match(bzPlan.plainRunCommand, /--cpu 0$/, `intel/${os}/${algo} plain BZMiner CPU scope`);
        assert.match(bzPlan.tlsRunCommand, /--cpu 0$/, `intel/${os}/${algo} TLS BZMiner CPU scope`);
      }
    }
    for (const [miner, gpu, algo, marker] of [
      ["srbminer", "gpu", "kawpow", /--disable-cpu/],
      ["mom", "gpu", "kawpow", /--job\.algo kawpow/],
      ["lolminer", "gpu", "c29", /--algo CR29/]
    ]) {
      const unchangedPlan = setupPlanWithPorts({ profile: "srb-gpu", gpu: miner === "mom" ? "nvidia" : gpu, algo, miner });
      assert.match(unchangedPlan.plainRunCommand, marker, `${miner} command remains intact`);
      assert.doesNotMatch(unchangedPlan.plainRunCommand, /--cpu 0/, `${miner} does not inherit BZ CPU scope`);
    }
    for (const [miner, binary, release] of [
      ["bzminer", /^\.\\bzminer\.exe/, /bzminer\/bzminer\/releases\/latest/],
      ["srbminer", /^\.\\SRBMiner-MULTI\.exe/, /doktor83\/SRBMiner-Multi\/releases\/latest/],
      ["mom", /^\.\\mom\.cmd/, /MoneroOcean\/mo-miner\/releases\/latest/]
    ]) {
      const windowsPlan = setupPlanWithPorts({ profile: "srb-gpu", os: "windows", gpu: miner === "mom" ? "nvidia" : "gpu", algo: "kawpow", miner });
      if (miner === "mom") assert.match(windowsPlan.plainRunCommand, /^\$env:MOM_GPU_BACKEND='nvidia'; & \.\\mom\.cmd/, `Windows ${miner} command`);
      else assert.match(windowsPlan.plainRunCommand, binary, `Windows ${miner} command`);
      assert.match(windowsPlan.downloadCommand, release, `Windows ${miner} release`);
    }
    assert.deepEqual(setupProfileOptions("macos").map((row) => row[0]), ["xmrig-mo", "xmrig-proxy", "xmr-node-proxy"]);
    assert.equal(setupProfileOptions("windows").some((row) => row[0] === "xmr-node-proxy"), false);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).selection.profile, "xmrig-proxy");
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).downloadCommand, /asset='mac\\\.tar\\\.gz\$'/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).downloadCommand, /asset='mac-intel\\\.tar\\\.gz\$'/);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).downloadNote, "");
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).notes, /selects the current Apple Silicon or Intel archive/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "macos" }).downloadCommand, /brew install node git/);
    assert.equal(setupAddress({ queryAddress: "query", activeAddress: "active", watchlist: [{ address: "tracked" }] }), "query");
    assert.equal(setupAddress({ activeAddress: "active", watchlist: [{ address: "tracked" }] }), "active");
    assert.equal(setupAddress({ watchlist: [{ address: "tracked" }] }), "tracked");
    assert.equal(setupAddress(), "YOUR_XMR_ADDRESS");
  });

  test("MoM prefixes explicit GPU backends on plain and TLS commands", () => {
    const aliases = [
      ["intel", "intel"],
      ["nvidia", "nvidia"],
      ["amd", "amd"],
      ["", null],
      ["gpu", null],
      ["nvidia-amd", null]
    ];
    for (const os of ["linux", "windows"]) {
      for (const [gpu, backend] of aliases) {
        const plan = setupPlanWithPorts({ profile: "srb-gpu", os, gpu, algo: "c29", miner: "mom" });
        for (const [mode, command] of [["plain", plan.plainRunCommand], ["tls", plan.tlsRunCommand]]) {
          const label = `${os}/${gpu}/${mode}`;
          if (backend) {
            const prefix = os === "windows"
              ? `$env:MOM_GPU_BACKEND='${backend}'; & .\\mom.cmd`
              : `MOM_GPU_BACKEND=${backend} ./mom`;
            assert.equal(command.startsWith(prefix), true, label);
            assert.equal((command.match(/MOM_GPU_BACKEND=/g) || []).length, 1, `${label}/single-backend`);
          } else {
            assert.equal(command.length, 0, `${label}/ambiguous-command`);
            assert.equal(/MOM_GPU_BACKEND=/.test(command), false, `${label}/ambiguous-backend`);
            assert.equal(/Select a GPU vendor\./.test(plan.notes), true, `${label}/decision`);
          }
        }
      }
    }
  });

  test("multi-miner examples use fixed-algorithm miners, not MoM", () => {
    for (const os of ["linux", "windows"]) {
      for (const gpu of ["intel", "nvidia", "amd"]) {
        const plan = setupPlanWithPorts({ profile: "multi-miner", os, gpu });
        const intel = gpu.startsWith("intel");
        assert.ok(!/mo-miner|mom-v|mom\.cmd|MOM_GPU_BACKEND|\$Mom\b|\$MOM\b/.test(
          plan.downloadCommand + plan.tlsRunCommand
        ), "MoM already supports pool-driven switching and must not be wrapped");
        const algorithms = [...plan.tlsRunCommand.matchAll(/--([a-z0-9/]+)=/g)]
          .map((match) => match[1])
          .filter((algo) => ['cn/gpu', 'kawpow', 'autolykos2', 'etchash', 'pearlhash', 'c29'].includes(algo))
          .sort();
        assert.deepEqual(algorithms, (intel
          ? ["cn/gpu", "kawpow", "autolykos2", "etchash"]
          : ["cn/gpu", "kawpow", "autolykos2", "etchash", "pearlhash", "c29"]).sort());
        assert.ok(/SRBMiner-MULTI/i.test(plan.downloadCommand), "fixed SRBMiner child is downloaded");
        assert.equal(/lolMiner/.test(plan.downloadCommand), !intel && !(os === "windows" && gpu === "amd"), "C29 dependency matches the recipe");
        assert.ok(/MoM.*directly/.test(plan.notes), "standalone switching is explained");
      }
    }
  });

  test("Windows NVIDIA uses the existing Ergo fallback without advertising SRB CN/GPU", () => {
    for (const [algo, expected] of [
      ["cn/gpu", ["bzminer", "mom"]],
      ["autolykos2", ["bzminer", "lolminer", "mom"]]
    ]) {
      assert.deepEqual(setupGpuMinerOptions({ os: "windows", gpu: "nvidia", algo }).map(([id]) => id), expected);
      const stale = setupPlanWithPorts({ os: "windows", profile: "srb-gpu", gpu: "nvidia", algo, miner: "srbminer" });
      assert.equal(stale.selection.miner, "bzminer");
    }
    const plan = setupPlanWithPorts({ os: "windows", profile: "srb-gpu", gpu: "nvidia", algo: "autolykos2", miner: "lolminer" });
    assert.equal(plan.selection.miner, "lolminer");
    for (const command of [plan.plainRunCommand, plan.tlsRunCommand]) {
      assert.ok(/lolMiner\.exe/.test(command), "Ergo uses the existing lolMiner executable");
      assert.ok(/--algo AUTOLYKOS2(?:\s|$)/.test(command), "Ergo selects its documented algorithm");
      assert.ok(!/--algo CR29/.test(command), "Ergo does not inherit C29");
    }
    assert.ok(/--tls on(?:\s|$)/.test(plan.tlsRunCommand), "TLS is enabled on the TLS recipe");
    assert.ok(!/--tls on/.test(plan.plainRunCommand), "Plain recipe does not enable TLS");
    assert.equal(plan.notes, "Fixed Autolykos2 recipe.");
    const c29 = setupPlanWithPorts({ os: "windows", profile: "srb-gpu", gpu: "nvidia", algo: "c29", miner: "lolminer" });
    assert.equal(plan.downloadCommand, c29.downloadCommand, "Ergo reuses the existing download recipe");
  });

  test("Intel Autolykos2 uses verified alternatives instead of BZMiner", () => {
    const options = setupGpuMinerOptions({ gpu: "intel", algo: "autolykos2" }).map(([id]) => id);
    assert.equal(options.includes("bzminer"), false);
    assert.equal(options.includes("srbminer"), true);
    assert.equal(options.includes("mom"), true);
    for (const os of ["linux", "windows"]) {
      const plan = setupPlanWithPorts({ profile: "srb-gpu", os, gpu: "intel", algo: "autolykos2", miner: "srbminer" });
      assert.equal(plan.selection.miner, "srbminer");
      assert.equal(plan.plainRunCommand.includes("--algorithm autolykos2"), true);
      assert.equal(plan.tlsRunCommand.includes("--algorithm autolykos2"), true);
      const staleChoice = setupPlanWithPorts({ profile: "srb-gpu", os, gpu: "intel", algo: "autolykos2", miner: "bzminer" });
      assert.equal(staleChoice.selection.miner === "bzminer", false);
    }
    for (const gpu of ["nvidia", "amd"]) {
      for (const os of ["linux", "windows"]) {
        assert.equal(setupGpuMinerOptions({ os, gpu, algo: "autolykos2" }).some(([id]) => id === "bzminer"), gpu !== "amd");
      }
    }
  });

  test("Windows NVIDIA SRB KawPoW uses slow table build only for its qualified scope", () => {
    for (const os of ["linux", "windows"]) {
      for (const gpu of ["intel", "nvidia", "amd", "gpu"]) {
        for (const algo of ["cn/gpu", "kawpow", "autolykos2", "etchash", "pearlhash", "c29"]) {
          for (const [miner] of setupGpuMinerOptions({ os, gpu, algo })) {
            const plan = setupPlanWithPorts({ profile: "srb-gpu", os, gpu, algo, miner });
            const expected = os === "windows" && gpu === "nvidia" && algo === "kawpow" && miner === "srbminer";
            for (const command of [plan.plainRunCommand, plan.tlsRunCommand]) {
              assert.equal(command.split(" ").filter(token => token === "--gpu-table-slow-build").length, Number(expected), `${os}/${gpu}/${algo}/${miner}`);
              if (expected) {
                assert.match(command, /--algorithm kawpow .*--tls (?:false|true) --gpu-table-slow-build$/);
                assert.doesNotMatch(command, /--gpu-intensity|--extended-log/);
              }
            }
          }
        }
      }
    }
  });

  test("Windows NVIDIA MM scopes slow table build to its KawPoW child", () => {
    for (const os of ["linux", "windows"]) {
      for (const gpu of ["intel", "nvidia", "amd", "gpu"]) {
        const plan = setupPlanWithPorts({ profile: "multi-miner", os, gpu });
        const expected = os === "windows" && gpu === "nvidia";
        const children = plan.tlsRunCommand.split("\n").filter(line => /^\s+--(?:cn\/gpu|kawpow|autolykos2|etchash|pearlhash|c29)=/.test(line));
        assert.equal((plan.tlsRunCommand.match(/--gpu-table-slow-build/g) || []).length, Number(expected));
        for (const child of children) {
          assert.equal(child.includes("--gpu-table-slow-build"), expected && child.trim().startsWith('--kawpow="'));
        }
      }
    }
  });

  test("Windows NVIDIA Etchash uses the existing lolMiner fallback with explicit NiceHash stratum", () => {
    const options = { os: "windows", gpu: "nvidia", profile: "srb-gpu", algo: "etchash", miner: "lolminer", worker: "fixture" };
    const plan = setupPlanWithPorts(options);
    assert.deepEqual(plan.minerOptions.map(([id]) => id), ["bzminer", "lolminer", "mom"]);
    assert.equal(plan.selection.miner, "lolminer");
    assert.equal(setupPlanWithPorts({ ...options, miner: "srbminer" }).selection.miner, "bzminer", "stale SRB choice falls back to the default");
    assert.equal(plan.downloadCommand, setupPlanWithPorts({ ...options, algo: "c29" }).downloadCommand, "reuse the existing archive/staging path");
    assert.match(plan.notes, /Fixed Etchash recipe.*tested Windows RTX 5060 Ti.*other NVIDIA models are not established/);
    for (const [command, tls] of [[plan.plainRunCommand, false], [plan.tlsRunCommand, true]]) {
      const tokens = command.split(" ");
      const value = flag => tokens[tokens.indexOf(flag) + 1];
      assert.equal(tokens[0], ".\\lolMiner.exe");
      assert.deepEqual(tokens.filter(token => token.startsWith("--")), ["--algo", "--pool", "--user", "--pass", "--ethstratum", ...(tls ? ["--tls"] : [])]);
      assert.equal(value("--algo"), "ETCHASH");
      assert.equal(value("--ethstratum"), "ETHV1");
      assert.equal(value("--pass"), "fixture~etchash");
      assert.equal(tokens.includes("--tls"), tls);
      if (tls) assert.equal(value("--tls"), "on");
      assert.doesNotMatch(command, /CR29|AUTOLYKOS2|--esm|--nicehash|--gpu-intensity|--extended-log/);
    }
    for (const [os, gpu] of [["linux", "nvidia"], ["linux", "amd"], ["windows", "amd"], ["linux", "intel"], ["windows", "intel"]]) {
      const unchanged = setupPlanWithPorts({ ...options, os, gpu, miner: "srbminer" });
      assert.equal(unchanged.selection.miner, "srbminer", `${os}/${gpu} retains SRB`);
      assert.match(unchanged.plainRunCommand, /--algorithm etchash/);
      assert.equal(unchanged.minerOptions.some(([id]) => id === "lolminer"), false, `${os}/${gpu} has no unnecessary fallback`);
    }
  });

  test("Windows NVIDIA MM reuses lolMiner Etchash while other profiles retain SRB", () => {
    const plan = setupPlanWithPorts({ os: "windows", gpu: "nvidia", profile: "multi-miner" });
    const line = plan.tlsRunCommand.split("\n").find(value => value.trim().startsWith('--etchash="'));
    const child = line.match(/--etchash="([^"]+)"/)[1];
    assert.match(child, /^\$Lolminer --algo ETCHASH /);
    assert.deepEqual(child.match(/--[a-z]+/g), ["--algo", "--pool", "--user", "--pass", "--ethstratum"]);
    assert.match(child, /--ethstratum ETHV1$/);
    assert.doesNotMatch(child, /\$Srbminer|--tls|--esm|--nicehash|--gpu-intensity|--extended-log/);
    assert.equal((plan.downloadCommand.match(/Invoke-RestMethod https:\/\/api\.github\.com\/repos\/Lolliedieb\/lolMiner-releases\/releases\/latest/g) || []).length, 1, "C29 already supplies the existing lolMiner archive");
    for (const [os, gpu] of [["linux", "nvidia"], ["linux", "amd"], ["windows", "amd"], ["linux", "intel"], ["windows", "intel"]]) {
      const unchanged = setupPlanWithPorts({ os, gpu, profile: "multi-miner" });
      const other = unchanged.tlsRunCommand.split("\n").find(value => value.trim().startsWith('--etchash="'));
      assert.match(other, /--algorithm etchash/);
      assert.doesNotMatch(other, /lolMiner|Lolminer|LOLMINER|--ethstratum/);
    }
  });

  test("Windows NVIDIA multi-miner uses BZMiner startup fallbacks and the Etchash candidate", () => {
    const plan = setupPlanWithPorts({ profile: "multi-miner", os: "windows", gpu: "nvidia" });
    assert.ok(/bzminer\/bzminer/.test(plan.downloadCommand), "BZMiner dependency is downloaded");
    assert.ok(/\$Bzminer\s*=/.test(plan.tlsRunCommand), "BZMiner child path is resolved");
    assert.ok(/--cn\/gpu=.*\$Bzminer -a cn\/gpu/.test(plan.tlsRunCommand), "CN/GPU uses BZMiner");
    assert.ok(/--autolykos2=.*\$Bzminer -a ergo/.test(plan.tlsRunCommand), "Autolykos2 uses BZMiner");
    assert.ok(/--kawpow=.*\$Srbminer --algorithm kawpow/.test(plan.tlsRunCommand), "KawPow retains SRBMiner");
    assert.ok(/--etchash=.*\$Lolminer --algo ETCHASH/.test(plan.tlsRunCommand), "Etchash uses the existing lolMiner fallback");
    assert.ok(/--pearlhash=.*\$Srbminer --algorithm pearlhash/.test(plan.tlsRunCommand), "Pearl retains SRBMiner");
    assert.ok(/--c29=.*\$Lolminer/.test(plan.tlsRunCommand), "C29 retains lolMiner");
    assert.ok(!/MOM_GPU_BACKEND|\$Mom\b/.test(plan.tlsRunCommand), "no redundant MoM wrapper");
  });

  test("multi-miner Pearl and C29 entries require supported fixed miners", () => {
    for (const os of ["linux", "windows"]) {
      for (const gpu of ["intel", "nvidia", "amd"]) {
        const plan = setupPlanWithPorts({ profile: "multi-miner", os, gpu });
        const intel = gpu.startsWith("intel");
        assert.equal(/--pearlhash=/.test(plan.tlsRunCommand), !intel);
        assert.equal(/--c29=/.test(plan.tlsRunCommand), !intel);
        if (intel) {
          assert.ok(/CN\/GPU.*KawPow.*Autolykos2.*Etchash/.test(plan.notes), "Intel subset is explicit");
        } else {
          assert.ok(/--pearlhash=[^\n]*--algorithm pearlhash/.test(plan.tlsRunCommand), "SRBMiner Pearl child");
          assert.ok((os === "windows" && gpu === "amd" ? /--c29=[^\n]*\$Bzminer -a c29/ : /--c29=[^\n]*--algo CR29/i).test(plan.tlsRunCommand), "fixed C29 child");
        }
      }
    }
  });



  test("non-MoM plans do not receive the MoM backend prefix", () => {
    const plans = [
      setupPlanWithPorts({ profile: "srb-gpu", gpu: "nvidia", algo: "c29", miner: "bzminer" }),
      setupPlanWithPorts({ profile: "srb-gpu", gpu: "amd", algo: "c29", miner: "srbminer" }),
      setupPlanWithPorts({ profile: "srb-gpu", gpu: "nvidia", algo: "c29", miner: "lolminer" }),
      setupPlanWithPorts({ profile: "xmrig-mo", gpu: "amd" }),
      setupPlanWithPorts({ profile: "multi-miner", gpu: "nvidia" })
    ];
    for (const [index, plan] of plans.entries()) {
      for (const mode of ["plainRunCommand", "tlsRunCommand"]) {
        assert.equal(/MOM_GPU_BACKEND=/.test(plan[mode] || ""), false, `plan-${index}/${mode}`);
      }
    }
  });

  test("setup run commands use a safe placeholder for invalid wallet input", () => {
    const maliciousAddress = 'ADDR"; PWNED; #';
    const cases = [
      { profile: "xmrig-mo" },
      { profile: "xmrig-mo", os: "windows" },
      { profile: "xmrig-mo", os: "macos" },
      { profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" },
      { profile: "srb-gpu", os: "windows", gpu: "intel", algo: "cn/gpu" },
      { profile: "srb-gpu", gpu: "intel", algo: "c29" },
      { profile: "srb-gpu", os: "windows", gpu: "intel", algo: "c29" },
      { profile: "srb-gpu", gpu: "gpu", algo: "c29" },
      { profile: "srb-gpu", os: "windows", gpu: "gpu", algo: "c29" },
      { profile: "multi-miner", gpu: "intel" },
      { profile: "multi-miner", os: "windows", gpu: "intel" },
      { profile: "multi-miner", gpu: "gpu" },
      { profile: "multi-miner", os: "windows", gpu: "gpu" },
      { profile: "xmrig-proxy" },
      { profile: "xmrig-proxy", os: "windows" },
      { profile: "xmrig-proxy", os: "macos" },
      { profile: "xmr-node-proxy" },
      { profile: "xmr-node-proxy", os: "macos" }
    ];

    for (const options of cases) {
      const plan = setupPlanWithPorts({ ...options, address: maliciousAddress });
      const commands = setupRunCommands(plan);
      assert.match(commands, /YOUR_XMR_ADDRESS/, JSON.stringify(options));
      assert.doesNotMatch(commands, /PWNED/, JSON.stringify(options));
      assert.equal(plan.selection.address, maliciousAddress);
    }

    const validAddress = `4${"A".repeat(94)}`;
    assert.ok(setupRunCommands(setupPlanWithPorts({ profile: "xmrig-mo", address: validAddress })).includes(validAddress));
  });

  test("setup package install commands come first in command cards", () => {
    for (const os of ["linux", "macos", "windows"]) {
      for (const profile of ["xmrig-mo", "srb-gpu", "multi-miner", "xmrig-proxy", "xmr-node-proxy"]) {
        const plan = setupPlanWithPorts({ os, profile });
        for (const field of ["downloadCommand", "tlsRunCommand", "plainRunCommand", "torCommand", "localCommand"]) {
          assertPackageInstallFirst(plan[field] || "", `${os}/${profile}/${field}`);
        }
      }
    }
  });

  test("help reference ports match current port stats", () => {
    assert.equal(referencePortSummary(), "80/443 TLS for 1 KH/s; 10001/20001 TLS for 1 KH/s; 10002/20002 TLS for 2 KH/s; 10004/20004 TLS for 4 KH/s; 10008/20008 TLS for 8 KH/s; 10016/20016 TLS for 16 KH/s; 10032/20032 TLS for 32 KH/s; 10064/20064 TLS for 64 KH/s; 10128/20128 TLS for 128 KH/s; 10256/20256 TLS for 256 KH/s; 10512/20512 TLS for 512 KH/s; 11024/21024 TLS for 1 MH/s; 12048/22048 TLS for 2 MH/s; 14096/24096 TLS for 4 MH/s; 18192/28192 TLS for 8 MH/s");
    const list = referencePortList();
    assert.match(list, /^<ul class="reference-port-list"><li>80\/443 TLS for 1 KH\/s<\/li>/);
    assert.equal([...list.matchAll(/<li>/g)].length, 15);
  });

  test("wallet chart endpoint uses backend hashrate chart path", () => {
    const address = `4${"A".repeat(94)}`;
    assert.equal(endpointKey(`miner/${address}/chart/hashrate`), `miner/${address}/chart/hashrate`);
    assert.equal(endpointKey("pool/chart/hashrate"), "pool/chart/hashrate");
    assert.equal(endpointKey("pool/motd"), "pool/motd");
    assert.equal(endpointKey("pool/ports"), "pool/ports");
    assert.equal(endpointKey("config"), "config");
    assert.equal(endpointKey("pool/blocks?page=0&limit=15"), "pool/blocks?page=0&limit=15");
    assert.equal(endpointKey("user/updateThreshold"), "user/updateThreshold");
  });

  test("wallet settings normalize threshold and estimate payout fee", () => {
    assert.equal(payoutThresholdFromAtomic(300000000000, TEST_POLICY), 0.3);
    assert.equal(payoutThresholdFromAtomic(0, TEST_POLICY), 0.3);
    assert.equal(normalizePayoutThreshold("0.001"), 0.001);
    assert.equal(normalizePayoutThreshold("0.05"), 0.05);
    assert.equal(validatePayoutThreshold("0.001", TEST_POLICY).valid, false);
    assert.match(validatePayoutThreshold("0.001", TEST_POLICY).message, /at least 0\.003 XMR/);
    assert.equal(validatePayoutThreshold("0.05", TEST_POLICY).valid, true);
    assert.equal(validatePayoutThreshold("0.05").message, "Payout policy unavailable from API.");
    assert.equal(formatPayoutThresholdInput(0.3, TEST_POLICY), "0.3");
    assert.equal(formatPayoutThresholdInput(0.003, TEST_POLICY), "0.003");
    assert.equal(payoutFeeText(0.003, TEST_POLICY), "+0.0004 (13.33%) XMR tx fee");
    assert.equal(payoutFeeText(4, TEST_POLICY), "+0 (0%) XMR tx fee");
    assert.equal(payoutFeeEstimate(4, TEST_POLICY).fee, 0);

    const policy = payoutPolicyFromConfig({
      payout_policy: {
        minimumThreshold: 0.1,
        defaultThreshold: 0.5,
        denomination: 0.01,
        feeFormula: { maxFee: 0.001, zeroFeeThreshold: 2 }
      }
    });
    assert.equal(payoutThresholdFromAtomic(0, policy), 0.5);
    assert.equal(formatPayoutThresholdInput(0.1234, policy), "0.12");
    assert.equal(validatePayoutThreshold("0.05", policy).valid, false);
    assert.match(validatePayoutThreshold("0.05", policy).message, /at least 0\.1 XMR/);
    assert.equal(validatePayoutThreshold("0.5", policy).valid, true);
    assert.equal(payoutFeeText(0.1, policy), "+0.001 (1%) XMR tx fee");
    assert.equal(payoutFeeEstimate(2, policy).fee, 0);
  });

  test("normalizePayoutPolicy rejects incomplete policies and payoutThresholdFromAtomic handles XMR units", () => {
    assert.equal(normalizePayoutPolicy(null), null);
    assert.equal(normalizePayoutPolicy({ minimumThreshold: 0.003, defaultThreshold: 0.3, denomination: 0, feeFormula: { maxFee: 0.0004, zeroFeeThreshold: 4 } }), null);
    assert.equal(normalizePayoutPolicy({ minimumThreshold: 0.003, defaultThreshold: 0.3, denomination: 0.0001, feeFormula: { maxFee: 0.0004 } }), null);
    assert.equal(payoutThresholdFromAtomic(0.5, TEST_POLICY), 0.5);
    assert.equal(payoutThresholdFromAtomic(-5, TEST_POLICY), TEST_POLICY.defaultThreshold);
    assert.equal(payoutThresholdFromAtomic(2, TEST_POLICY), 2 / 1_000_000_000_000);
    const sci = normalizePayoutPolicy({ minimumThreshold: 0.003, defaultThreshold: 0.3, denomination: 1e-7, feeFormula: { maxFee: 0.0004, zeroFeeThreshold: 4 } });
    assert.equal(formatPayoutThresholdInput(0.123456789, sci), "0.1234568");
  });

  test("uptimerobot status makes core outages red and coin node outages yellow", () => {
    assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: API server", statusClass: "success" }, { name: "Backend: Node XMR", statusClass: "paused" }] }).tone, "green");
    assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: Node WOWNERO", statusClass: "danger" }] }).tone, "yellow");
    assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: Node XMR", statusClass: "danger" }] }).tone, "red");
    assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: API server", statusClass: "danger" }] }).tone, "red");
  });

  test("uptimerobot covers empty, degraded, operational, and tone-class mapping", () => {
    assert.deepEqual(summarizeUptimeRobot({}), { tone: "yellow", label: "Unknown", detail: "UptimeRobot status unavailable" });
    assert.equal(summarizeUptimeRobot({ data: [] }).label, "Unknown");
    assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: API server", statusClass: "paused" }] }).label, "Unknown");
    const warn = summarizeUptimeRobot({ data: [{ name: "Backend: API server", statusClass: "seen-up" }] });
    assert.equal(warn.label, "Degraded");
    assert.equal(warn.tone, "yellow");
    assert.deepEqual(summarizeUptimeRobot({ data: [{ name: "Backend: API server", statusClass: "success" }, { name: "Backend: Node XMR", statusClass: "up" }] }), { tone: "green", label: "Operational", detail: "2 active monitors up" });
    assert.equal(uptimeToneClass("green"), "status-green");
    assert.equal(uptimeToneClass("gray"), "status-unknown");
    assert.equal(uptimeToneClass("bogus"), "status-yellow");
    // "yellow" is a real tone (Unknown/Degraded/coin-node), not just the catch-all fallback.
    assert.equal(uptimeToneClass("yellow"), "status-yellow");
    assert.equal(uptimeToneClass("red"), "status-red");
    assert.deepEqual(UNKNOWN_UPTIME, { tone: "gray", label: "Unknown", detail: "UptimeRobot status unavailable" });
  });

  test("effortPercent uses network difficulty and falls back for raw share counts", () => {
    assert.equal(effortPercent({ currentEfforts: { 18081: 120 } }, { 18081: { difficulty: 240 } }, "18081"), 50);
    assert.equal(effortPercent({ currentEfforts: { 18081: 42 } }, {}, "18081"), 42);
    assert.ok(Number.isNaN(effortPercent({ currentEfforts: { 18081: 54_120_000_000 } }, {}, "18081")));
    assert.ok(Number.isNaN(effortPercent({ currentEfforts: { 18081: 0 } }, {}, "18081")));
    assert.equal(effortPercent({ currentEfforts: { 18081: 42 } }, { 18081: { difficulty: 0 } }, "18081"), 42);
  });

  test("payout fee is reported unavailable for empty input or missing policy", () => {
    assert.equal(payoutFeeText("", TEST_POLICY), "XMR tx fee unavailable");
    assert.equal(payoutFeeText("0.05", null), "XMR tx fee unavailable");
    assert.ok(Number.isNaN(payoutFeeEstimate("", TEST_POLICY).fee));
    assert.ok(Number.isNaN(payoutFeeEstimate("0.05", null).percent));
  });

  test("tracking a wallet opens first wallet details then stays on dashboard for later wallets", () => {
    const address = `4${"A".repeat(94)}`;
    const existing = `8${"B".repeat(105)}`;
    const first = trackWalletState([], address, 123);
    assert.equal(first.nextHash, `#/wallet/${address}/overview`);
    assert.equal(first.clearInput, true);
    assert.deepEqual(first.watchlist.map((row) => row.address), [address]);

    const result = trackWalletState([{ address: existing, time: 1 }], address, 123);
    assert.equal(result.nextHash, "#/?tracked=123");
    assert.equal(result.clearInput, true);
    assert.deepEqual(result.watchlist.map((row) => row.address), [existing, address]);

    const invalid = trackWalletState([{ address, time: 1 }], "not-an-address", 999);
    assert.deepEqual(invalid, { watchlist: [{ address, time: 1 }], nextHash: null, clearInput: false });

    const many = Array.from({ length: 12 }, (_, i) => ({ address: `4${String.fromCharCode(66 + i).repeat(94)}`, time: i }));
    const capped = trackWalletState(many, address, 500);
    assert.equal(capped.watchlist.length, 10);
    assert.equal(capped.watchlist.at(-1).address, address);
    assert.equal(capped.watchlist[0].address, many[3].address);
  });

  test("worker controls sortable by name or hashrate", () => {
    const workers = [{ name: "zeta", rate: 10 }, { name: "alpha", rate: 50 }, { name: "beta", rate: 50 }];
    assert.equal(workerSortMode("name"), "name");
    assert.equal(workerSortMode("other"), "h");
    assert.equal(workerSortDirection("asc"), "asc");
    assert.deepEqual(sortWorkerRows(workers, "name", "asc").map((row) => row.name), ["alpha", "beta", "zeta"]);
    assert.deepEqual(sortWorkerRows(workers, "hashrate").map((row) => row.name), ["alpha", "beta", "zeta"]);
    assert.deepEqual(sortWorkerRows(workers, "hashrate", "asc").map((row) => row.name), ["zeta", "alpha", "beta"]);
    // Equal-rate workers tie-break name-ascending regardless of sort direction.
    const tie = [{ name: "b", rate: 50 }, { name: "a", rate: 50 }];
    assert.deepEqual(sortWorkerRows(tie, "hashrate", "desc").map((row) => row.name), ["a", "b"]);
    assert.deepEqual(sortWorkerRows(tie, "hashrate", "asc").map((row) => row.name), ["a", "b"]);

    const address = `4${"A".repeat(94)}`;
    const controls = walletWorkersSection(address, [], {}, "6h", "raw", "h", "desc", false, 2, false);
    assert.match(controls, /window=6h&mode=raw&view=2&sort=name&dir=desc&dead=0/);
    assert.match(controls, /window=6h&mode=raw&view=2&sort=h&dir=asc&dead=0/);
    assert.match(controls, />Dead</);
    assert.match(controls, /view=list&sort=name&dir=asc&dead=0/);

    const mobileDefaultControls = walletWorkersSection(address, [], {}, "6h", "xmr", "h", "desc", false, 1, true);
    assert.match(mobileDefaultControls, /aria-current=page>1</);
    assert.match(mobileDefaultControls, /window=6h&mode=xmr&view=3&sort=h&dir=desc/);
    assert.match(mobileDefaultControls, /window=6h&mode=xmr&view=4&sort=h&dir=desc/);
    assert.match(mobileDefaultControls, /window=6h&mode=xmr&view=5&sort=h&dir=desc/);
  });

  test("explainer copy covers required terms", () => {
    assert.match(EXPLANATIONS.normalizedHashrate, /XMR-normalized/);
    assert.match(EXPLANATIONS.currentHashrate, /10-minute/);
    assert.match(EXPLANATIONS.currentHashrate, /XMR-normalized/);
    assert.match(EXPLANATIONS.hashScalar, /profit per hash/);
    assert.match(EXPLANATIONS.rawHashrate, /Raw hashrate/);
    assert.match(EXPLANATIONS.xmrPayouts, /XTM\/Tari/);
    assert.match(EXPLANATIONS.payoutPolicy, /threshold/);
  });
});

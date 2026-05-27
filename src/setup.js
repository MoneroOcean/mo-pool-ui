import { isFiniteNumber, trimFixed } from "./format.js";
import { HASHRATE_UNITS } from "./constants.js";
import { isXmrAddress } from "./routes.js";

export const POOL_HOST = "gulf.moneroocean.stream";
const LOCAL_PROXY = "127.0.0.1:3333";
const LINUX = "linux";
const MACOS = "macos";
const WINDOWS = "windows";
const INTEL = "intel";
const NVIDIA_AMD = "gpu";
const XMRIG_MO = "xmrig-mo";
const SRB_GPU = "srb-gpu";
const MULTI_MINER = "multi-miner";
const LEGACY_META_MINER = "meta-miner";
const XMRIG_PROXY = "xmrig-proxy";
const XMR_NODE_PROXY = "xmr-node-proxy";
const XMRIG = "xmrig";
const XMRIG_EXE = `${XMRIG}.exe`;
const XMRIG_BIN = `./${XMRIG}`;
const XMRIG_TAR = `${XMRIG}.tar.gz`;
const SRBMINER = "SRBMiner-MULTI";
const SRBMINER_EXE = `${SRBMINER}.exe`;
const SRBMINER_BIN = `./${SRBMINER}`;
const SRBMINER_DIR = "srbminer";
const SRBMINER_ARCHIVE = `${SRBMINER_DIR}.tar`;
const SRBMINER_ZIP = `${SRBMINER_DIR}.zip`;
const LOLMINER = "lolMiner";
const LOLMINER_EXE = `${LOLMINER}.exe`;
const LOLMINER_BIN = `./${LOLMINER}`;
const LOLMINER_DIR = "lolminer";
const LOLMINER_ARCHIVE = `${LOLMINER_DIR}.tar.gz`;
const LOLMINER_ZIP = `${LOLMINER_DIR}.zip`;
const MOMINER_DIR = "mo-miner";
const MOMINER_ARCHIVE = `${MOMINER_DIR}.tgz`;
const MOMINER_ZIP = `${MOMINER_DIR}.zip`;
const MOMINER = "mo-miner";
const MOMINER_BIN = `./${MOMINER}`;
const MOMINER_CMD = `${MOMINER}.cmd`;
const MULTI_MINER_DIR = "multi-miner";
const MULTI_MINER_ARCHIVE = "mm.tar.gz";
const GITHUB_RELEASE_API = "https://api.github.com/repos/";
const XMRIG_RELEASE_API = `${GITHUB_RELEASE_API}MoneroOcean/xmrig/releases/latest`;
const SRBMINER_RELEASE_API = `${GITHUB_RELEASE_API}doktor83/SRBMiner-Multi/releases/latest`;
const LOLMINER_RELEASE_API = `${GITHUB_RELEASE_API}Lolliedieb/lolMiner-releases/releases/latest`;
const MOMINER_RELEASE_API = `${GITHUB_RELEASE_API}MoneroOcean/mo-miner/releases/latest`;
const MULTI_MINER_RELEASE_API = `${GITHUB_RELEASE_API}MoneroOcean/multi-miner/releases/latest`;
const XMRIG_PROXY_RELEASE_API = `${GITHUB_RELEASE_API}MoneroOcean/xmrig-proxy/releases/latest`;
export const TOR_MINING_HOST = "mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id.onion";
const LINUX_XMRIG_ASSET = "grep -E 'lin64-compat|lin64\\.tar\\.gz'";
const WIN64_ZIP_ASSET = "win64\\.zip$";
const XMRIG_PROXY_TAR = "xmrig-proxy.tar.gz";
const BROWSER_DOWNLOAD_URL = "browser_download_url";
const FIRST_ASSET = "Select-Object -First 1";
const KEEPALIVE = "--keepalive";

const SETUP_PROFILES = [
  [XMRIG_MO, "CPU multi", "MoneroOcean XMRig benchmarks CPU algos for XMR payout."],
  [SRB_GPU, "GPU fixed", "Fixed-algo GPU miner setup."],
  [MULTI_MINER, "GPU multi", "Multi-Miner lets fixed-algo GPU miners switch with pool conditions."],
  [XMRIG_PROXY, XMRIG_PROXY, "Many XMRig CPU workers behind one local proxy."],
  [XMR_NODE_PROXY, XMR_NODE_PROXY, "Larger CPU farms; keep GPU miners direct or behind Multi-Miner."]
];

export const SETUP_OS = [
  [LINUX, "Linux/Ubuntu"],
  [MACOS, "macOS"],
  [WINDOWS, "Windows"]
];

export const SETUP_HASHRATE_UNITS = HASHRATE_UNITS;

export const SETUP_GPU_VENDORS = [
  [INTEL, "Intel"],
  [NVIDIA_AMD, "NVIDIA/AMD"]
];

const GPU_ALGO_IDS = ["autolykos2", "kawpow", "etchash", "cn/gpu", "c29"];
const GPU_PROFILES = [SRB_GPU, MULTI_MINER];
const AUTO_PROFILES = [XMRIG_MO, MULTI_MINER, XMRIG_PROXY, XMR_NODE_PROXY];
const MAC_PROFILES = [XMRIG_MO, XMRIG_PROXY, XMR_NODE_PROXY];
const AUTO_ALGO = ["auto", "Auto switch"];
const SETUP_ALGOS = [
  AUTO_ALGO,
  ...GPU_ALGO_IDS.map((id) => [id, id])
];

const SRB_ALGO = {
  autolykos2: "autolykos2",
  "cn/gpu": "cryptonight_gpu",
  etchash: "etchash",
  kawpow: "kawpow"
};
const ETCHASH_EXTRA = " --esm 2 --nicehash true";
const MULTI_MINER_ALGOS = Object.keys(SRB_ALGO).map((name) => [name, SRB_ALGO[name], name === "etchash" ? ETCHASH_EXTRA : ""]);
const WINDOWS_POWERSHELL_BKM = "Open Windows PowerShell first. From cmd.exe, run: powershell -NoProfile. Windows Security or other antivirus may quarantine miner archives; if extraction is blocked, review the alert and allow or exclude only this mining folder if you trust the release.";
const PORT_METADATA_UNAVAILABLE = "Pool port metadata unavailable from API.";
const TLS_MODE_NOTE = "TLS encrypts miner-to-pool traffic. Use plain only when TLS is blocked or unsupported.";
const PLAIN_MODE_NOTE = "Plain mode uses the non-TLS mining port for tests or restricted networks.";
const TOR_MODE_NOTE = "Tor mode uses MoneroOcean's onion host via local SOCKS5 and the selected non-TLS setup port. Use 127.0.0.1:9050 for system Tor or 127.0.0.1:9150 for Tor Browser. TLS does not improve security over Tor.";
const SRB_RUN_NOTE = "Use --list-devices first if GPU 0 is wrong. Intel Alchemist/Battlemage, NVIDIA Pascal+, and supported AMD GPUs work.";
const XMRIG_MAC_DOWNLOAD_NOTE = "MoneroOcean XMRig macOS release assets are currently arm64 only. Use Linux/Windows or build XMRig from source on Intel macOS.";
const XMRIG_PROXY_MAC_DOWNLOAD_NOTE = "MoneroOcean xmrig-proxy macOS release assets are currently arm64 only. Use Linux/Windows or build xmrig-proxy from source on Intel macOS.";
const PROXY_HOSTS_PORT_3333 = "workers connect to this host on port 3333.";
const REPLACE_PROXY_HOST = "Replace PROXY_HOST with the proxy machine hostname or address.";
const XMRIG_AUTO_SWITCH_NOTE = "MoneroOcean XMRig benchmarks/switches CPU algos for XMR payout; first run may benchmark for several minutes before pool jobs appear.";
const SMALL_PROXY_NOTE = "For small proxy setups, start with 64-128 KH/s.";

export function setupAddress({ queryAddress = "", activeAddress = "", watchlist = [] } = {}) {
  return queryAddress || activeAddress || watchlist.find((row) => row?.address)?.address || "YOUR_XMR_ADDRESS";
}

export function setupAlgoOptions(profile = XMRIG_MO) {
  const normalized = profileId(profile);
  if (normalized === SRB_GPU) return SETUP_ALGOS.filter(([id]) => id !== AUTO_ALGO[0]);
  return [AUTO_ALGO];
}

export function setupProfileOptions(os = LINUX) {
  const normalized = optionId(os, SETUP_OS, LINUX);
  if (normalized === MACOS) return SETUP_PROFILES.filter((row) => MAC_PROFILES.includes(row[0]));
  if (normalized === WINDOWS) return SETUP_PROFILES.filter((row) => row[0] !== XMR_NODE_PROXY);
  return SETUP_PROFILES;
}

export function setupHashrateDefaults(profile = XMRIG_MO, gpu = INTEL, algo = "") {
  const normalized = profileId(profile);
  if (normalized === XMRIG_PROXY) return { value: 64, unit: "kh" };
  if (normalized === XMR_NODE_PROXY) return { value: 128, unit: "kh" };
  if (GPU_PROFILES.includes(normalized) && algo === "c29") return { value: 1, unit: "h" };
  if (GPU_PROFILES.includes(normalized)) {
    return isIntelGpu(gpu) ? { value: 128, unit: "kh" } : { value: 512, unit: "kh" };
  }
  return { value: 4, unit: "kh" };
}

export function setupHashrateToHps(value, unit = "kh") {
  const row = SETUP_HASHRATE_UNITS.find(([id]) => id === unit) || SETUP_HASHRATE_UNITS[1];
  const number = Number(value);
  if (!isFiniteNumber(number) || number <= 0) return setupHashrateDefaults().value * 1000;
  return number * row[2];
}

export function setupConfiguredPorts(source = []) {
  const global = !Array.isArray(source) && Array.isArray(source?.global);
  const rows = Array.isArray(source) ? source : global ? source.global.filter((row) => row && !row.tls) : Array.isArray(source?.configured) ? source.configured : [];
  return rows
    .map((row) => {
      if (Array.isArray(row)) {
        return {
          port: Number(row[0]) || 0,
          tlsPort: Number(row[1]) || 0,
          targetHashrate: Number(row[2]) || 0,
          label: String(row[3] || "").trim()
        };
      }
      const rawPort = Number(row.port);
      const port = global && rawPort === 80 ? 10001 : rawPort;
      const tlsPort = global ? port === 10001 ? 20001 : port + 10000 : Number(row.tlsPort);
      const difficulty = Number(row.difficulty);
      const targetHashrate = Number(row.targetHashrate) || (isFiniteNumber(difficulty) && difficulty > 0 ? difficulty / (global ? 10 : 30) : 0);
      return {
        port: port > 0 ? port : 0,
        tlsPort: tlsPort > 0 ? tlsPort : 0,
        targetHashrate,
        label: String(row.label || row.description || "").trim()
      };
    })
    .filter((row, index, list) => row.port > 0 && row.targetHashrate > 0 && (!global || list.findIndex((match) => match.port === row.port) === index))
    .sort((a, b) => a.targetHashrate - b.targetHashrate || a.port - b.port);
}

export function setupPlan(options = {}) {
  const os = optionId(options.os, SETUP_OS, LINUX);
  const profile = profileId(options.profile, os);
  const gpu = gpuId(options.gpu);
  const requestedAlgo = optionId(options.algo, SETUP_ALGOS, profileUsesAutoAlgo(profile) ? AUTO_ALGO[0] : "rx/0");
  const algo = normalizeProfileAlgo(profile, requestedAlgo);
  const defaultHashrate = setupHashrateDefaults(profile, gpu, algo);
  const hashrateUnit = optionId(options.hashrateUnit, SETUP_HASHRATE_UNITS, defaultHashrate.unit);
  const hashrate = normalizedHashrateInput(options.hashrate, defaultHashrate.value);
  const hashrateHps = setupHashrateToHps(hashrate, hashrateUnit);
  const portRow = portRowForHashrate(hashrateHps, options.ports);
  const address = String(options.address || "YOUR_XMR_ADDRESS").trim() || "YOUR_XMR_ADDRESS";
  const worker = workerName(options.worker);
  const port = portRow?.port || 0;
  const pool = `${POOL_HOST}:${port}`;
  const password = profile === XMRIG_MO || algo === AUTO_ALGO[0] ? worker : `${worker}~${algo}`;

  const selection = { profile, os, gpu, algo, address, hashrate, hashrateUnit, hashrateHps, port };
  const planOptions = { os, gpu, algo, address, worker, password, pool, port, portRow };
  if (!portRow) return withSelection(unavailablePortPlan(), selection);
  if (profile === SRB_GPU) return withSelection(srbPlan(planOptions), selection);
  if (profile === MULTI_MINER) return withSelection(multiMinerPlan(planOptions), selection);
  if (profile === XMRIG_PROXY) return withSelection(xmrigProxyPlan(planOptions), selection);
  if (profile === XMR_NODE_PROXY) return withSelection(xmrNodeProxyPlan(planOptions), selection);
  return withSelection(xmrigPlan(planOptions), selection);
}

function withSelection(plan, selection) {
  return { ...plan, selection };
}

function unavailablePortPlan() {
  return { title: "Setup unavailable", summary: PORT_METADATA_UNAVAILABLE, notes: `${PORT_METADATA_UNAVAILABLE} Reload after the API returns configured ports.` };
}

function setupPoolSummary(pool, portRow, suffix = ".") {
  return `${pool} is derived from ${portRow.label}${suffix}`;
}

function windowsLocal(binary) {
  return `.\\${binary}`;
}

function xmrigPlan({ os, address, worker, pool, portRow }) {
  const windows = os === WINDOWS;
  const macos = os === MACOS;
  const binary = windows ? windowsLocal(XMRIG_EXE) : XMRIG_BIN;
  const d = windows
    ? windowsZipDownload(XMRIG_RELEASE_API, WIN64_ZIP_ASSET, "xmrig.zip", "moneroocean")
    : macos
      ? macXmrigDownload()
    : `${linuxReleaseDownload("moneroocean", XMRIG_RELEASE_API, LINUX_XMRIG_ASSET, XMRIG_TAR)} && tar xf ${XMRIG_TAR} && chmod +x ${XMRIG}`;
  const directRun = xmrigRun(binary, pool, address, worker);
  const tlsRun = portRow.tlsPort ? xmrigRun(binary, `${POOL_HOST}:${portRow.tlsPort}`, address, worker, true) : "";
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: d,
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : macos ? XMRIG_MAC_DOWNLOAD_NOTE : "",
    tlsRunCommand: tlsRun,
    tlsRunNote: TLS_MODE_NOTE,
    plainRunCommand: directRun,
    plainRunNote: PLAIN_MODE_NOTE,
    torCommand: windows ? "" : xmrigTorRun({ os, address, worker, port: portRow.port }),
    torNote: windows ? "" : TOR_MODE_NOTE,
    notes: macos
      ? `Best first CPU setup on Apple Silicon Macs. Intel macOS is not supported by this download. ${XMRIG_AUTO_SWITCH_NOTE} If Gatekeeper blocks it, remove quarantine and retry.`
      : `Best first setup for CPU mining. ${XMRIG_AUTO_SWITCH_NOTE}`
  };
}

function srbPlan({ os, gpu, algo, address, worker, password, pool, portRow }) {
  const intelGpu = isIntelGpu(gpu);
  if (algo === "c29") {
    return intelGpu
      ? mominerPlan({ os, address, password, pool, portRow })
      : lolminerPlan({ os, address, password, pool, portRow });
  }
  const windows = os === WINDOWS;
  const binary = windows ? windowsLocal(SRBMINER_EXE) : SRBMINER_BIN;
  const srbAlgo = SRB_ALGO[algo] || GPU_ALGO_IDS[0];
  const disable = gpuDisableFlags(intelGpu);
  const ethExtra = algo === "etchash" ? ETCHASH_EXTRA : "";
  const d = windows
    ? srbWindowsDownload()
    : srbLinuxDownload();
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: d,
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: portRow.tlsPort ? srbRun(binary, disable, srbAlgo, `${POOL_HOST}:${portRow.tlsPort}`, address, password, worker, true, ethExtra) : "",
    tlsRunNote: `${TLS_MODE_NOTE} ${SRB_RUN_NOTE}`,
    plainRunCommand: srbRun(binary, disable, srbAlgo, pool, address, password, worker, false, ethExtra),
    plainRunNote: PLAIN_MODE_NOTE,
    notes: "SRBMiner-Multi is used for fixed algo GPU mining."
  };
}

function multiMinerPlan({ os, gpu, address, pool, portRow }) {
  const windows = os === WINDOWS;
  const intelGpu = isIntelGpu(gpu);
  const disable = gpuDisableFlags(intelGpu);
  const tlsPool = portRow.tlsPort ? `${POOL_HOST}:ssl${portRow.tlsPort}` : pool;
  return {
    summary: setupPoolSummary(tlsPool, portRow, `. MM listens on ${LOCAL_PROXY} for child miners.`),
    downloadCommand: windows
      ? multiMinerWindowsDownload(intelGpu)
      : multiMinerLinuxDownload(intelGpu),
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: windows ? multiMinerWindowsRun({ address, pool: tlsPool, disable, intelGpu }) : multiMinerLinuxRun({ address, pool: tlsPool, disable, intelGpu }),
    tlsRunNote: TLS_MODE_NOTE,
    notes: "Use this only for GPU algo switching; fixed GPU setup is simpler. First run benchmarks/autotunes configured algorithms before normal mining output appears."
  };
}

function gpuDisableFlags(intelGpu) {
  return intelGpu ? "--disable-gpu-amd --disable-gpu-nvidia" : "";
}

function xmrigRun(binary, pool, address, worker, tls = false) {
  return `${binary} -o ${pool} -u ${address} --rig-id ${worker} ${KEEPALIVE}${tls ? " --tls" : ""}`;
}

function srbRun(binary, disable, algo, pool, address, password, worker, tls, extra = "") {
  return `${binary} ${srbCommon(disable, pool, address, worker)} --algorithm ${algo} --password ${password} --tls ${tls}${extra}`;
}

function srbCommon(disable, pool, address, worker, binary = "") {
  return [binary, "--disable-cpu", disable, "--pool", pool, "--wallet", address, "--worker", worker, "--gpu-id", "0", "--keepalive", "true"].filter(Boolean).join(" ");
}

function lolminerPlan({ os, address, password, pool, portRow }) {
  const windows = os === WINDOWS;
  const binary = windows ? windowsLocal(LOLMINER_EXE) : LOLMINER_BIN;
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: windows ? lolminerWindowsDownload() : lolminerLinuxDownload(),
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: portRow.tlsPort ? lolminerRun(binary, `${POOL_HOST}:${portRow.tlsPort}`, address, password, true) : "",
    tlsRunNote: TLS_MODE_NOTE,
    plainRunCommand: lolminerRun(binary, pool, address, password, false),
    plainRunNote: PLAIN_MODE_NOTE,
    notes: "lolMiner is used for fixed C29 on NVIDIA/AMD GPUs."
  };
}

function mominerPlan({ os, address, password, pool, portRow }) {
  const windows = os === WINDOWS;
  const wallet = windows && !isXmrAddress(address) ? "YOUR_XMR_ADDRESS" : address;
  const binary = windows ? windowsLocal(MOMINER_CMD) : MOMINER_BIN;
  const mominerJson = mominerC29Json({ escapeQuotes: windows });
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: windows ? mominerWindowsDownload() : mominerLinuxDownload(),
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: portRow.tlsPort ? mominerRun(binary, `${POOL_HOST}:${portRow.tlsPort}tls`, wallet, password, mominerJson) : "",
    tlsRunNote: TLS_MODE_NOTE,
    plainRunCommand: mominerRun(binary, pool, wallet, password, mominerJson),
    plainRunNote: PLAIN_MODE_NOTE,
    notes: "mo-miner is used for fixed Intel GPU C29."
  };
}

function lolminerRun(binary, pool, address, password, tls) {
  return `${binary} --algo CR29 --pool ${pool} --user ${address} --pass ${password}${tls ? " --tls on" : ""}`;
}

function mominerRun(binary, pool, address, password, mominerJson = mominerC29Json()) {
  return `${binary} mine ${pool} ${address} ${password} --new.algo_param.c29 '${mominerJson}'`;
}

function mominerC29Json({ escapeQuotes = false, perf = false } = {}) {
  const json = JSON.stringify(perf ? { dev: "gpu1*1", perf: 1 } : { dev: "gpu1*1" });
  return escapeQuotes ? json.replaceAll('"', '\\"') : json;
}

function multiMinerAlgoArgs({ common, lineContinuation, intelGpu, lolminer, moMiner, wallet, mominerJson }) {
  return multiMinerCommands({ common, intelGpu, lolminer, moMiner, wallet, mominerJson })
    .map(([name, command]) => `  --${name}="${command}"`)
    .join(` ${lineContinuation}\n`);
}

function multiMinerCommands({ common, intelGpu, lolminer, moMiner, wallet, mominerJson }) {
  const commands = MULTI_MINER_ALGOS.map(([name, algorithm, extra]) => [name, `${common} --algorithm ${algorithm} --password x${extra}`]);
  commands.push(intelGpu
    ? ["c29", `${moMiner} mine ${LOCAL_PROXY} ${wallet} x --new.algo_param.c29 '${mominerJson}'`]
    : ["c29", `${lolminer} --algo CR29 --pool ${LOCAL_PROXY} --user ${wallet} --pass x`]);
  return commands;
}

function multiMinerLinuxRun({ address, pool, disable, intelGpu }) {
  return `WALLET='${address}'
POOL='${pool}'
LOCAL_PROXY='${LOCAL_PROXY}'
SRB='${SRBMINER_BIN}'
${intelGpu ? `MO_MINER='./${MOMINER_DIR}/${MOMINER}'` : `LOLMINER='${LOLMINER_BIN}'`}
${disable ? `GPU_FLAGS='${disable}'\n` : ""}COMMON="${srbCommon(disable ? "$GPU_FLAGS" : "", "$LOCAL_PROXY", "$WALLET", "mm", "$SRB")} --tls false"

./mm --no-config-save --pool="$POOL" --user="$WALLET" --pass=x --algo_min_time=60 \\
${multiMinerAlgoArgs({ common: "$COMMON", lineContinuation: "\\", intelGpu, lolminer: "$LOLMINER", moMiner: "$MO_MINER", wallet: "$WALLET", mominerJson: mominerC29Json({ escapeQuotes: true, perf: true }) })}`;
}

function multiMinerWindowsRun({ address, pool, disable, intelGpu }) {
  return `$Wallet="${address}"
$Pool="${pool}"
$LocalProxy="${LOCAL_PROXY}"
$Srb="${windowsLocal(SRBMINER_EXE)}"
${intelGpu ? `$Mominer="${windowsLocal(MOMINER_CMD)}"
$MominerJson='${mominerC29Json({ escapeQuotes: true, perf: true })}'` : `$Lolminer="${windowsLocal(LOLMINER_EXE)}"`}
${disable ? `$GpuFlags="${disable}"\n` : ""}$Common="${srbCommon(disable ? "$GpuFlags" : "", "$LocalProxy", "$Wallet", "mm", "$Srb")} --tls false"

${windowsLocal("mm.exe")} --no-config-save --pool="$Pool" --user="$Wallet" --pass=x --algo_min_time=60 \`
${multiMinerAlgoArgs({ common: "$Common", lineContinuation: "`", intelGpu, lolminer: "$Lolminer", moMiner: "$Mominer", wallet: "$Wallet", mominerJson: intelGpu ? "$MominerJson" : mominerC29Json({ perf: true }) })}`;
}

function xmrigProxyPlan({ os, address, worker, pool, portRow }) {
  const windows = os === WINDOWS;
  const macos = os === MACOS;
  const binary = windows ? windowsLocal("xmrig-proxy.exe") : "./xmrig-proxy";
  const tlsPool = portRow.tlsPort ? `${POOL_HOST}:${portRow.tlsPort}` : pool;
  const proxyRunCommand = `${binary} -o ${tlsPool} -u ${address} --bind 0.0.0.0:3333 --mode nicehash ${KEEPALIVE} --tls`;
  return {
    summary: setupPoolSummary(tlsPool, portRow, `; ${PROXY_HOSTS_PORT_3333}`),
    downloadCommand: windows
      ? xmrigProxyWindowsDownload()
      : macos
        ? xmrigProxyMacDownload()
        : xmrigProxyLinuxDownload(),
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : macos ? XMRIG_PROXY_MAC_DOWNLOAD_NOTE : "",
    tlsRunCommand: proxyRunCommand,
    tlsRunNote: TLS_MODE_NOTE,
    localCommand: `${windows ? windowsLocal(XMRIG_EXE) : XMRIG_BIN} -o PROXY_HOST:3333 -u ${worker} --nicehash --donate-over-proxy 1 ${KEEPALIVE}`,
    localNote: `Worker miners connect to this proxy on port 3333 using NiceHash-compatible mode. ${REPLACE_PROXY_HOST}`,
    notes: `${macos ? "Intel macOS is not supported by this download. " : ""}Use when many XMRig CPU workers share one upstream pool connection. ${SMALL_PROXY_NOTE} MoneroOcean fork keeps proxy aligned with algo switching. Keep fixed GPU miners direct or behind Multi-Miner.`
  };
}

function xmrNodeProxyPlan({ os, address, worker, port, portRow }) {
  const macos = os === MACOS;
  const tlsPort = portRow.tlsPort || port;
  const config = xmrNodeProxyConfig({ address, port: tlsPort });
  return {
    summary: setupPoolSummary(`${POOL_HOST}:${tlsPort}`, portRow, `; ${PROXY_HOSTS_PORT_3333}`),
    downloadCommand: macos
      ? "brew install node git\ngit clone https://github.com/MoneroOcean/xmr-node-proxy.git ~/xmr-node-proxy\ncd ~/xmr-node-proxy\nnpm install --no-audit --no-fund --min-release-age=7"
      : "sudo apt-get install git\ngit clone https://github.com/MoneroOcean/xmr-node-proxy.git ~/xmr-node-proxy\ncd ~/xmr-node-proxy\nbash install.sh",
    tlsRunCommand: `cat > config.json <<'JSON'\n${config}\nJSON\nnode proxy.js --config config.json`,
    tlsRunNote: TLS_MODE_NOTE,
    localCommand: `${XMRIG_BIN} -o PROXY_HOST:3333 -u ${worker}`,
    localNote: `Worker miners connect to xmr-node-proxy on port 3333. ${REPLACE_PROXY_HOST}`,
    notes: `Use for many CPU workers on XMR-style algorithms. ${SMALL_PROXY_NOTE} Generated xmr-node-proxy config is an rx/0 starter config. Add real algo_perf for full switching. Not for Etchash, KawPow, Autolykos2, or XTM/Tari c29.`
  };
}

function xmrigTorRun({ os, address, worker, port }) {
  const setup = os === MACOS
    ? "brew install tor && brew services start tor"
    : "sudo apt-get install tor && sudo systemctl enable --now tor";
  return `${setup}
${XMRIG_BIN} -o ${TOR_MINING_HOST}:${port} -x 127.0.0.1:9050 -u ${address} --rig-id ${worker} ${KEEPALIVE}`;
}

function xmrNodeProxyConfig({ address, port }) {
  return `{
  "pools": [{
    "hostname": "${POOL_HOST}",
    "port": ${port},
    "ssl": true,
    "allowSelfSignedSSL": true,
    "share": 100,
    "username": "${address}",
    "default": true
  }],
  "listeningPorts": [{ "port": 3333, "diff": 1000 }]
}`;
}

function configuredPortForHashrate(hashrateHps, configuredPorts) {
  const target = Number(hashrateHps) || 0;
  return configuredPorts.find((row) => row.targetHashrate >= target) || configuredPorts[configuredPorts.length - 1];
}

function portRowForHashrate(hashrateHps, ports = []) {
  const configured = setupConfiguredPorts(ports);
  if (!configured.length) return null;
  const row = configuredPortForHashrate(hashrateHps, configured);
  return {
    port: row.port,
    tlsPort: row.tlsPort,
    label: row.label || `${formatSetupHashrate(row.targetHashrate)} configured target`
  };
}

function normalizedHashrateInput(value, fallback) {
  const number = Number(value);
  if (!isFiniteNumber(number) || number <= 0) return fallback;
  return Math.round(number * 1000) / 1000;
}

function formatSetupHashrate(hashrateHps) {
  const hps = Number(hashrateHps) || 0;
  if (hps >= 1_000_000) return `${trimFixed(hps / 1_000_000, 3)} MH/s`;
  if (hps >= 1000) return `${trimFixed(hps / 1000, 3)} KH/s`;
  return `${trimFixed(hps, 3)} H/s`;
}

function normalizeProfileAlgo(profile, algo) {
  if (profileUsesAutoAlgo(profile)) return AUTO_ALGO[0];
  if (profile === SRB_GPU && !GPU_ALGO_IDS.includes(algo)) return GPU_ALGO_IDS[0];
  if (algo === AUTO_ALGO[0]) return "rx/0";
  return algo;
}

function profileUsesAutoAlgo(profile) {
  return AUTO_PROFILES.includes(profile);
}

function profileId(value, os = LINUX) {
  const normalized = value === LEGACY_META_MINER ? MULTI_MINER : value;
  return setupProfileOptions(os).some((row) => row[0] === normalized) ? normalized : XMRIG_MO;
}

function gpuId(value) {
  if (value === INTEL) return INTEL;
  if (value === NVIDIA_AMD || value === "nvidia" || value === "amd") return NVIDIA_AMD;
  return INTEL;
}

function isIntelGpu(gpu) {
  return gpu === INTEL;
}

function optionId(value, rows, fallback) {
  return rows.some((row) => row[0] === value) ? value : fallback;
}

function workerName(value) {
  return String(value || "rig01").trim().replace(/[^a-zA-Z0-9_.-]+/g, "_") || "rig01";
}

function macXmrigDownload() {
  return macTarDownload("moneroocean", XMRIG_RELEASE_API, XMRIG_TAR, XMRIG);
}

function srbLinuxDownload(includeCurl = true) {
  const d = includeCurl ? linuxReleaseDownload : releaseDownload;
  return `${d(SRBMINER_DIR, SRBMINER_RELEASE_API, srbMinerLinuxAsset(), SRBMINER_ARCHIVE)} && ${unpackSrbMinerLinux()}`;
}

function srbWindowsDownload() {
  return windowsZipDownload(SRBMINER_RELEASE_API, WIN64_ZIP_ASSET, SRBMINER_ZIP, SRBMINER_DIR);
}

function lolminerLinuxDownload(includeCurl = true) {
  const d = includeCurl ? linuxReleaseDownload : releaseDownload;
  return `${d(LOLMINER_DIR, LOLMINER_RELEASE_API, lolMinerLinuxAsset(), LOLMINER_ARCHIVE)} && ${unpackLolMinerLinux()}`;
}

function lolminerWindowsDownload() {
  return windowsZipDownload(LOLMINER_RELEASE_API, WIN64_ZIP_ASSET, LOLMINER_ZIP, LOLMINER_DIR);
}

function mominerLinuxDownload() {
  return `sudo apt-get install -y curl
mkdir -p ~/${MOMINER_DIR} && cd ~/${MOMINER_DIR}
${downloadMominer()} && chmod +x ${MOMINER}`;
}

function mominerWindowsDownload() {
  return `${windowsAssetDownload(MOMINER_RELEASE_API, "mo-miner-v.*-win\\.zip$", MOMINER_ZIP)}
Expand-Archive ${MOMINER_ZIP} -DestinationPath .\\${MOMINER_DIR} -Force
$mdir=Get-ChildItem .\\${MOMINER_DIR} -Directory | ${FIRST_ASSET}
if ($mdir) { Copy-Item "$($mdir.FullName)\\*" . -Recurse -Force } else { Copy-Item ".\\${MOMINER_DIR}\\*" . -Recurse -Force }`;
}

function multiMinerLinuxDownload(intelGpu) {
  return `sudo apt-get install -y curl
mkdir -p ~/${MULTI_MINER_DIR} && cd ~/${MULTI_MINER_DIR}
${downloadMultiMinerLinux()} && chmod +x mm
${releaseAssetDownload(SRBMINER_RELEASE_API, srbMinerLinuxAsset(), SRBMINER_ARCHIVE)} && ${unpackSrbMinerLinux()}
${intelGpu ? `mkdir -p ${MOMINER_DIR} && (cd ${MOMINER_DIR} && ${downloadMominer()} && chmod +x ${MOMINER})` : `${releaseAssetDownload(LOLMINER_RELEASE_API, lolMinerLinuxAsset(), LOLMINER_ARCHIVE)} && ${unpackLolMinerLinux()}`}`;
}

function multiMinerWindowsDownload(intelGpu) {
  return `${windowsAssetDownload(MULTI_MINER_RELEASE_API, "mm-v.*-win\\.zip$", "mm.zip")}
${windowsExtractZip("mm.zip", MULTI_MINER, false)}
${windowsAssetDownload(SRBMINER_RELEASE_API, WIN64_ZIP_ASSET, SRBMINER_ZIP)}
Expand-Archive ${SRBMINER_ZIP} -DestinationPath .\\${SRBMINER_DIR} -Force
$dir=Get-ChildItem .\\${SRBMINER_DIR} -Directory | ${FIRST_ASSET}
if ($dir) { Copy-Item "$($dir.FullName)\\*" . -Recurse -Force } else { Copy-Item ".\\${SRBMINER_DIR}\\*" . -Recurse -Force }
${intelGpu ? mominerWindowsDownload() : `${windowsAssetDownload(LOLMINER_RELEASE_API, WIN64_ZIP_ASSET, LOLMINER_ZIP)}
Expand-Archive ${LOLMINER_ZIP} -DestinationPath .\\${LOLMINER_DIR} -Force
$gdir=Get-ChildItem .\\${LOLMINER_DIR} -Directory | ${FIRST_ASSET}
if ($gdir) { Copy-Item "$($gdir.FullName)\\*" . -Recurse -Force } else { Copy-Item ".\\${LOLMINER_DIR}\\*" . -Recurse -Force }`}`;
}

function xmrigProxyLinuxDownload() {
  return `${linuxReleaseDownload(XMRIG_PROXY, XMRIG_PROXY_RELEASE_API, LINUX_XMRIG_ASSET, XMRIG_PROXY_TAR)} && tar xf ${XMRIG_PROXY_TAR} && chmod +x ${XMRIG_PROXY}`;
}

function xmrigProxyMacDownload() {
  return macTarDownload(XMRIG_PROXY, XMRIG_PROXY_RELEASE_API, XMRIG_PROXY_TAR, XMRIG_PROXY, `if [ "$(uname -m)" != "arm64" ]; then echo "${XMRIG_PROXY_MAC_DOWNLOAD_NOTE}"; exit 1; fi`);
}

function xmrigProxyWindowsDownload() {
  return windowsZipDownload(XMRIG_PROXY_RELEASE_API, WIN64_ZIP_ASSET, "xmrig-proxy.zip", XMRIG_PROXY);
}

function releaseDownload(dir, api, grepCommand, file) {
  return `mkdir -p ~/${dir} && cd ~/${dir}
${releaseAssetDownload(api, grepCommand, file)}`;
}

function releaseAssetDownload(api, grepCommand, file) {
  return `url=$(curl -fsSL ${api} | grep ${BROWSER_DOWNLOAD_URL} | ${grepCommand} | head -1 | cut -d '"' -f 4)
curl -L "$url" -o ${file}`;
}

function downloadMultiMinerLinux() {
  return `asset='mm-v.*-lin\\.tar\\.gz'
case "$(uname -m)" in aarch64|arm64) asset='mm-v.*-lin-arm\\.tar\\.gz';; esac
${releaseAssetDownload(MULTI_MINER_RELEASE_API, 'grep "$asset"', MULTI_MINER_ARCHIVE)} && tar xf ${MULTI_MINER_ARCHIVE}`;
}

function downloadMominer() {
  return `${releaseAssetDownload(MOMINER_RELEASE_API, "grep 'mo-miner-v.*-lin\\.tgz'", MOMINER_ARCHIVE)} && tar --strip-components=1 -xf ${MOMINER_ARCHIVE}`;
}

function srbMinerLinuxAsset() {
  return "grep -Ei 'SRBMiner-Multi-.*-Linux\\.tar\\.(gz|xz)'";
}

function lolMinerLinuxAsset() {
  return "grep -E 'lolMiner_v.*_Lin64\\.tar\\.gz'";
}

function unpackSrbMinerLinux() {
  return `tar xf ${SRBMINER_ARCHIVE} --strip-components=1 && chmod +x ${SRBMINER}`;
}

function unpackLolMinerLinux() {
  return `tar xf ${LOLMINER_ARCHIVE} && cp "$(find . -name lolMiner -type f | head -1)" ${LOLMINER} && chmod +x ${LOLMINER}`;
}

function linuxReleaseDownload(dir, api, grepCommand, file) {
  return `sudo apt-get install curl
${releaseDownload(dir, api, grepCommand, file)}`;
}

function windowsZipDownload(api, pattern, file, dir) {
  return `${windowsAssetDownload(api, pattern, file)}
${windowsExtractZip(file, dir)}`;
}

function windowsExtractZip(file, dir, enterChild = true) {
  return `New-Item -ItemType Directory -Force ${dir} | Out-Null
Expand-Archive ${file} -DestinationPath .\\${dir} -Force
${enterChild ? `$dir=Get-ChildItem .\\${dir} -Directory | ${FIRST_ASSET}
if ($dir) { Set-Location $dir.FullName } else { Set-Location .\\${dir} }` : `Set-Location .\\${dir}`}`;
}

function macTarDownload(dir, api, file, binary, precheck = "") {
  return `mkdir -p ~/${dir} && cd ~/${dir}
${precheck ? `${precheck}\n` : ""}url=$(curl -fsSL ${api} | grep ${BROWSER_DOWNLOAD_URL} | grep 'mac64\\.tar\\.gz' | head -1 | cut -d '"' -f 4)
curl -L "$url" -o ${file} && tar xf ${file} && chmod +x ${binary}
xattr -d com.apple.quarantine ${binary} 2>/dev/null || true`;
}

function windowsAssetDownload(api, pattern, file) {
  return `$r=Invoke-RestMethod ${api}
$a=$r.assets | Where-Object name -match '${pattern}' | ${FIRST_ASSET}
iwr $a.${BROWSER_DOWNLOAD_URL} -OutFile ${file}`;
}

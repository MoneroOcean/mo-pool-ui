import { isFiniteNumber, trimFixed } from "./format.js";
import { HASHRATE_UNITS } from "./constants.js";
import { isXmrAddress } from "./routes.js";

export const POOL_HOST = "gulf.moneroocean.stream";
const DEFAULT_ADDRESS = "YOUR_XMR_ADDRESS";
const LOCAL_PROXY = "127.0.0.1:3333";
const LINUX = "linux";
const MACOS = "macos";
const WINDOWS = "windows";
const INTEL = "intel";
const NVIDIA = "nvidia";
const AMD = "amd";
const NVIDIA_AMD = "gpu";
const GPU_AMBIGUOUS_NOTE = "Select a GPU vendor.";
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
const BZMINER = "bzminer";
const BZMINER_EXE = `${BZMINER}.exe`;
const BZMINER_BIN = `./${BZMINER}`;
const BZMINER_DIR = "bzminer";
const BZMINER_ARCHIVE = `${BZMINER_DIR}.tar.gz`;
const BZMINER_ZIP = `${BZMINER_DIR}.zip`;
const LOLMINER = "lolMiner";
const LOLMINER_EXE = `${LOLMINER}.exe`;
const LOLMINER_BIN = `./${LOLMINER}`;
const LOLMINER_DIR = "lolminer";
const LOLMINER_ARCHIVE = `${LOLMINER_DIR}.tar.gz`;
const LOLMINER_ZIP = `${LOLMINER_DIR}.zip`;
const MOM_DIR = "mom";
const MOM_ARCHIVE = `${MOM_DIR}.tgz`;
const MOM_ZIP = `${MOM_DIR}.zip`;
const MOM = "mom";
const MOM_BIN = `./${MOM}`;
const MOM_CMD = `${MOM}.cmd`;
const MULTI_MINER_DIR = "multi-miner";
const MULTI_MINER_ARCHIVE = "mm.tar.gz";
const GITHUB_RELEASE_API = "https://api.github.com/repos/";
const XMRIG_RELEASE_API = `${GITHUB_RELEASE_API}MoneroOcean/xmrig/releases/latest`;
const SRBMINER_RELEASE_API = `${GITHUB_RELEASE_API}doktor83/SRBMiner-Multi/releases/latest`;
const BZMINER_RELEASE_API = `${GITHUB_RELEASE_API}bzminer/bzminer/releases/latest`;
const LOLMINER_RELEASE_API = `${GITHUB_RELEASE_API}Lolliedieb/lolMiner-releases/releases/latest`;
const MOM_RELEASE_API = `${GITHUB_RELEASE_API}MoneroOcean/mo-miner/releases/latest`;
const MULTI_MINER_RELEASE_API = `${GITHUB_RELEASE_API}MoneroOcean/multi-miner/releases/latest`;
const XMRIG_PROXY_RELEASE_API = `${GITHUB_RELEASE_API}MoneroOcean/xmrig-proxy/releases/latest`;
export const TOR_MINING_HOST = "mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id.onion";
const LINUX_XMRIG_ASSET = "lin-compat\\.tar\\.gz|lin\\.tar\\.gz";
const LINUX_XMRIG_COMPAT_ASSET = "lin-compat\\.tar\\.gz$";
const XMRIG_WINDOWS_ZIP_ASSET = "win\\.zip$";
const WIN64_ZIP_ASSET = "win64\\.zip$";
const XMRIG_PROXY_TAR = "xmrig-proxy.tar.gz";
const BROWSER_DOWNLOAD_URL = "browser_download_url";
const FIRST_ASSET = "Select-Object -First 1";
const KEEPALIVE = "--keepalive";

const SETUP_PROFILES = [
  [XMRIG_MO, "CPU multi", "MoneroOcean XMRig benchmarks CPU algos for XMR payout."],
  [SRB_GPU, "GPU fixed", "Fixed-algo GPU miner setup."],
  [MULTI_MINER, "GPU multi", "Switch GPU algorithms with MoM or Multi-Miner."],
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
  [NVIDIA, "NVIDIA"],
  [AMD, "AMD"]
];

const GPU_ALGO_IDS = ["autolykos2", "kawpow", "etchash", "cn/gpu", "c29", "pearlhash"];
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
  kawpow: "kawpow",
  pearlhash: "pearlhash"
};
const BZ_ALGO = {
  autolykos2: "ergo",
  "cn/gpu": "cn/gpu",
  etchash: "etchash",
  kawpow: "kawpow",
  c29: "c29",
  pearlhash: "pearl"
};
const ETCHASH_EXTRA = " --esm 2 --nicehash true";
const KAWPOW_SLOW_BUILD = " --gpu-table-slow-build";
const MULTI_MINER_ALGOS = Object.keys(SRB_ALGO)
  .filter((name) => name !== "pearlhash")
  .map((name) => [name, SRB_ALGO[name], name === "etchash" ? ETCHASH_EXTRA : ""]);
const WINDOWS_POWERSHELL_BKM = "Open Windows PowerShell (cmd.exe: powershell -NoProfile). Review antivirus alerts; allow only the mining folder if you trust the release.";
const MOM_WINDOWS_BKM = `${WINDOWS_POWERSHELL_BKM} Run install.bat as Administrator for GPU prerequisites.`;
const PORT_METADATA_UNAVAILABLE = "Pool port metadata unavailable from API.";
const TLS_MODE_NOTE = "TLS encrypts pool traffic.";
const PLAIN_MODE_NOTE = "Plain is unencrypted; use only if TLS is unavailable.";
const TOR_MODE_NOTE = "Tor uses the onion host and selected non-TLS port via SOCKS5: 127.0.0.1:9050 (Tor) or 127.0.0.1:9150 (Tor Browser). TLS adds no security over Tor.";
const SRB_RUN_NOTE = "Use --list-devices; start at 1 KH/s if shares stall.";
const PROXY_HOSTS_PORT_3333 = "workers use port 3333.";
const REPLACE_PROXY_HOST = "Replace PROXY_HOST; install XMRig on each worker.";
const XMRIG_AUTO_SWITCH_NOTE = "Keep config.json beside XMRig.";
const SMALL_PROXY_NOTE = "Small proxies: start at 64-128 KH/s.";

const GPU_MINER_LABELS = {
  mom: "MoM",
  [MULTI_MINER]: "Multi-Miner",
  bzminer: "BZMiner",
  srbminer: "SRBMiner-Multi",
  lolminer: "lolMiner"
};

function gpuMinerSupport(miner, gpu, algo, os) {
  const intel = isIntelGpu(gpu);
  const windowsNvidia = os === WINDOWS && gpu === NVIDIA;
  // Tested RX 9060 XT/gfx1200: BZ v100.45 Ergo rejects its Linux binary and builds a wrong Windows table.
  // These are curated vendor-profile recommendations, not a claim about every AMD model.
  if (miner === BZMINER && gpu === AMD && algo === "autolykos2" && [LINUX, WINDOWS].includes(os)) return false;
  if (miner === "lolminer" && os === WINDOWS && gpu === AMD && algo === "c29") return false;
  if (miner === "lolminer") return algo === "c29" && !intel || windowsNvidia && ["autolykos2", "etchash"].includes(algo);
  // On Windows RTX 5060 Ti, SRB had zero-rate CN/GPU, an Ergo kernel error and stalled Etchash initialization.
  if (miner === "srbminer" && windowsNvidia && ["cn/gpu", "autolykos2", "etchash"].includes(algo)) return false;
  if (miner === "srbminer" && (algo === "c29" || intel && algo === "pearlhash")) return false;
  // BZ v100.45 documents no Intel KawPoW implementation; B580 confirms it is skipped.
  return GPU_ALGO_IDS.includes(algo) && !(intel && miner === "bzminer" && ["autolykos2", "etchash", "kawpow"].includes(algo));
}

function normalizeGpuAlgo(algo) {
  if (algo === "prl") return "pearlhash";
  return algo;
}

export function setupGpuMinerOptions({ os = LINUX, gpu = INTEL, algo = GPU_ALGO_IDS[0], profile = SRB_GPU } = {}) {
  const normalizedGpu = gpuId(gpu);
  const normalizedAlgo = normalizeGpuAlgo(algo);
  const intel = isIntelGpu(normalizedGpu);
  if (profile === MULTI_MINER) {
    return ["mom", MULTI_MINER]
      .map((miner) => [miner, GPU_MINER_LABELS[miner]]);
  }
  const srbSupported = gpuMinerSupport("srbminer", normalizedGpu, normalizedAlgo, os);
  const order = intel
    ? ["mom", "bzminer", "srbminer"]
    : ["bzminer", srbSupported ? "srbminer" : "lolminer", "mom"];
  return order
    .filter((miner) => gpuMinerSupport(miner, normalizedGpu, normalizedAlgo, os))
    .map((miner) => {
      const conditional = miner === "bzminer" && normalizedAlgo === "c29" && isIntelGpu(normalizedGpu) ? "Arc Battlemage" : "";
      return [miner, conditional ? `${GPU_MINER_LABELS[miner]} (${conditional})` : GPU_MINER_LABELS[miner]];
    });
}

export function setupAddress({ queryAddress = "", activeAddress = "", watchlist = [] } = {}) {
  return queryAddress || activeAddress || watchlist.find((row) => row?.address)?.address || DEFAULT_ADDRESS;
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
      // Global API exposes web port 80 as the 10001 plain port; TLS port = plain + 10000
      // (20001 for 10001). targetHashrate derives from share difficulty: /10 global, /30 configured.
      const rawPort = Number(row.port);
      const port = global && rawPort === 80 ? 10001 : rawPort;
      const tlsPort = global ? port + 10000 : Number(row.tlsPort);
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
  const requestedAlgo = optionId(normalizeGpuAlgo(options.algo), SETUP_ALGOS, profileUsesAutoAlgo(profile) ? AUTO_ALGO[0] : "rx/0");
  const algo = normalizeProfileAlgo(profile, requestedAlgo);
  const defaultHashrate = setupHashrateDefaults(profile, gpu, algo);
  const hashrateUnit = optionId(options.hashrateUnit, SETUP_HASHRATE_UNITS, defaultHashrate.unit);
  const hashrate = normalizedHashrateInput(options.hashrate, defaultHashrate.value);
  const hashrateHps = setupHashrateToHps(hashrate, hashrateUnit);
  const portRow = portRowForHashrate(hashrateHps, options.ports);
  const address = String(options.address || DEFAULT_ADDRESS).trim() || DEFAULT_ADDRESS;
  const commandAddress = setupCommandAddress(address);
  const worker = workerName(options.worker);
  const port = portRow?.port || 0;
  const pool = `${POOL_HOST}:${port}`;
  const password = profile === XMRIG_MO || algo === AUTO_ALGO[0] ? worker : `${worker}~${algo}`;

  const selection = { profile, os, gpu, algo, miner: "", address, hashrate, hashrateUnit, hashrateHps, port };
  const planOptions = { os, profile, gpu, algo, miner: options.miner, address: commandAddress, worker, password, pool, port, portRow };
  if (!portRow) return withSelection(unavailablePortPlan(), selection);
  if (GPU_PROFILES.includes(profile)) {
    const plan = gpuPlan(planOptions);
    return withSelection(plan, { ...selection, miner: plan.miner });
  }
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

function setupCommandAddress(address) {
  return isXmrAddress(address) ? address : DEFAULT_ADDRESS;
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
  const download = windows
    ? windowsZipDownload(XMRIG_RELEASE_API, XMRIG_WINDOWS_ZIP_ASSET, "xmrig.zip", "moneroocean", XMRIG_EXE)
    : macos
      ? macXmrigDownload()
    : `${linuxReleaseDownload("moneroocean", XMRIG_RELEASE_API, LINUX_XMRIG_COMPAT_ASSET, XMRIG_TAR)} && tar xf ${XMRIG_TAR} && chmod +x ${XMRIG}`;
  const directRun = xmrigRun(binary, pool, address, worker, false, windows);
  const tlsRun = portRow.tlsPort ? xmrigRun(binary, `${POOL_HOST}:${portRow.tlsPort}`, address, worker, true, windows) : "";
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: download,
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: tlsRun,
    tlsRunNote: TLS_MODE_NOTE,
    plainRunCommand: directRun,
    plainRunNote: PLAIN_MODE_NOTE,
    torCommand: windows ? "" : xmrigTorRun({ os, address, worker, port: portRow.port }),
    torNote: windows ? "" : TOR_MODE_NOTE,
    notes: macos
      ? `Best first CPU setup on Macs. The download selects the current Apple Silicon or Intel archive. ${XMRIG_AUTO_SWITCH_NOTE} If Gatekeeper blocks it, remove quarantine and retry.`
      : `Best first setup for CPU mining. ${XMRIG_AUTO_SWITCH_NOTE}`
  };
}

function gpuPlan(args) {
  const options = setupGpuMinerOptions(args);
  // Preserve existing GPU-multi links that did not select a miner.
  const fallback = args.profile === MULTI_MINER ? MULTI_MINER : options[0]?.[0] || "srbminer";
  const miner = optionId(args.miner, options, fallback);
  const minerPlan = miner === "mom"
    ? momPlan(args)
    : miner === MULTI_MINER
      ? multiMinerPlan(args)
      : miner === "bzminer"
        ? bzminerPlan(args)
        : miner === "lolminer"
          ? lolminerPlan(args)
          : srbFixedPlan(args);
  return {
    ...minerPlan,
    notes: `${minerPlan.notes}${args.os === WINDOWS && args.gpu === AMD && ["autolykos2", "c29"].includes(args.algo)
      ? ` On tested RX 9060 XT/gfx1200, ${args.algo === "autolykos2" ? "BZMiner v100.45 Ergo failed table verification; use SRBMiner or MoM" : "lolMiner C29 reported a device crash; use BZMiner or MoM"}. Other AMD models are not established by this result.` : ""}`,
    minerOptions: options,
    miner
  };
}

function srbFixedPlan({ os, gpu, algo, address, worker, password, pool, portRow }) {
  const windows = os === WINDOWS;
  const binary = windows ? windowsLocal(SRBMINER_EXE) : SRBMINER_BIN;
  const srbAlgo = SRB_ALGO[algo] || GPU_ALGO_IDS[0];
  const disable = gpuDisableFlags(gpu);
  // Qualified Windows RTX 5060 Ti needs slow table build before KawPoW hashes.
  const extra = algo === "etchash" ? ETCHASH_EXTRA : windows && gpu === NVIDIA && algo === "kawpow" ? KAWPOW_SLOW_BUILD : "";
  const download = windows
    ? srbWindowsDownload()
    : srbLinuxDownload();
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: download,
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: portRow.tlsPort ? srbRun(binary, disable, srbAlgo, `${POOL_HOST}:${portRow.tlsPort}`, address, password, worker, true, extra) : "",
    tlsRunNote: `${TLS_MODE_NOTE} ${SRB_RUN_NOTE}`,
    plainRunCommand: srbRun(binary, disable, srbAlgo, pool, address, password, worker, false, extra),
    plainRunNote: `${PLAIN_MODE_NOTE} ${SRB_RUN_NOTE}`,
    notes: "Fixed GPU recipe."
  };
}

function multiMinerPlan({ os, gpu, address, pool, portRow }) {
  const windows = os === WINDOWS;
  const intelGpu = isIntelGpu(gpu);
  const bzAlgos = !windows ? [] : gpu === NVIDIA ? ["cn/gpu", "autolykos2"] : gpu === AMD ? ["c29"] : [];
  const lolAlgos = windows && gpu === NVIDIA ? ["etchash"] : [];
  const disable = gpuDisableFlags(gpu);
  const tlsPool = portRow.tlsPort ? `${POOL_HOST}:ssl${portRow.tlsPort}` : pool;
  return {
    summary: setupPoolSummary(tlsPool, portRow, `. MM listens on ${LOCAL_PROXY} for child miners.`),
    downloadCommand: windows
      ? multiMinerWindowsDownload(intelGpu, bzAlgos)
      : multiMinerLinuxDownload(intelGpu),
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: windows ? multiMinerWindowsRun({ address, pool: tlsPool, disable, intelGpu, bzAlgos, lolAlgos, gpu }) : multiMinerLinuxRun({ address, pool: tlsPool, disable, intelGpu }),
    tlsRunNote: TLS_MODE_NOTE,
    notes: `Fixed-algorithm miners use multi-miner for switching; MoM switches directly.${intelGpu ? " This Intel example covers CN/GPU, KawPow, Autolykos2 and Etchash." : ""}`
  };
}

function gpuDisableFlags(gpu) {
  return isIntelGpu(gpu) ? "--disable-gpu-amd --disable-gpu-nvidia" : "";
}

function xmrigRun(binary, pool, address, worker, tls = false, windows = false) {
  return `${binary} ${xmrigConfigArg(windows)} -o ${pool} -u ${address} --rig-id ${worker} ${KEEPALIVE}${tls ? " --tls" : ""}`;
}

function xmrigConfigArg(windows = false) {
  return windows ? '--config=".\\config.json"' : "--config=./config.json";
}

function srbRun(binary, disable, algo, pool, address, password, worker, tls, extra = "") {
  return `${binary} ${srbCommon(disable, pool, address, worker)} --algorithm ${algo} --password ${password} --tls ${srbTlsValue(tls)}${extra}`;
}

function srbTlsValue(tls) {
  return tls ? "true" : "false";
}

function srbCommon(disable, pool, address, worker, binary = "") {
  return [binary, "--disable-cpu", disable, "--pool", pool, "--wallet", address, "--worker", worker, "--gpu-id", "0", "--keepalive", "true"].filter(Boolean).join(" ");
}

function lolminerPlan({ os, algo, address, password, pool, portRow }) {
  const windows = os === WINDOWS;
  const binary = windows ? windowsLocal(LOLMINER_EXE) : LOLMINER_BIN;
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: windows ? lolminerWindowsDownload() : lolminerLinuxDownload(),
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: portRow.tlsPort ? lolminerRun(binary, algo, `${POOL_HOST}:${portRow.tlsPort}`, address, password, true) : "",
    tlsRunNote: TLS_MODE_NOTE,
    plainRunCommand: lolminerRun(binary, algo, pool, address, password, false),
    plainRunNote: PLAIN_MODE_NOTE,
    notes: `Fixed ${algo === "autolykos2" ? "Autolykos2" : algo === "etchash" ? "Etchash" : "C29"} recipe.${algo === "etchash" ? " SRBMiner stalled on the tested Windows RTX 5060 Ti; other NVIDIA models are not established by this result." : ""}`
  };
}

function bzminerPlan({ os, algo, address, password, pool, portRow }) {
  const windows = os === WINDOWS;
  const binary = windows ? windowsLocal(BZMINER_EXE) : BZMINER_BIN;
  const tlsPool = portRow.tlsPort ? `${POOL_HOST}:${portRow.tlsPort}` : pool;
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: windows ? bzminerWindowsDownload() : bzminerLinuxDownload(),
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: portRow.tlsPort ? bzminerRun(binary, algo, tlsPool, address, password, true) : "",
    tlsRunNote: TLS_MODE_NOTE,
    plainRunCommand: bzminerRun(binary, algo, pool, address, password, false),
    plainRunNote: PLAIN_MODE_NOTE,
    notes: "Fixed GPU recipe."
  };
}

function momPlan({ os, gpu, algo, address, password, pool, portRow }) {
  const windows = os === WINDOWS;
  const binary = windows ? windowsLocal(MOM_CMD) : MOM_BIN;
  return {
    summary: setupPoolSummary(pool, portRow),
    downloadCommand: windows ? momWindowsDownload() : momLinuxDownload(),
    downloadNote: windows ? MOM_WINDOWS_BKM : "",
    tlsRunCommand: portRow.tlsPort ? momRun(binary, `${POOL_HOST}:${portRow.tlsPort}tls`, address, password, algo, gpu, windows) : "",
    tlsRunNote: TLS_MODE_NOTE,
    plainRunCommand: momRun(binary, pool, address, password, algo, gpu, windows),
    plainRunNote: PLAIN_MODE_NOTE,
    notes: gpu === NVIDIA_AMD ? GPU_AMBIGUOUS_NOTE
      : algo === AUTO_ALGO[0]
        ? "MoM benchmarks and switches GPU algorithms, including donations. This example selects gpu1 only. Run mom algorithms with the same GPU backend and replace gpu1 with your reported GPU device."
        : "Select GPU: mom algorithms, then --job.dev gpuN."
  };
}

function bzminerRun(binary, algo, pool, address, password, tls) {
  const endpoint = `stratum+${tls ? "ssl" : "tcp"}://${pool}`;
  const bzAlgo = BZ_ALGO[algo] || algo;
  // BZMiner enables CPU by default; fixed GPU recipes must scope it off explicitly.
  return `${binary} -a ${bzAlgo} -p ${endpoint} -w ${address} --pass ${password} --cpu 0`;
}

function lolminerRun(binary, algo, pool, address, password, tls) {
  const algorithm = algo === "autolykos2" ? "AUTOLYKOS2" : algo === "etchash" ? "ETCHASH" : "CR29";
  return `${binary} --algo ${algorithm} --pool ${pool} --user ${address} --pass ${password}${algo === "etchash" ? " --ethstratum ETHV1" : ""}${tls ? " --tls on" : ""}`;
}

function momRun(binary, pool, address, password, algo = "c29", gpu, windows = false) {
  const backend = isIntelGpu(gpu) ? INTEL : gpu === NVIDIA || gpu === AMD ? gpu : null;
  if (!backend) return "";
  const launch = windows ? `$env:MOM_GPU_BACKEND='${backend}'; & ${binary}` : `MOM_GPU_BACKEND=${backend} ${binary}`;
  if (algo !== AUTO_ALGO[0]) {
    return `${launch} mine ${pool} ${address} ${password} --job.algo ${algo} --bench_algo_params 0`;
  }
  return `${launch} mine ${pool} ${address} ${password} --job.dev gpu1`;
}

function multiMinerAlgoArgs({ srbminer, lineContinuation, intelGpu, lolminer, wallet, bzminer = "", bzAlgos = [], lolAlgos = [], srbKawExtra = "" }) {
  // AMD's BZ alternative is C29 only; keep its Ergo path on SRBMiner.
  const commands = MULTI_MINER_ALGOS.map(([name, algorithm, extra]) => [name, bzAlgos.includes(name)
    ? bzminerRun(bzminer, name, LOCAL_PROXY, wallet, "mm", false)
    : lolAlgos.includes(name) ? lolminerRun(lolminer, name, LOCAL_PROXY, wallet, "x", false)
    : `${srbminer} --algorithm ${algorithm} --password x${extra}${name === "kawpow" ? srbKawExtra : ""}`]);
  // MoM switches directly; Intel lacks fixed-miner Pearl/C29 entries here.
  if (!intelGpu) {
    commands.push(["pearlhash", `${srbminer} --algorithm pearlhash --password x`]);
    commands.push(["c29", bzAlgos.includes("c29") ? bzminerRun(bzminer, "c29", LOCAL_PROXY, wallet, "mm", false)
      : `${lolminer} --algo CR29 --pool ${LOCAL_PROXY} --user ${wallet} --pass x`]);
  }
  return commands
    .map(([name, command]) => `  --${name}="${command}"`)
    .join(` ${lineContinuation}\n`);
}

function multiMinerLinuxRun({ address, pool, disable, intelGpu }) {
  return `WALLET='${address}'
POOL='${pool}'
LOCAL_PROXY='${LOCAL_PROXY}'
${intelGpu ? "" : `LOLMINER='${LOLMINER_BIN}'`}
${disable ? `GPU_FLAGS='${disable}'\n` : ""}SRBMINER="${srbCommon(disable ? "$GPU_FLAGS" : "", "$LOCAL_PROXY", "$WALLET", "mm", SRBMINER_BIN)} --tls false"

./mm --no-config-save --pool="$POOL" --user="$WALLET" --pass=x --algo_min_time=60 \\
${multiMinerAlgoArgs({ srbminer: "$SRBMINER", lineContinuation: "\\", intelGpu, lolminer: "$LOLMINER", wallet: "$WALLET" })}`;
}

function multiMinerWindowsRun({ address, pool, disable, intelGpu, bzAlgos, lolAlgos, gpu }) {
  return `$Wallet="${address}"
$Pool="${pool}"
$LocalProxy="${LOCAL_PROXY}"
${bzAlgos.length ? `$Bzminer="${windowsLocal(BZMINER_EXE)}"\n` : ""}
${intelGpu || bzAlgos.includes("c29") ? "" : `$Lolminer="${windowsLocal(LOLMINER_EXE)}"`}
${disable ? `$GpuFlags="${disable}"\n` : ""}$Srbminer="${srbCommon(disable ? "$GpuFlags" : "", "$LocalProxy", "$Wallet", "mm", windowsLocal(SRBMINER_EXE))} --tls false"

${windowsLocal("mm.exe")} --no-config-save --pool="$Pool" --user="$Wallet" --pass=x --algo_min_time=60 \`
${multiMinerAlgoArgs({ srbminer: "$Srbminer", lineContinuation: "`", intelGpu, lolminer: "$Lolminer", wallet: "$Wallet", bzminer: bzAlgos.length ? "$Bzminer" : "", bzAlgos, lolAlgos, srbKawExtra: gpu === NVIDIA ? KAWPOW_SLOW_BUILD : "" })}`;
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
    downloadNote: windows ? WINDOWS_POWERSHELL_BKM : "",
    tlsRunCommand: proxyRunCommand,
    tlsRunNote: TLS_MODE_NOTE,
    localCommand: `${windows ? windowsLocal(XMRIG_EXE) : XMRIG_BIN} ${xmrigConfigArg(windows)} -o PROXY_HOST:3333 -u ${worker} --nicehash --donate-over-proxy 1 ${KEEPALIVE}`,
    localNote: `Worker miners connect to this proxy on port 3333 using NiceHash-compatible mode. ${REPLACE_PROXY_HOST}`,
    notes: `${macos ? "The download selects the current Apple Silicon or Intel archive. " : ""}Share one upstream connection between XMRig CPU workers. ${SMALL_PROXY_NOTE} Use MoneroOcean XMRig for algo switching; use GPU fixed or Multi-Miner for GPUs.`
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
    localCommand: `${XMRIG_BIN} ${xmrigConfigArg()} -o PROXY_HOST:3333 -u ${worker}`,
    localNote: `Worker miners connect to xmr-node-proxy on port 3333. ${REPLACE_PROXY_HOST}`,
    notes: `Preinstall Node.js 22.9.0+ and npm 11.10.0+ on PATH; install.sh checks them before changing system packages. Use for many CPU workers on XMR-style algorithms. ${SMALL_PROXY_NOTE} Generated xmr-node-proxy config is an rx/0 starter config. Add real algo_perf for full switching. Not for Etchash, KawPow, Autolykos2, or XTM/Tari c29.`
  };
}

function xmrigTorRun({ os, address, worker, port }) {
  const setup = os === MACOS
    ? "brew install tor && brew services start tor"
    : "sudo apt-get install tor && sudo systemctl enable --now tor";
  return `${setup}
${XMRIG_BIN} ${xmrigConfigArg()} -o ${TOR_MINING_HOST}:${port} -x 127.0.0.1:9050 -u ${address} --rig-id ${worker} ${KEEPALIVE}`;
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
  return optionId(value ?? INTEL, SETUP_GPU_VENDORS, NVIDIA_AMD);
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

function srbLinuxDownload() {
  return `${linuxReleaseDownload(SRBMINER_DIR, SRBMINER_RELEASE_API, srbMinerLinuxAsset(), SRBMINER_ARCHIVE, ["wget"])} && ${unpackSrbMinerLinux()}`;
}

function srbWindowsDownload() {
  return windowsZipDownload(SRBMINER_RELEASE_API, WIN64_ZIP_ASSET, SRBMINER_ZIP, SRBMINER_DIR, SRBMINER_EXE);
}

function bzminerLinuxDownload() {
  return `${linuxReleaseDownload(BZMINER_DIR, BZMINER_RELEASE_API, "bzminer_.*_linux\\.tar\\.gz$", BZMINER_ARCHIVE)} && tar xf ${BZMINER_ARCHIVE} --strip-components=1 && chmod +x ${BZMINER}`;
}

function bzminerWindowsDownload() {
  return windowsZipDownload(BZMINER_RELEASE_API, "bzminer_.*_windows\\.zip$", BZMINER_ZIP, BZMINER_DIR, BZMINER_EXE);
}

function lolminerLinuxDownload() {
  return `${linuxReleaseDownload(LOLMINER_DIR, LOLMINER_RELEASE_API, lolMinerLinuxAsset(), LOLMINER_ARCHIVE)} && ${unpackLolMinerLinux()}`;
}

function lolminerWindowsDownload() {
  return windowsZipDownload(LOLMINER_RELEASE_API, WIN64_ZIP_ASSET, LOLMINER_ZIP, LOLMINER_DIR, LOLMINER_EXE);
}

function momLinuxDownload() {
  return `sudo apt-get install -y curl jq
mkdir -p ~/${MOM_DIR} && cd ~/${MOM_DIR}
${unixReleaseDownloadHelper()}
${downloadMom()} && chmod +x ${MOM}
sudo ./install.sh`;
}

function momWindowsDownload() {
  return `${windowsZipDownload(MOM_RELEASE_API, "mom-v.*-win\\.zip$", MOM_ZIP, MOM_DIR, MOM_CMD)}
.\\install.bat`;
}

// Release layouts vary; locate the expected executable and copy its siblings.
function windowsExpandFlatten(zip, expectedFile) {
  // Only fixed filenames or our function parameters reach these quoted arguments.
  return `$stage = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
try {
  Expand-Archive -LiteralPath "${zip}" -DestinationPath $stage -Force -ErrorAction Stop
  $miner = @(Get-ChildItem -LiteralPath $stage -Recurse -File -Filter "${expectedFile}" -ErrorAction Stop)
  if ($miner.Count -ne 1) { throw 'Expected one staged miner file' }
  Get-ChildItem -LiteralPath $miner[0].Directory.FullName -Force -ErrorAction Stop | Copy-Item -Destination . -Recurse -Force -ErrorAction Stop
} finally {
  Remove-Item -LiteralPath $stage -Recurse -Force
}`;
}

function multiMinerLinuxDownload(intelGpu) {
  return `sudo apt-get install -y curl jq wget
mkdir -p ~/${MULTI_MINER_DIR} && cd ~/${MULTI_MINER_DIR}
${unixReleaseDownloadHelper()}
${downloadMultiMinerLinux()} && chmod +x mm
${releaseAssetDownload(SRBMINER_RELEASE_API, srbMinerLinuxAsset(), SRBMINER_ARCHIVE)} &&
  ${unpackSrbMinerLinux()}
${intelGpu ? "" : `${releaseAssetDownload(LOLMINER_RELEASE_API, lolMinerLinuxAsset(), LOLMINER_ARCHIVE)} &&
  ${unpackLolMinerLinux()}`}`;
}

function multiMinerWindowsDownload(intelGpu, bzAlgos) {
  const expand = (zip, expectedFile) => `Expand-MinerArchive '${zip}' '${expectedFile}'`;
  const staging = `function Expand-MinerArchive($zip, $expectedFile) {
${windowsExpandFlatten("$zip", "$expectedFile").replace(/^/gm, "  ")}
}
`;
  return `${staging}${windowsAssetDownload(MULTI_MINER_RELEASE_API, "mm-v.*-win\\.zip$", "mm.zip")}
${windowsExtractZip("mm.zip", MULTI_MINER, "mm.exe", expand)}
${windowsAssetDownload(SRBMINER_RELEASE_API, WIN64_ZIP_ASSET, SRBMINER_ZIP)}
${expand(SRBMINER_ZIP, SRBMINER_EXE)}
${intelGpu || bzAlgos.includes("c29") ? "" : `${windowsAssetDownload(LOLMINER_RELEASE_API, WIN64_ZIP_ASSET, LOLMINER_ZIP)}
${expand(LOLMINER_ZIP, LOLMINER_EXE)}`}${bzAlgos.length ? `\n${windowsAssetDownload(BZMINER_RELEASE_API, "bzminer_.*_windows\\.zip$", BZMINER_ZIP)}
${expand(BZMINER_ZIP, BZMINER_EXE)}` : ""}`;
}

function xmrigProxyLinuxDownload() {
  return `${linuxReleaseDownload(XMRIG_PROXY, XMRIG_PROXY_RELEASE_API, LINUX_XMRIG_ASSET, XMRIG_PROXY_TAR)} && tar xf ${XMRIG_PROXY_TAR} && chmod +x ${XMRIG_PROXY}`;
}

function xmrigProxyMacDownload() {
  return macTarDownload(XMRIG_PROXY, XMRIG_PROXY_RELEASE_API, XMRIG_PROXY_TAR, XMRIG_PROXY);
}

function xmrigProxyWindowsDownload() {
  return windowsZipDownload(XMRIG_PROXY_RELEASE_API, XMRIG_WINDOWS_ZIP_ASSET, "xmrig-proxy.zip", XMRIG_PROXY, "xmrig-proxy.exe");
}

function unixReleaseDownloadHelper() {
  return `download_release() {
  local url
  url=$(set -o pipefail
    curl -fsSL "https://api.github.com/repos/$1/releases/latest" |
      jq -er --arg asset "$2" --arg prefix "https://github.com/$1/releases/download/" '
        .assets | if type == "array" then . else error("Expected release assets") end
        | map(select(type == "object") | select(.name | type == "string")
          | select(.name | test($asset; "i")) | .browser_download_url
          | select(type == "string")
          | select(startswith($prefix) and test("^https://[-A-Za-z0-9._~:/%+]+$")))
        | first') || { echo 'No matching release asset' >&2; exit 1; }
  curl -fL -o "$3" -- "$url"
}`;
}

function releaseAssetDownload(api, pattern, file) {
  const repo = api.replace(GITHUB_RELEASE_API, "").replace(/\/releases\/latest$/, "");
  // Patterns and repositories are fixed recipes; only the architecture's $asset is expanded.
  const asset = pattern === "$asset" ? '"$asset"' : `'${pattern}'`;
  return `download_release ${repo} ${asset} ${file}`;
}

function downloadMultiMinerLinux() {
  return `asset='mm-v.*-lin\\.tar\\.gz'
case "$(uname -m)" in aarch64|arm64) asset='mm-v.*-lin-arm\\.tar\\.gz';; esac
${releaseAssetDownload(MULTI_MINER_RELEASE_API, "$asset", MULTI_MINER_ARCHIVE)} &&
  tar xf ${MULTI_MINER_ARCHIVE}`;
}

function downloadMom() {
  return `${releaseAssetDownload(MOM_RELEASE_API, "mom-v.*-lin\\.tgz$", MOM_ARCHIVE)} && tar --strip-components=1 -xf ${MOM_ARCHIVE}`;
}

function srbMinerLinuxAsset() {
  return "SRBMiner-Multi-.*-Linux\\.tar\\.(gz|xz)$";
}

function lolMinerLinuxAsset() {
  return "lolMiner_v.*_Lin64\\.tar\\.gz$";
}

function unpackSrbMinerLinux() {
  return `tar xf ${SRBMINER_ARCHIVE} --strip-components=1 && chmod +x ${SRBMINER}`;
}

function unpackLolMinerLinux() {
  return `tar xf ${LOLMINER_ARCHIVE} && cp "$(find . -name lolMiner -type f | head -1)" ${LOLMINER} && chmod +x ${LOLMINER}`;
}

function linuxReleaseDownload(dir, api, pattern, file, extraPackages = []) {
  return `sudo apt-get install ${["curl", "jq", ...extraPackages].join(" ")}
mkdir -p ~/${dir} && cd ~/${dir}
${unixReleaseDownloadHelper()}
${releaseAssetDownload(api, pattern, file)}`;
}

function windowsZipDownload(api, pattern, file, dir, expectedFile) {
  return `${windowsAssetDownload(api, pattern, file)}
${windowsExtractZip(file, dir, expectedFile)}`;
}

function windowsExtractZip(file, dir, expectedFile, expand = windowsExpandFlatten) {
  return `New-Item -ItemType Directory -Force ${dir} -ErrorAction Stop | Out-Null
Set-Location -LiteralPath .\\${dir} -ErrorAction Stop
${expand(`..\\${file}`, expectedFile)}`;
}

function macTarDownload(dir, api, file, binary) {
  return `brew install jq
mkdir -p ~/${dir} && cd ~/${dir}
${unixReleaseDownloadHelper()}
asset='mac\\.tar\\.gz$'
case "$(uname -m)" in x86_64|amd64) asset='mac-intel\\.tar\\.gz$';; esac
${releaseAssetDownload(api, "$asset", file)} && tar xf ${file} && chmod +x ${binary}
xattr -d com.apple.quarantine ${binary} 2>/dev/null || true`;
}

function windowsAssetDownload(api, pattern, file) {
  const prefix = api.replace("https://api.github.com/repos/", "https://github.com/").replace(/\/releases\/latest$/, "/releases/download/");
  return `$r=Invoke-RestMethod ${api} -ErrorAction Stop
$a=$r.assets | Where-Object name -match '${pattern}' | ${FIRST_ASSET}
if (!$a -or $a.${BROWSER_DOWNLOAD_URL} -isnot [string] -or !$a.${BROWSER_DOWNLOAD_URL}.StartsWith('${prefix}') -or $a.${BROWSER_DOWNLOAD_URL} -cnotmatch '^https://[-A-Za-z0-9._~:/%+]+\\z') { throw 'No matching release asset' }
iwr $a.${BROWSER_DOWNLOAD_URL} -OutFile ${file} -ErrorAction Stop`;
}

import { isFiniteNumber } from "./format.js";

export const POOL_HOST = "gulf.moneroocean.stream";
const LOCAL_PROXY = "127.0.0.1:3333";
const XMRIG_RELEASE_API = "https://api.github.com/repos/MoneroOcean/xmrig/releases/latest";
const SRBMINER_RELEASE_API = "https://api.github.com/repos/doktor83/SRBMiner-Multi/releases/latest";
const META_MINER_RELEASE_API = "https://api.github.com/repos/MoneroOcean/meta-miner/releases/latest";
const XMRIG_PROXY_RELEASE_API = "https://api.github.com/repos/MoneroOcean/xmrig-proxy/releases/latest";
export const TOR_MINING_HOST = "mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id.onion";

const SETUP_PROFILES = [
  ["xmrig-mo", "CPU multi", "MoneroOcean XMRig benchmarks CPU algos for XMR payout."],
  ["srb-gpu", "GPU fixed", "SRBMiner-Multi for AMD, NVIDIA, and Intel GPUs."],
  ["meta-miner", "GPU multi", "Wrapper that lets fixed-algo GPU miners switch with pool conditions."],
  ["xmrig-proxy", "xmrig-proxy", "Many XMRig CPU workers behind one local proxy."],
  ["xmr-node-proxy", "xmr-node-proxy", "Larger CPU farms; keep GPU miners direct or behind meta-miner."]
];

export const SETUP_OS = [
  ["linux", "Linux/Ubuntu"],
  ["macos", "macOS"],
  ["windows", "Windows"]
];

export const SETUP_HASHRATE_UNITS = [
  ["h", "H/s", 1],
  ["kh", "KH/s", 1000],
  ["mh", "MH/s", 1000000]
];

export const SETUP_GPU_VENDORS = [
  ["intel", "Intel"],
  ["nvidia", "NVIDIA"],
  ["amd", "AMD"]
];

const SETUP_ALGOS = [
  ["auto", "Auto switch"],
  ["autolykos2", "autolykos2"],
  ["kawpow", "kawpow"],
  ["etchash", "etchash"],
  ["cn/gpu", "cn/gpu"]
];

const SRB_ALGO = {
  autolykos2: "autolykos2",
  "cn/gpu": "cryptonight_gpu",
  etchash: "etchash",
  kawpow: "kawpow"
};
const GPU_ALGOS = new Set(Object.keys(SRB_ALGO));
const META_MINER_ALGOS = [
  ["autolykos2", "autolykos2", ""],
  ["kawpow", "kawpow", ""],
  ["etchash", "etchash", " --esm 2 --nicehash true"],
  ["cn/gpu", "cryptonight_gpu", ""]
];
const WINDOWS_POWERSHELL_BKM = "Open Windows PowerShell first. From cmd.exe, run: powershell -NoProfile";
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

export function setupAlgoOptions(profile = "xmrig-mo") {
  const normalized = profileId(profile);
  if (normalized === "srb-gpu") return SETUP_ALGOS.filter(([id]) => GPU_ALGOS.has(id));
  return [["auto", "Auto switch"]];
}

export function setupProfileOptions(os = "linux") {
  const normalized = optionId(os, SETUP_OS, "linux");
  if (normalized === "macos") return SETUP_PROFILES.filter((row) => ["xmrig-mo", "xmrig-proxy", "xmr-node-proxy"].includes(row[0]));
  if (normalized === "windows") return SETUP_PROFILES.filter((row) => row[0] !== "xmr-node-proxy");
  return SETUP_PROFILES;
}

export function setupHashrateDefaults(profile = "xmrig-mo", gpu = "intel") {
  const normalized = profileId(profile);
  if (normalized === "xmrig-proxy") return { value: 64, unit: "kh" };
  if (normalized === "xmr-node-proxy") return { value: 128, unit: "kh" };
  if (normalized === "srb-gpu" || normalized === "meta-miner") {
    return gpu === "intel" ? { value: 128, unit: "kh" } : { value: 512, unit: "kh" };
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
  const rows = Array.isArray(source) ? source : Array.isArray(source?.configured) ? source.configured : [];
  // Internal configured-port rows are tuples to avoid repeating long backend
  // field names after normalization: [plain port, TLS port, target H/s, label].
  // The backend input fields stay descriptive because they are external API
  // contracts, while setup plan code only needs this compact private shape.
  return rows
    .map((row) => {
      if (Array.isArray(row)) return [Number(row[0]) || 0, Number(row[1]) || 0, Number(row[2]) || 0, String(row[3] || "").trim()];
      const port = Number(row.port);
      const tlsPort = Number(row.tlsPort);
      const difficulty = Number(row.difficulty);
      const targetHashrate = Number(row.targetHashrate) || (isFiniteNumber(difficulty) && difficulty > 0 ? difficulty / 30 : 0);
      return [isFiniteNumber(port) && port > 0 ? port : 0, isFiniteNumber(tlsPort) && tlsPort > 0 ? tlsPort : 0, targetHashrate, String(row.description || "").trim()];
    })
    .filter((row) => row[0] > 0 && row[2] > 0)
    .sort((a, b) => a[2] - b[2] || a[0] - b[0]);
}

export function setupPlan(options = {}) {
  const os = optionId(options.os, SETUP_OS, "linux");
  const profile = profileId(options.profile, os);
  const gpu = optionId(options.gpu, SETUP_GPU_VENDORS, "intel");
  const requestedAlgo = optionId(options.algo, SETUP_ALGOS, profileUsesAutoAlgo(profile) ? "auto" : "rx/0");
  const algo = normalizeProfileAlgo(profile, requestedAlgo);
  const defaultHashrate = setupHashrateDefaults(profile, gpu);
  const hashrateUnit = optionId(options.hashrateUnit, SETUP_HASHRATE_UNITS, defaultHashrate.unit);
  const hashrate = normalizedHashrateInput(options.hashrate, defaultHashrate.value);
  const hashrateHps = setupHashrateToHps(hashrate, hashrateUnit);
  const portRow = portRowForHashrate(hashrateHps, options.ports);
  const address = String(options.address || "YOUR_XMR_ADDRESS").trim() || "YOUR_XMR_ADDRESS";
  const worker = workerName(options.worker);
  const port = portRow?.p || 0;
  const pool = `${POOL_HOST}:${port}`;
  const password = profile === "xmrig-mo" || algo === "auto" ? worker : `${worker}~${algo}`;

  const s = { pr: profile, os, g: gpu, al: algo, a: address, hr: hashrate, hu: hashrateUnit, hh: hashrateHps, p: port };
  if (!portRow) return withSelection(unavailablePortPlan(), s);
  if (profile === "srb-gpu") return withSelection(srbPlan({ os, gpu, algo, address, worker, password, pool, portRow }), s);
  if (profile === "meta-miner") return withSelection(metaMinerPlan({ os, gpu, address, worker, pool, portRow }), s);
  if (profile === "xmrig-proxy") return withSelection(xmrigProxyPlan({ os, address, worker, pool, portRow }), s);
  if (profile === "xmr-node-proxy") return withSelection(xmrNodeProxyPlan({ os, address, worker, port, portRow }), s);
  return withSelection(xmrigPlan({ os, address, worker, pool, portRow }), s);
}

function withSelection(plan, s) {
  return { ...plan, s };
}

function unavailablePortPlan() {
  return { tt: "Setup unavailable", sm: PORT_METADATA_UNAVAILABLE, d: "", dn: "", rt: "", rtn: "", r: "", rn: "", to: "", ton: "", l: "", ln: "", nt: `${PORT_METADATA_UNAVAILABLE} Reload after the API returns configured ports.` };
}

/*
Private setup-plan keys are short because this object is generated often in the
setup UI and every property name ships in the raw JS bundle. Visible command
text, route query parameters, miner flags, and tests stay descriptive. Map:
  tt title, sm summary, d download command, dn download note,
  rt TLS run command, rtn TLS run note, r plain run command, rn plain run note,
  to Tor command, ton Tor note, l local/proxy worker command, ln local note,
  nt notes, s selection. Selection keys: pr profile, os operating system,
  g GPU vendor, al algorithm, a address, hr hashrate, hu hashrate unit,
  hh hashrate in H/s, p selected port.
*/

function xmrigPlan({ os, address, worker, pool, portRow }) {
  const windows = os === "windows";
  const macos = os === "macos";
  const binary = windows ? "xmrig.exe" : "./xmrig";
  const d = windows
    ? windowsZipDownload(XMRIG_RELEASE_API, "win64\\.zip$", "xmrig.zip", "moneroocean")
    : macos
      ? macXmrigDownload()
    : `${linuxReleaseDownload("moneroocean", XMRIG_RELEASE_API, "grep -E 'lin64-compat|lin64\\.tar\\.gz'", "xmrig.tar.gz")} && tar xf xmrig.tar.gz && chmod +x xmrig`;
  const directRun = xmrigRun(binary, pool, address, worker);
  const tlsRun = portRow.t ? xmrigRun(binary, `${POOL_HOST}:${portRow.t}`, address, worker, true) : "";
  return {
    sm: `${pool} is derived from ${portRow.h}.`,
    d,
    dn: windows ? WINDOWS_POWERSHELL_BKM : macos ? XMRIG_MAC_DOWNLOAD_NOTE : "",
    rt: tlsRun,
    rtn: TLS_MODE_NOTE,
    r: directRun,
    rn: PLAIN_MODE_NOTE,
    to: windows ? "" : xmrigTorRun({ os, address, worker, port: portRow.p }),
    ton: windows ? "" : TOR_MODE_NOTE,
    l: "",
    ln: "",
    nt: macos
      ? `Best first CPU setup on Apple Silicon Macs. Intel macOS is not supported by this download. ${XMRIG_AUTO_SWITCH_NOTE} If Gatekeeper blocks it, remove quarantine and retry.`
      : `Best first setup for CPU mining. ${XMRIG_AUTO_SWITCH_NOTE}`
  };
}

function srbPlan({ os, gpu, algo, address, worker, password, pool, portRow }) {
  const windows = os === "windows";
  const binary = windows ? "SRBMiner-MULTI.exe" : "./SRBMiner-MULTI";
  const srbAlgo = SRB_ALGO[algo] || "autolykos2";
  const disable = gpuDisableFlags(gpu);
  const ethExtra = algo === "etchash" ? " --esm 2 --nicehash true" : "";
  const d = windows
    ? srbWindowsDownload()
    : srbLinuxDownload();
  return {
    sm: `${pool} is derived from ${portRow.h}.`,
    d,
    dn: windows ? WINDOWS_POWERSHELL_BKM : "",
    rt: portRow.t ? srbRun(binary, disable, srbAlgo, `${POOL_HOST}:${portRow.t}`, address, password, worker, true, ethExtra) : "",
    rtn: `${TLS_MODE_NOTE} ${SRB_RUN_NOTE}`,
    r: srbRun(binary, disable, srbAlgo, pool, address, password, worker, false, ethExtra),
    rn: PLAIN_MODE_NOTE,
    l: "",
    ln: "",
    nt: "SRBMiner-Multi is used for fixed algo GPU mining."
  };
}

function metaMinerPlan({ os, gpu, address, worker, pool, portRow }) {
  const windows = os === "windows";
  const disable = gpuDisableFlags(gpu);
  const tlsPool = portRow.t ? `${POOL_HOST}:ssl${portRow.t}` : pool;
  return {
    sm: `${tlsPool} is derived from ${portRow.h}. Meta-miner listens on ${LOCAL_PROXY} for child miners.`,
    d: windows
      ? metaMinerWindowsDownload()
      : metaMinerLinuxDownload(),
    dn: windows ? WINDOWS_POWERSHELL_BKM : "",
    rt: windows ? metaMinerWindowsRun({ address, worker, pool: tlsPool, disable }) : metaMinerLinuxRun({ address, worker, pool: tlsPool, disable }),
    rtn: TLS_MODE_NOTE,
    r: "",
    rn: "",
    l: "",
    ln: "",
    nt: "Use this only for GPU algo switching; fixed GPU setup is simpler. First run benchmarks/autotunes configured algorithms before normal mining output appears."
  };
}

function gpuDisableFlags(gpu) {
  if (gpu === "intel") return "--disable-gpu-amd --disable-gpu-nvidia";
  if (gpu === "nvidia") return "--disable-gpu-amd --disable-gpu-intel";
  return "--disable-gpu-nvidia --disable-gpu-intel";
}

function xmrigRun(binary, pool, address, worker, tls = false) {
  return `${binary} -o ${pool} -u ${address} --rig-id ${worker} --keepalive${tls ? " --tls" : ""}`;
}

function srbRun(binary, disable, algo, pool, address, password, worker, tls, extra = "") {
  return `${binary} ${srbCommon(disable, pool, address, worker)} --algorithm ${algo} --password ${password} --tls ${tls}${extra}`;
}

function srbCommon(disable, pool, address, worker, binary = "") {
  return `${binary ? `${binary} ` : ""}--disable-cpu ${disable} --pool ${pool} --wallet ${address} --worker ${worker} --gpu-id 0 --keepalive true`;
}

function metaMinerAlgoArgs(common, worker, lineContinuation) {
  return META_MINER_ALGOS
    .map(([name, algorithm, extra]) => `  --${name}="${common} --algorithm ${algorithm} --password ${worker}~${name}${extra}"`)
    .join(` ${lineContinuation}\n`);
}

function metaMinerLinuxRun({ address, worker, pool, disable }) {
  return `WALLET='${address}'
WORKER='${worker}'
POOL='${pool}'
LOCAL_PROXY='${LOCAL_PROXY}'
SRB='./SRBMiner-MULTI'
GPU_FLAGS='${disable}'
COMMON="${srbCommon("$GPU_FLAGS", "$LOCAL_PROXY", "$WALLET", "$WORKER", "$SRB")} --tls false"

node ./mm.js --no-config-save --pool="$POOL" --user="$WALLET" --algo_min_time=60 \\
${metaMinerAlgoArgs("$COMMON", "$WORKER", "\\")}`;
}

function metaMinerWindowsRun({ address, worker, pool, disable }) {
  return `$Wallet="${address}"
$Worker="${worker}"
$Pool="${pool}"
$LocalProxy="${LOCAL_PROXY}"
$Srb="SRBMiner-MULTI.exe"
$GpuFlags="${disable}"
$Common="${srbCommon("$GpuFlags", "$LocalProxy", "$Wallet", "$Worker", "$Srb")} --tls false"

mm.exe --no-config-save --pool="$Pool" --user="$Wallet" --algo_min_time=60 \`
${metaMinerAlgoArgs("$Common", "$Worker", "`")}`;
}

function xmrigProxyPlan({ os, address, worker, pool, portRow }) {
  const windows = os === "windows";
  const macos = os === "macos";
  const binary = windows ? "xmrig-proxy.exe" : "./xmrig-proxy";
  const tlsPool = portRow.t ? `${POOL_HOST}:${portRow.t}` : pool;
  const r = `${binary} -o ${tlsPool} -u ${address} --bind 0.0.0.0:3333 --mode nicehash --keepalive --tls`;
  return {
    sm: `${tlsPool} is derived from ${portRow.h}; ${PROXY_HOSTS_PORT_3333}`,
    d: windows
      ? xmrigProxyWindowsDownload()
      : macos
        ? xmrigProxyMacDownload()
        : xmrigProxyLinuxDownload(),
    dn: windows ? WINDOWS_POWERSHELL_BKM : macos ? XMRIG_PROXY_MAC_DOWNLOAD_NOTE : "",
    rt: r,
    rtn: TLS_MODE_NOTE,
    r: "",
    rn: "",
    l: `${windows ? "xmrig.exe" : "./xmrig"} -o PROXY_HOST:3333 -u ${worker} --nicehash --donate-over-proxy 1 --keepalive`,
    ln: `Worker miners connect to this proxy on port 3333 using NiceHash-compatible mode. ${REPLACE_PROXY_HOST}`,
    nt: `${macos ? "Intel macOS is not supported by this download. " : ""}Use when many XMRig CPU workers share one upstream pool connection. ${SMALL_PROXY_NOTE} MoneroOcean fork keeps proxy aligned with algo switching. Keep fixed GPU miners direct or behind meta-miner.`
  };
}

function xmrNodeProxyPlan({ os, address, worker, port, portRow }) {
  const macos = os === "macos";
  const tlsPort = portRow.t || port;
  const config = xmrNodeProxyConfig({ address, worker, port: tlsPort });
  return {
    sm: `${POOL_HOST}:${tlsPort} is derived from ${portRow.h}; ${PROXY_HOSTS_PORT_3333}`,
    d: macos
      ? "brew install node git\ngit clone https://github.com/MoneroOcean/xmr-node-proxy.git ~/xmr-node-proxy\ncd ~/xmr-node-proxy\nnpm install --no-audit --no-fund"
      : "sudo apt-get install git\ngit clone https://github.com/MoneroOcean/xmr-node-proxy.git ~/xmr-node-proxy\ncd ~/xmr-node-proxy\nbash install.sh",
    dn: "",
    rt: `cat > config.json <<'JSON'\n${config}\nJSON\nnode proxy.js --config config.json`,
    rtn: TLS_MODE_NOTE,
    r: "",
    rn: "",
    l: `./xmrig -o PROXY_HOST:3333 -u ${worker}`,
    ln: `Worker miners connect to xmr-node-proxy on port 3333. ${REPLACE_PROXY_HOST}`,
    nt: `Use for many CPU workers on XMR-style algorithms. ${SMALL_PROXY_NOTE} Generated xmr-node-proxy config is an rx/0 starter config. Add real algo_perf for full switching. Not for Etchash, KawPow, Autolykos2, or XTM/Tari c29.`
  };
}

function xmrigTorRun({ os, address, worker, port }) {
  const setup = os === "macos"
    ? "brew install tor && brew services start tor"
    : "sudo apt-get install tor && sudo systemctl enable --now tor";
  return `${setup}
./xmrig -o ${TOR_MINING_HOST}:${port} -x 127.0.0.1:9050 -u ${address} --rig-id ${worker} --keepalive`;
}

function xmrNodeProxyConfig({ address, worker, port }) {
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
  return configuredPorts.find((row) => row[2] >= target) || configuredPorts[configuredPorts.length - 1];
}

function portRowForHashrate(hashrateHps, ports = []) {
  const configured = setupConfiguredPorts(ports);
  if (!configured.length) return null;
  const row = configuredPortForHashrate(hashrateHps, configured);
  return {
    p: row[0],
    t: row[1],
    h: row[3] || `${formatSetupHashrate(row[2])} configured target`
  };
}

function normalizedHashrateInput(value, fallback) {
  const number = Number(value);
  if (!isFiniteNumber(number) || number <= 0) return fallback;
  return Math.round(number * 1000) / 1000;
}

function formatSetupHashrate(hashrateHps) {
  const hps = Number(hashrateHps) || 0;
  if (hps >= 1_000_000) return `${trimNumber(hps / 1_000_000)} MH/s`;
  if (hps >= 1000) return `${trimNumber(hps / 1000)} KH/s`;
  return `${trimNumber(hps)} H/s`;
}

function trimNumber(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function normalizeProfileAlgo(profile, algo) {
  if (profileUsesAutoAlgo(profile)) return "auto";
  if (profile === "srb-gpu" && !SRB_ALGO[algo]) return "autolykos2";
  if (algo === "auto") return "rx/0";
  return algo;
}

function profileUsesAutoAlgo(profile) {
  return profile === "xmrig-mo" || profile === "meta-miner" || profile === "xmrig-proxy" || profile === "xmr-node-proxy";
}

function profileId(value, os = "linux") {
  return setupProfileOptions(os).some((row) => row[0] === value) ? value : "xmrig-mo";
}

function optionId(value, rows, fallback) {
  return rows.some((row) => row[0] === value) ? value : fallback;
}

function workerName(value) {
  return String(value || "rig01").trim().replace(/[^a-zA-Z0-9_.-]+/g, "_") || "rig01";
}

function macXmrigDownload() {
  return macTarDownload("moneroocean", XMRIG_RELEASE_API, "xmrig.tar.gz", "xmrig");
}

function srbLinuxDownload(includeCurl = true) {
  const d = includeCurl ? linuxReleaseDownload : releaseDownload;
  return `${d("srbminer", SRBMINER_RELEASE_API, "grep -Ei 'SRBMiner-Multi-.*-Linux\\.tar\\.(gz|xz)'", "srbminer.tar")} && tar xf srbminer.tar --strip-components=1 && chmod +x SRBMiner-MULTI`;
}

function srbWindowsDownload() {
  return windowsZipDownload(SRBMINER_RELEASE_API, "win64\\.zip$", "srbminer.zip", "srbminer");
}

function metaMinerLinuxDownload() {
  return `sudo apt-get install nodejs curl
mkdir -p ~/meta-miner && cd ~/meta-miner
curl -L https://raw.githubusercontent.com/MoneroOcean/meta-miner/master/mm.js -o mm.js && chmod +x mm.js
${srbLinuxDownload(false).replaceAll("~/srbminer", "~/meta-miner")}`;
}

function metaMinerWindowsDownload() {
  return `${windowsAssetDownload(META_MINER_RELEASE_API, "mm-v.*\\.zip$", "mm.zip")}
New-Item -ItemType Directory -Force meta-miner | Out-Null
Expand-Archive mm.zip -DestinationPath .\\meta-miner -Force
Set-Location .\\meta-miner
${windowsAssetDownload(SRBMINER_RELEASE_API, "win64\\.zip$", "srbminer.zip")}
Expand-Archive srbminer.zip -DestinationPath .\\srbminer -Force
$dir=Get-ChildItem .\\srbminer -Directory | Select-Object -First 1
if ($dir) { Copy-Item "$($dir.FullName)\\*" . -Recurse -Force } else { Copy-Item ".\\srbminer\\*" . -Recurse -Force }`;
}

function xmrigProxyLinuxDownload() {
  return `${linuxReleaseDownload("xmrig-proxy", XMRIG_PROXY_RELEASE_API, "grep -E 'lin64-compat|lin64\\.tar\\.gz'", "xmrig-proxy.tar.gz")} && tar xf xmrig-proxy.tar.gz && chmod +x xmrig-proxy`;
}

function xmrigProxyMacDownload() {
  return macTarDownload("xmrig-proxy", XMRIG_PROXY_RELEASE_API, "xmrig-proxy.tar.gz", "xmrig-proxy", `if [ "$(uname -m)" != "arm64" ]; then echo "${XMRIG_PROXY_MAC_DOWNLOAD_NOTE}"; exit 1; fi`);
}

function xmrigProxyWindowsDownload() {
  return windowsZipDownload(XMRIG_PROXY_RELEASE_API, "win64\\.zip$", "xmrig-proxy.zip", "xmrig-proxy");
}

function releaseDownload(dir, api, grepCommand, file) {
  return `mkdir -p ~/${dir} && cd ~/${dir}
url=$(curl -fsSL ${api} | grep browser_download_url | ${grepCommand} | head -1 | cut -d '"' -f 4)
curl -L "$url" -o ${file}`;
}

function linuxReleaseDownload(dir, api, grepCommand, file) {
  return `sudo apt-get install curl
${releaseDownload(dir, api, grepCommand, file)}`;
}

function windowsZipDownload(api, pattern, file, dir) {
  return `${windowsAssetDownload(api, pattern, file)}
New-Item -ItemType Directory -Force ${dir} | Out-Null
Expand-Archive ${file} -DestinationPath .\\${dir} -Force
$dir=Get-ChildItem .\\${dir} -Directory | Select-Object -First 1
if ($dir) { Set-Location $dir.FullName } else { Set-Location .\\${dir} }`;
}

function macTarDownload(dir, api, file, binary, precheck = "") {
  return `mkdir -p ~/${dir} && cd ~/${dir}
${precheck ? `${precheck}\n` : ""}url=$(curl -fsSL ${api} | grep browser_download_url | grep 'mac64\\.tar\\.gz' | head -1 | cut -d '"' -f 4)
curl -L "$url" -o ${file} && tar xf ${file} && chmod +x ${binary}
xattr -d com.apple.quarantine ${binary} 2>/dev/null || true`;
}

function windowsAssetDownload(api, pattern, file) {
  return `$r=Invoke-RestMethod ${api}
$a=$r.assets | Where-Object name -match '${pattern}' | Select-Object -First 1
iwr $a.browser_download_url -OutFile ${file}`;
}

import { api } from "../api.js";
import { DISCORD_URL, DONATION_XMR, EXPLANATIONS, supportEmail, UPTIME_URL } from "../constants.js";
import { formatHashrate } from "../format.js";
import { localHistoryEnabled } from "../privacy.js";
import { payoutFeeText, payoutPolicyFromConfig, formatPayoutThresholdInput } from "../settings.js";
import { POOL_HOST, TOR_MINING_HOST } from "../setup.js";
import { escapeHtml, recover } from "./common.js";

const CALC_MO_CVS_URL = "https://github.com/MoneroOcean/nodejs-pool/blob/master/block_share_dumps/calc_mo_cvs.js";
const XMRCHAIN_URL = "https://xmrchain.net";
const DEFAULT_REFERENCE_PORTS = [80, ...Array.from({ length: 14 }, (_, index) => 10000 + 2 ** index)];

export async function helpView() {
  const policy = payoutPolicyFromConfig(await recover(api.config(), {}));
  const thresholdText = (value) => formatPayoutThresholdInput(value, policy);
  const historyEnabled = localHistoryEnabled();
  const statusLink = helpLink(UPTIME_URL, "status");
  const discordLink = helpLink(DISCORD_URL, "Discord");
  const statusOrDiscord = `${statusLink} or ${discordLink}`;
  const ppCopy = policy
    ? [
      `${EXPLANATIONS.payoutPolicy} Limits: ${thresholdText(policy.minimumThreshold)} XMR min, ${thresholdText(policy.defaultThreshold)} XMR default.`,
      `Min fee: ${payoutFeeText(policy.minimumThreshold, policy)}. ${thresholdText(policy.feeFormula.zeroFeeThreshold)} XMR or more is zero-fee.`
    ]
    : ["Payout policy is unavailable from API."];
  const rows = [
    ["First checks", [
      "Use Setup commands, then look for accepted shares. Wallet/worker pages use shares, not connections.",
      "Use the same XMR wallet here and in the miner. If shares accept but no worker appears, check wallet/subaddress/config.",
      "Pool hashrate uses share windows; short or low tests can look flat.",
      "Stable worker ids prevent all_other_workers."
    ], true],
    ["Hashrate and pay", [
      `${EXPLANATIONS.rawHashrate} ${EXPLANATIONS.normalizedHashrate}`,
      "Raw is algorithm-specific; bigger raw can earn less XMR on another algo.",
      "Judge payout with XMR-normalized view, wallet block rewards, and Coins hash scalar."
    ], true],
    ["PPLNS and luck", [
      EXPLANATIONS.pplns,
      "Block share uses XMR-normalized work still in PPLNS when a block is found; small miners may see quiet periods.",
      EXPLANATIONS.luck,
      `Wallet Block reward hashes link to share dumps. Use ${helpLink(CALC_MO_CVS_URL, "calc_mo_cvs.js")} to audit a reward file.`
    ], true],
    ["Payments and wallet sync", [
      ...ppCopy,
      `If the pool shows a withdrawal but your wallet is empty, refresh/rescan from height 0 to current height on ${helpLink(XMRCHAIN_URL, "xmrchain.net")}.`,
      "If total due is below threshold, keep mining or lower it in wallet settings. Below-threshold sends are usually fee-related."
    ], true],
    ["XMR payouts and altcoins", [
      EXPLANATIONS.xmrPayouts,
      "Algo switching can mine supported coins when better for XMR; balances/withdrawals stay XMR-denominated.",
      "Inactive/no-exchange coins are not useful for payout switching until exchange support returns."
    ]],
    ["Algorithm choice", [
      "MoneroOcean XMRig benchmarks speeds; the pool combines them with profitability and effort.",
      "Selected algorithm can change with pool conditions. That is normal unless miner logs say it restarted.",
      "Fixed-algorithm miners work too but lack the same auto-switch signal. Setup covers commands."
    ]],
    ["High XMRig ping", [
      "XMRig pool ping can include share validation, so it may exceed ICMP ping.",
      `Judge by accepted shares, stale/rejected rate, and disconnects. If rejects spike, try a nearby host, web-friendly port, or check ${statusLink} and ${discordLink}.`
    ]],
    ["Rejected/throttled shares", [
      "Throttled shares usually mean too many low-difficulty shares. Use a higher difficulty port or proxy.",
      "Low difficulty share means a result missed assigned difficulty. If one device repeats it, check miner, clocks, memory, thermals, and algo.",
      `If many miners report the same reject pattern, check ${statusOrDiscord} before large local changes.`
    ]],
    ["Hosts, ports, Tor", [
      `Use ${POOL_HOST}; it routes miners to a nearby healthy node. Check ${statusOrDiscord} during incidents.`,
      `Setup selects a port from estimated hashrate. Reference ports:${referencePortList()}`,
      `Ports 80 and 443 help on web-only networks. Tor onion for non-TLS mining: ${TOR_MINING_HOST}.`
    ]],
    ["Workers and proxies", [
      "A proxy reduces pool connections/share spam for larger CPU fleets. Miners use NiceHash-compatible mode.",
      "Do not add a proxy for a few machines; it is mainly for fleets, one upstream per site, or throttled direct connections.",
      "GPU fixed-algorithm miners and meta-miner switch differently, so keep routing aligned with Setup."
    ]],
    ["Privacy/support", [
      `${EXPLANATIONS.privacy} Use trash on a saved wallet to clear local history.`,
      `Local history stores up to 10 recent XMR addresses here for 180 days. It stores no keys, seeds, passwords, balances, payouts, or worker data. Disabling saves only that choice.<div class="bar help-history-controls"><button type="button" data-local-history aria-pressed="${historyEnabled}">${historyEnabled ? "Disable" : "Enable"} local wallet history</button></div>`,
      `For pool-side deletion, email ${helpLink(`mailto:${supportEmail()}`, supportEmail())}. For config questions/outages, ${helpLink(DISCORD_URL, "MoneroOcean Discord")} is usually faster.`,
      "Use a mining-only address or subaddress if you do not want mining linked to other wallet activity."
    ]],
    ["Help the pool", [
      `Report broken explorers, confusing UI/setup output, and incidents in ${discordLink} or by email. Donation address:<div class="code-box help-donation"><button class="copy-button" data-copy-target="#da">Copy</button><pre id="da">${DONATION_XMR}</pre></div>`
    ]]
  ];
  return `<section class=panel><div class=panel-header><h1>Help</h1></div><div class="card grid help-grid">${rows.map(([q, a, open]) => helpEntry(q, a, open)).join("")}</div></section>`;
}

function helpEntry(question, answers, open = false) {
  return `<details ${open ? "open" : ""}><summary>${escapeHtml(question)}</summary><div class="muted help-entry"><ul class="help-list">${answers.map((answer) => `<li>${answer}</li>`).join("")}</ul></div></details>`;
}

function helpLink(href, label) {
  return `<a href="${escapeHtml(href)}" rel=noopener target=_blank>${escapeHtml(label)}</a>`;
}

export function referencePortSummary(ports = DEFAULT_REFERENCE_PORTS) {
  // Public mining ports are a hashrate ladder: 100xx is KH/s, 11xxx+ is MH/s,
  // and port 80 is a firewall-friendly alias for the first 1 KH/s tier.
  return referencePortLabels(ports).join("; ");
}

export function referencePortList(ports = DEFAULT_REFERENCE_PORTS) {
  return `<ul class="reference-port-list">${referencePortLabels(ports).map((label) => `<li>${escapeHtml(label)}</li>`).join("")}</ul>`;
}

function referencePortLabels(ports = DEFAULT_REFERENCE_PORTS) {
  return ports.map((port) => {
    if (Array.isArray(port)) return `${port[0]}${port[1] ? `/${port[1]} TLS` : ""} for ${port[2] || formatHashrate(port[3])}`;
    const rate = port < 11024 ? port === 80 ? 1 : port - 10000 : (port - 10000) / 1024;
    return `${port}/${port === 80 ? 443 : port + 10000} TLS for ${rate} ${port < 11024 ? "KH/s" : "MH/s"}`;
  });
}

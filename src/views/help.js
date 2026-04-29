import { api } from "../api.js";
import { DISCORD_URL, DONATION_XMR, EXPLANATIONS, supportEmail, UPTIME_URL } from "../constants.js";
import { formatHashrate } from "../format.js";
import { localHistoryEnabled } from "../privacy.js";
import { payoutFeeText, payoutPolicyFromConfig, formatPayoutThresholdInput } from "../settings.js";
import { POOL_HOST } from "../setup.js";
import { escapeHtml, settledValue } from "./common.js";

const CALC_MO_CVS_URL = "https://github.com/MoneroOcean/nodejs-pool/blob/master/block_share_dumps/calc_mo_cvs.js";
const XMRCHAIN_URL = "https://xmrchain.net";
const DEFAULT_REFERENCE_PORTS = [80, 10001, 10002, 10004, 10008, 10016, 10032, 10064, 10128, 10256, 10512, 11024, 12048, 14096, 18192];

export async function helpView() {
  const configResult = await api.config().then((value) => ({ status: "fulfilled", value })).catch((reason) => ({ status: "rejected", reason }));
  const policy = payoutPolicyFromConfig(settledValue(configResult, {}));
  const thresholdText = (value) => formatPayoutThresholdInput(value, policy);
  const historyEnabled = localHistoryEnabled();
  const ppCopy = policy
    ? [
      `${EXPLANATIONS.py} Current limits: ${thresholdText(policy.m)} XMR minimum, ${thresholdText(policy.d)} XMR default.`,
      `Estimated minimum-threshold fee: ${payoutFeeText(policy.m, policy)}. Higher thresholds reduce relative fee; ${thresholdText(policy.f.z)} XMR or more is zero-fee by the pool formula.`
    ]
    : ["Payout policy is currently unavailable from the API."];
  const rows = [
    ["First checks when mining looks broken", [
      "Use the Setup page commands, then look for accepted shares in the miner. Wallet and worker pages update from accepted shares, not just connections.",
      "Use the same XMR wallet address here and in the miner. If shares accept but the worker never appears, check for another wallet, subaddress, or saved config.",
      "Pool hashrate is estimated from backend share windows. Short tests, spikes, and very low hashrate can look flat while mining still works.",
      "Give each machine a stable worker or rig id. Too many unique worker names can be collapsed into all_other_workers to protect stats."
    ], true],
    ["Raw, pay, and normalized hashrate", [
      `${EXPLANATIONS.r} ${EXPLANATIONS.n}`,
      "Raw hashrate is algorithm-specific; a larger raw number can still earn less XMR than a lower number on another algorithm.",
      "Judge payout with XMR-normalized view, wallet block rewards, and Coins hash scalar, not miner raw hashrate alone."
    ], true],
    ["PPLNS, luck, and why rewards arrive unevenly", [
      EXPLANATIONS.p,
      "Your block share is based on XMR-normalized work still inside the PPLNS window when the pool finds that block. Small miners can see quiet periods before a reward.",
      EXPLANATIONS.l,
      `Share-dump links are on wallet Block rewards hashes. Use ${helpLink(CALC_MO_CVS_URL, "calc_mo_cvs.js")} to audit a reward file.`
    ], true],
    ["Payments, thresholds, and wallet sync", [
      ...ppCopy,
      `If the pool shows a withdrawal but your wallet is empty, refresh or rescan against a synced Monero node from height 0 through the current height on ${helpLink(XMRCHAIN_URL, "xmrchain.net")}.`,
      "If total due is below threshold, keep mining or lower it in wallet settings. A sent amount below threshold is usually due to transaction fee."
    ], true],
    ["XMR-only payouts and altcoin mining", [
      EXPLANATIONS.x,
      "Algo switching can mine supported coins when better for XMR payout, but balances and withdrawals stay XMR-denominated.",
      "Coins marked inactive or no exchange configured are not useful for payout switching until pool exchange support returns."
    ]],
    ["How MoneroOcean chooses algorithms", [
      "MoneroOcean's XMRig fork benchmarks supported algorithms and reports speeds to the pool, which combines them with profitability and effort to choose XMR payout work.",
      "The selected algorithm can change as pool conditions change. That is normal unless the miner log says it restarted.",
      "Fixed-algorithm miners can use the pool but do not provide the same auto-switching signal. Setup covers exact miner and proxy commands."
    ]],
    ["High XMRig ping", [
      "XMRig pool ping includes more than round-trip time and can include share validation, so it may exceed ICMP ping.",
      `Judge the connection by accepted shares, stale/rejected rate, and disconnects. If rejects spike, try a nearby host, firewall-friendly port, or check ${helpLink(UPTIME_URL, "status")} and ${helpLink(DISCORD_URL, "Discord")}.`
    ]],
    ["Rejected, low difficulty, or throttled shares", [
      "Throttled down share submission usually means too many low-difficulty shares. Use a higher difficulty port or a proxy for many workers.",
      "Low difficulty share means a result did not meet assigned difficulty. If it repeats on one device, update the miner and check clocks, memory, thermals, and algorithm.",
      `If many miners report the same reject pattern, check ${helpLink(UPTIME_URL, "status")} or ${helpLink(DISCORD_URL, "Discord")} before making large local changes.`
    ]],
    ["Pool hosts, ports, and Tor", [
      `Use ${POOL_HOST}; it routes miners to a nearby healthy node. Check ${helpLink(UPTIME_URL, "status")} or ${helpLink(DISCORD_URL, "Discord")} during incidents.`,
      `The Setup page selects a port from your estimated hashrate. Reference ports: ${referencePortSummary()}.`,
      "Ports 80 and 443 help on web-only networks. Tor onion for non-TLS mining: mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id.onion."
    ]],
    ["Many workers and proxies", [
      "A proxy reduces pool connections and share spam for larger CPU fleets. Miners use NiceHash-compatible mode toward the proxy.",
      "Do not add a proxy just for a few machines. It is mainly for fleets, one upstream per site, or throttled direct connections.",
      "GPU fixed-algorithm miners and meta-miner switch differently, so keep routing aligned with Setup."
    ]],
    ["Privacy and support", [
      `${EXPLANATIONS.pv} Use the trash button on a saved wallet to clear local history.`,
      `Local history stores only recently opened XMR wallet addresses in this browser, up to 10 for 180 days, so they appear as saved wallets. It does not store keys, seeds, passwords, balances, payouts, or worker data. When disabled, only the no-history choice is saved.<div class="br hhc"><button type="button" data-lh aria-pressed="${historyEnabled}">${historyEnabled ? "Disable" : "Enable"} local wallet history</button></div>`,
      `For pool-side deletion, email ${helpLink(`mailto:${supportEmail()}`, supportEmail())}. For config questions and outages, ${helpLink(DISCORD_URL, "MoneroOcean Discord")} is usually faster.`,
      "Use a mining-only address or subaddress if you do not want mining linked to other wallet activity."
    ]],
    ["How you can help the pool", [
      `Report broken explorers, confusing UI, bad setup output, and incidents in ${helpLink(DISCORD_URL, "Discord")} or by email. Donation address:<div class="cbx hdn"><button class="cpy" data-c="#da">Copy</button><pre id="da">${DONATION_XMR}</pre></div>`
    ]]
  ];
  return `<section class="pn"><div class="ph"><h1>Help</h1></div><div class="cd gd hg">${rows.map(([q, a, open]) => helpEntry(q, a, open)).join("")}</div></section>`;
}

function helpEntry(question, answers, open = false) {
  const body = Array.isArray(answers) ? `<ul class="hl">${answers.map((answer) => `<li>${answer}</li>`).join("")}</ul>` : answers;
  return `<details ${open ? "open" : ""}><summary>${escapeHtml(question)}</summary><div class="mt he">${body}</div></details>`;
}

function helpLink(href, label) {
  return `<a href="${escapeHtml(href)}" rel="noopener" target="_blank">${escapeHtml(label)}</a>`;
}

export function referencePortSummary(ports = DEFAULT_REFERENCE_PORTS) {
  // Public mining ports are a hashrate ladder: 100xx is KH/s, 11xxx+ is MH/s,
  // and port 80 is a firewall-friendly alias for the first 1 KH/s tier.
  return ports.map((port) => {
    if (Array.isArray(port)) return `${port[0]}${port[1] ? `/${port[1]} TLS` : ""} for ${port[2] || formatHashrate(port[3])}`;
    const rate = port < 11024 ? port === 80 ? 1 : port - 10000 : (port - 10000) / 1024;
    return `${port}/${port === 80 ? 443 : port + 10000} TLS for ${rate} ${port < 11024 ? "KH/s" : "MH/s"}`;
  }).join("; ");
}

export const API_BASE = "https://api.moneroocean.stream/";
export const UPTIME_URL = "https://stats.uptimerobot.com/BrD44hEJx";
export const UPTIME_API = "https://stats.uptimerobot.com/api/getMonitorList/BrD44hEJx";
export const DISCORD_URL = "https://discordapp.com/invite/jXaR2kA";
const SUPPORT_EMAIL_CODES = "c3VwcG9ydEBtb25lcm9vY2Vhbi5zdHJlYW0=";
export const supportEmail = () => atob(SUPPORT_EMAIL_CODES);
export const DONATION_XMR = "89TxfrUmqJJcb1V124WsUzA78Xa3UYHt7Bg8RGMhXVeZYPN8cE5CZEk58Y1m23ZMLHN7wYeJ9da5n5MXharEjrm41hSnWHL";
export const XMR_PORT = 18081;
export const HASHRATE_UNITS = [
  ["h", "H/s", 1],
  ["kh", "KH/s", 1000],
  ["mh", "MH/s", 1000000]
];
export const XMR_ADDRESS_RE = /^[48][1-9A-HJ-NP-Za-km-z]{94}([1-9A-HJ-NP-Za-km-z]{11})?$/;
const XMRCHAIN_URL = "https://xmrchain.net";
const TARI_EXPLORER_URL = "https://explore.tari.com";
const blockHeightUrl = (base) => `${base}/block/{height}`;

export const COIN_EXPLORERS = {
  18081: XMRCHAIN_URL,
  18144: TARI_EXPLORER_URL,
  18146: TARI_EXPLORER_URL,
  18148: TARI_EXPLORER_URL,
  19734: "https://explorer.sumokoin.com",
  12211: "https://explorer.ryo.tools",
  38081: "https://explorer.getmasari.org",
  48782: "https://lethean.io/explorer",
  19281: "https://explorer.monerov.online",
  19950: "https://explorer.getswap.eu",
  8766: "https://blockbook.ravencoin.org",
  19001: "https://explorer.neurai.org",
  9998: "https://explorer.raptoreum.com",
  5110: "https://kcnxp.com",
  10225: "https://explorer.bitoreum.org",
  9053: "https://explorer.ergoplatform.com/en",
  8645: "https://etcerscan.com",
  17750: "https://explorer.havenprotocol.org",
  25182: "https://explorer.bittube.cash",
  11812: "https://explorer.scalaproject.io",
  2086: "https://bloc-explorer.com",
  19994: "https://explorer.arqma.com",
  16000: "https://explorer.conceal.network",
  17767: "https://explorer.zephyrprotocol.com",
  19081: "https://explorer.salvium.io"
};

const STANDARD_BLOCK_HEIGHT_PORTS = [19001, 9998, 5110, 11812, 2086, 19994, 17767, 19081];
const standardBlockHeightExplorers = Object.fromEntries(STANDARD_BLOCK_HEIGHT_PORTS.map((port) => [port, blockHeightUrl(COIN_EXPLORERS[port])]));

export const COIN_HEIGHT_EXPLORERS = {
  18081: `${XMRCHAIN_URL}/block/{height}`,
  18144: `${TARI_EXPLORER_URL}/blocks/{height}`,
  18146: `${TARI_EXPLORER_URL}/blocks/{height}`,
  18148: `${TARI_EXPLORER_URL}/blocks/{height}`,
  12211: "https://explorer.ryo.tools/search?value={height}",
  8766: "https://ravencoin.atomicwallet.io/block/{height}",
  9053: "https://explorer.ergoplatform.com/en/blocks/{height}",
  8645: "https://etc.blockscout.com/block/{height}",
  16000: "https://explorer.conceal.network/index.html?hash={height}",
  ...standardBlockHeightExplorers
};

export const BLOCK_SHARE_DUMP_BASE = "https://block-share-dumps.moneroocean.stream";

export const GRAPH_WINDOWS = [
  ["6h", "6h", 6 * 60 * 60],
  ["12h", "12h", 12 * 60 * 60],
  ["24h", "24h", 24 * 60 * 60],
  ["all", "All", Infinity]
];

// Shared tooltip copy keeps explanations consistent between KPI cards, help
// entries, and wallet controls.
export const EXPLANATIONS = {
  pplns: "PPLNS pays shares in the current window when a block is found. Recent shares can earn after a worker stops.",
  luck: "Luck compares shares spent with expected difficulty. Over 100% took extra work; under 100% was luckier.",
  hashScalar: "Hash scalar is profit per hash vs XMR, with effort luck penalty. 100% equals XMR.",
  normalizedHashrate: "XMR-normalized hashrate converts mined coins to XMR payout value for algorithm comparison.",
  currentHashrate: "Current pool estimate is XMR-normalized accepted-share hashrate from the last 10-minute backend window, not graph-window average; can lag spikes.",
  rawHashrate: "Raw hashrate is worker-reported by algo. Pool-side estimates use accepted shares and can lag spikes.",
  payoutPolicy: "Payouts auto-send when due balance reaches the threshold. Small thresholds can mean higher relative fees or payout waits.",
  xmrPayouts: "Rewards convert and pay in XMR. XMR can merge-mine XTM/Tari; no separate XTM wallet needed.",
  privacy: "Wallet history stays in this browser and is used only when opened."
};

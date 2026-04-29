export const API_BASE = "https://api.moneroocean.stream/";
export const UPTIME_URL = "https://stats.uptimerobot.com/BrD44hEJx";
export const UPTIME_API = "https://stats.uptimerobot.com/api/getMonitorList/BrD44hEJx";
export const DISCORD_URL = "https://discordapp.com/invite/jXaR2kA";
const SUPPORT_EMAIL_CODES = "c3VwcG9ydEBtb25lcm9vY2Vhbi5zdHJlYW0=";
export const supportEmail = () => atob(SUPPORT_EMAIL_CODES);
export const DONATION_XMR = "499fS1Phq64hGeqV8p2AfXbf6Ax7gP6FybcMJq6Wbvg8Hw6xms8tCmdYpPsTLSaTNuLEtW4kF2DDiWCFcw4u7wSvFD8wFWE";
export const XMR_PORT = 18081;
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

// Short explanation keys keep repeated tooltip copy references compact:
// p PPLNS, l luck, h hash scalar, n normalized hashrate, c current pool
// estimate, r raw hashrate, py payout policy, x XMR-only payouts, pv privacy.
export const EXPLANATIONS = {
  p: "PPLNS pays wallets for shares still inside the current window when a block is found. You can keep earning briefly after a worker stops while recent shares remain in the window.",
  l: "Luck compares shares spent against expected network difficulty. Over 100% means the round took more work than expected; under 100% means it was luckier.",
  h: "Hash scalar is coin profit per hash relative to XMR, including chain effort luck penalty. 100% equals XMR.",
  n: "XMR-normalized hashrate converts all mined coins into their XMR payout value so different algorithms can be compared in one number.",
  c: "Current pool estimate is the pool-side XMR-normalized hashrate from accepted shares in the backend's last 10-minute window. It is not the selected graph window average and can lag short spikes.",
  r: "Raw hashrate is what a worker reports on its current algorithm. Pool-side hashrate is estimated from accepted shares and can lag short spikes.",
  py: "Payouts are sent automatically after your due balance reaches the threshold. Small thresholds can have higher relative transaction fees or wait for a payout cycle.",
  x: "All rewards are converted and paid in XMR. XMR can be merge-mined with XTM/Tari, but XTM rewards are converted to XMR too; no separate XTM wallet is needed.",
  pv: "Saved wallet history stays in this browser and is only used when you open that wallet."
};

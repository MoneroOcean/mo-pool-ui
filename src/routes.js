import { XMR_ADDRESS_RE } from "./constants.js";
import { encodeUrlPart } from "./format.js";
import { coinSymbol } from "./pool.js";

export function isXmrAddress(value) {
  return XMR_ADDRESS_RE.test(String(value ?? "").trim());
}

/*
Route contract

The hash router intentionally accepts only current public route names. Query
parameters are parsed here and normalized by each owning view; route builders
should generate the names below so miner-facing links stay stable.

Home:
  #/
  params: window=6h|12h|24h|all, mode=xmr|raw, tracked=<timestamp>

Coins:
  #/coins
  params: issues=1, inactive=0,
          sort=name|algo|profit|effort|reward|wallets|pool|world|height|pplns|notes,
          dir=asc|desc

Blocks:
  #/blocks
  #/blocks/<COIN>
  params: coin=<COIN>, page=<number>, limit=15|50|100
  <COIN> is a ticker/symbol such as XMR, RTM, or XTM. Ports and long display
  names are deliberately not route identifiers.

Payments:
  #/payments
  params: page=<number>, limit=15|50|100

Calculator:
  #/calc
  params: rate=<hashrate>, unit=h|kh|mh

Setup:
  #/setup
  params: addr=<XMR address>, os=<os>, profile=<profile>, gpu=<gpu>,
          algo=<algo>, rate=<hashrate>, unit=h|kh|mh

Help:
  #/help

Wallet:
  #/wallet/<address>
  #/wallet/<address>/overview
  #/wallet/<address>/withdrawals
  #/wallet/<address>/rewards
  #/wallet/<address>/payout
  #/wallet/<address>/alerts
  params: window=6h|12h|24h|all, mode=xmr|raw, view=1|2|3|list,
          sort=h|name|xmr|raw|avg|avgraw|last|valid|invalid|hashes,
          dir=asc|desc, dead=0, stats=1,
          wpage=<withdrawal page>, wlimit=15|50|100,
          rpage=<reward page>, rlimit=15|50|100
*/
export function parseRoute(hash = "") {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathRaw, queryRaw = ""] = raw.split("?");
  const path = pathRaw.startsWith("/") ? pathRaw : `/${pathRaw}`;
  const query = Object.fromEntries(new URLSearchParams(queryRaw));
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { n: "home", p: "#/", q: query };
  if (parts[0] === "wallet") {
    const tab = walletTab(parts[2] || "overview");
    if (!tab) return { n: "home", p: "#/", q: query };
    return {
      n: "wallet",
      a: parts[1] || "",
      t: tab,
      p: `#/wallet/${encodeUrlPart(parts[1] || "")}/${tab}`,
      q: query
    };
  }
  if (parts[0] === "blocks" && parts[1]) {
    const coin = parts[1];
    if (!/^(?=.*[A-Z])[A-Z0-9]+$/.test(coin)) return { n: "home", p: "#/", q: query };
    return { n: "blocks", c: coin, p: `#/blocks/${encodeUrlPart(routeCoinId(coin))}`, q: query };
  }
  if (["coins", "blocks", "payments", "calc", "setup", "help"].includes(parts[0])) return { n: parts[0], p: `#/${parts[0]}`, q: query };
  return { n: "home", p: "#/", q: query };
}

export function walletRoute(address, tab = "overview") {
  return `#/wallet/${encodeUrlPart(address)}/${encodeUrlPart(walletTab(tab) || "overview")}`;
}

function walletTab(value) {
  const tab = String(value || "overview");
  return isWalletTab(tab) ? tab : "";
}

function isWalletTab(value) {
  return ["overview", "rewards", "withdrawals", "payout", "alerts"].includes(value);
}

export function routeCoinId(port, poolStats) {
  return coinSymbol(poolStats, port);
}

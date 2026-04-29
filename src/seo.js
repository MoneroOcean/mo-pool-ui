import { qs } from "./dom.js";

const MO = "MoneroOcean ";

export function setTitle(route) {
  const names = {
    home: `${MO}Pool Dashboard`,
    wallet: `${MO}Wallet`,
    coins: `${MO}Coins`,
    blocks: `${MO}Blocks`,
    payments: `${MO}Payments`,
    calc: `${MO}Profit Calc`,
    ports: `${MO}Ports`,
    setup: `${MO}Setup`,
    help: `${MO}Help`
  };
  document.title = `${names[route.n] || names.home} | XMR Mining Pool`;
}

export function updateCanonical(route) {
  const canonical = qs("link[rel='canonical']");
  if (canonical) canonical.href = `https://moneroocean.stream/${route.p || "#/"}`;
}

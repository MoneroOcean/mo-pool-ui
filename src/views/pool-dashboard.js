import { EXPLANATIONS } from "../constants.js";
import { formatHashrate, formatNumber, formatPercent } from "../format.js";
import { coinName, effortPercent, topCoinPort, worldHashrateForPort } from "../pool.js";
import { kpi, linkLabel, uptimeLabel } from "./common.js";
import { blockRoute } from "./blocks.js";

export function poolDashboard(pool, network, uptime) {
  const topPort = topCoinPort(pool);
  const topName = coinName(pool, topPort);
  const topWorld = worldHashrateForPort(network[topPort] || network[Number(topPort)] || {}, topPort, pool);
  return `<section class="pn">
    <div class="cd">
      <div class="gd kg pkg">
        ${kpi(uptimeLabel("Wallets", uptime), formatNumber(pool.miners), "Connected pool wallets.")}
        ${kpi(linkLabel("Pool hashrate", "#/coins"), formatHashrate(pool.hashRate), EXPLANATIONS.n)}
        ${kpi(`${topName} world hashrate`, formatHashrate(topWorld), "Network estimate for the current top coin.")}
        ${kpi(linkLabel(`${topName} last effort`, blockRoute(topPort)), formatPercent(effortPercent(pool, network, topPort)), EXPLANATIONS.l)}
        ${kpi(linkLabel("Payments made", "#/payments"), formatNumber(pool.totalPayments), "Historical payout batches.")}
        ${kpi("PPLNS window", `${formatNumber((pool.pplnsWindowTime || 0) / 3600, 2)}h`, EXPLANATIONS.p)}
      </div>
    </div>
  </section>`;
}

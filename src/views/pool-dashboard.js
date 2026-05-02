import { EXPLANATIONS } from "../constants.js";
import { formatHashrate, formatNumber, formatPercent } from "../format.js";
import { coinName, effortPercent, topCoinPort, worldHashrateForPort } from "../pool.js";
import { kpi, linkLabel, uptimeLabel } from "./common.js";
import { blockRoute } from "./blocks.js";

export function poolDashboard(pool, network, uptime) {
  const topPort = topCoinPort(pool);
  const topName = coinName(pool, topPort);
  const topWorld = worldHashrateForPort(network[topPort] || network[Number(topPort)] || {}, topPort, pool);
  return `<section class=panel>
    <div class=card>
      <div class="grid kpi-grid pool-kpi-grid">
        ${kpi(uptimeLabel("Wallets", uptime), formatNumber(pool.miners), "Connected pool wallets.")}
        ${kpi(linkLabel("Pool hashrate", "#/coins"), formatHashrate(pool.hashRate), EXPLANATIONS.normalizedHashrate)}
        ${kpi(`${topName} world`, formatHashrate(topWorld), "Network estimate for the current top coin.")}
        ${kpi(linkLabel(`${topName} last effort`, blockRoute(topPort, 1, undefined, pool)), formatPercent(effortPercent(pool, network, topPort)), EXPLANATIONS.luck)}
        ${kpi(linkLabel("Payments made", "#/payments"), formatNumber(pool.totalPayments), "Historical payout batches.")}
        ${kpi("PPLNS window", `${formatNumber((pool.pplnsWindowTime || 0) / 3600, 2)}h`, EXPLANATIONS.pplns)}
      </div>
    </div>
  </section>`;
}

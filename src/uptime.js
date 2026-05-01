const DOWN_CLASSES = new Set(["danger", "down", "error"]);
const UP_CLASSES = new Set(["success", "up"]);
export const UNKNOWN_UPTIME = { tone: "gray", label: "Unknown", detail: "UptimeRobot status unavailable" };
export const uptimeToneClass = (tone) => ({ green: "sgn", yellow: "syo", red: "srd", gray: "sgu" })[tone] || "syo";

export function summarizeUptimeRobot(payload = {}) {
  const monitors = Array.isArray(payload.data) ? payload.data : [];
  const active = monitors.filter((monitor) => statusClass(monitor) !== "paused");
  const down = active.filter((monitor) => DOWN_CLASSES.has(statusClass(monitor)));
  const coreDown = down.filter((monitor) => !isCoinNode(monitor));
  const nodeDown = down.filter(isCoinNode);
  const warning = active.filter((monitor) => {
    const status = statusClass(monitor);
    return status && !UP_CLASSES.has(status) && !DOWN_CLASSES.has(status);
  });

  if (!monitors.length || !active.length) {
    return { tone: "yellow", label: "Unknown", detail: "UptimeRobot status unavailable" };
  }
  if (coreDown.length) {
    return { tone: "red", label: "Down", detail: `${coreDown.length} core monitor down` };
  }
  if (nodeDown.length) {
    return { tone: "yellow", label: "Coin node issue", detail: `${nodeDown.length} coin node monitor down` };
  }
  if (warning.length) {
    return { tone: "yellow", label: "Degraded", detail: `${warning.length} monitor warning` };
  }
  return { tone: "green", label: "Operational", detail: `${active.length} active monitors up` };
}

function statusClass(monitor) {
  return String(monitor?.statusClass || "").toLowerCase();
}

function isCoinNode(monitor) {
  const name = String(monitor?.name || "");
  return /^backend:\s*node\s+/i.test(name) && !/^backend:\s*node\s+xmr\b/i.test(name);
}

import { isFiniteNumber, trimFixed } from "./format.js";

function boundedNumber(value, min = 0, inclusive = true) {
  const number = Number(value);
  return isFiniteNumber(number) && (inclusive ? number >= min : number > min) ? number : null;
}

const positiveNumber = (value) => boundedNumber(value, 0, false);
const nonNegativeNumber = (value) => boundedNumber(value);

export function normalizePayoutPolicy(policy) {
  const source = policy && typeof policy === "object" ? policy : null;
  const feeFormula = source?.feeFormula && typeof source.feeFormula === "object" ? source.feeFormula : null;
  const minimumThreshold = positiveNumber(source?.minimumThreshold);
  const defaultThreshold = positiveNumber(source?.defaultThreshold);
  const denomination = positiveNumber(source?.denomination);
  const maxFee = nonNegativeNumber(feeFormula?.maxFee);
  const zeroFeeThreshold = positiveNumber(feeFormula?.zeroFeeThreshold);
  if (minimumThreshold === null || defaultThreshold === null || denomination === null || maxFee === null || zeroFeeThreshold === null) return null;
  return {
    minimumThreshold,
    defaultThreshold,
    exchangeMinimumThreshold: positiveNumber(source.exchangeMinimumThreshold),
    denomination,
    maturityDepth: nonNegativeNumber(source.maturityDepth),
    feeFormula: { maxFee, zeroFeeThreshold }
  };
}

export function payoutPolicyFromConfig(config = {}) {
  return normalizePayoutPolicy(config.payout_policy || config.payoutPolicy);
}

function payoutDecimals(policy) {
  const normalized = normalizePayoutPolicy(policy);
  if (!normalized) return 0;
  const text = String(normalized.denomination).toLowerCase();
  if (text.includes("e-")) return Math.min(12, Math.max(0, Number(text.split("e-")[1]) || 0));
  const decimal = text.split(".")[1] || "";
  return Math.min(12, Math.max(0, decimal.replace(/0+$/, "").length));
}

export function payoutThresholdFromAtomic(value, policy) {
  const number = Number(value);
  const normalized = normalizePayoutPolicy(policy);
  if (!normalized) return 0;
  if (!isFiniteNumber(number) || number <= 0) return normalized.defaultThreshold;
  return number > 1 ? number / 1_000_000_000_000 : number;
}

export function normalizePayoutThreshold(value) {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!isFiniteNumber(number) || number <= 0) return 0;
  return number;
}

export function payoutFeeEstimate(threshold, policy) {
  const normalized = normalizePayoutPolicy(policy);
  const value = normalizePayoutThreshold(threshold);
  if (!normalized || !value) return { threshold: value, fee: NaN, percent: NaN };
  const { minimumThreshold, feeFormula: { maxFee, zeroFeeThreshold } } = normalized;
  const fee = zeroFeeThreshold <= minimumThreshold
    ? (value >= zeroFeeThreshold ? 0 : maxFee)
    : Math.min(maxFee, Math.max(0, maxFee - ((value - minimumThreshold) * (maxFee / (zeroFeeThreshold - minimumThreshold)))));
  return { threshold: value, fee, percent: value > 0 ? (100 * fee) / value : 0 };
}

export function payoutFeeText(threshold, policy) {
  const { fee, percent } = payoutFeeEstimate(threshold, policy);
  if (!isFiniteNumber(fee) || !isFiniteNumber(percent)) return "XMR tx fee unavailable";
  return `+${formatTrimmedDecimal(fee, 4)} (${formatTrimmedDecimal(percent, 2)}%) XMR tx fee`;
}

export function formatPayoutThresholdInput(threshold, policy) {
  const number = Number(threshold);
  if (!isFiniteNumber(number)) return "";
  return formatTrimmedDecimal(number, payoutDecimals(policy));
}

function formatTrimmedDecimal(value, digits) {
  const number = Number(value);
  return isFiniteNumber(number) ? trimFixed(number, digits) : "";
}

export function validatePayoutThreshold(value, policy) {
  const normalized = normalizePayoutPolicy(policy);
  if (!normalized) return { valid: false, threshold: 0, message: "Payout policy unavailable from API." };
  const threshold = normalizePayoutThreshold(value);
  if (!threshold) return { valid: false, threshold, message: "Enter a valid XMR threshold." };
  if (threshold < normalized.minimumThreshold) return { valid: false, threshold, message: `Payment threshold must be at least ${formatPayoutThresholdInput(normalized.minimumThreshold, normalized)} XMR.` };
  return { valid: true, threshold, message: "" };
}

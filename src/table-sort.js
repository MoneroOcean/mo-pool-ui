import { isFiniteNumber } from "./format.js";

export function sortDirection(value) {
  return value === "asc" ? "asc" : "desc";
}

export function nextSortDirection(active, currentDirection, key) {
  return active === key && sortDirection(currentDirection) === "desc" ? "asc" : "desc";
}

export function nextSortDirectionForKey(active, currentDirection, key, firstDirection = {}) {
  if (active === key) return nextSortDirection(active, currentDirection, key);
  return firstDirection[key] || "desc";
}

export function sortRows(rows, key, direction = "desc") {
  const dir = sortDirection(direction) === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => compareValues(a[key], b[key]) * dir || compareValues(a.name, b.name));
}

export function compareValues(a, b) {
  const numberA = numericValue(a);
  const numberB = numericValue(b);
  if (isFiniteNumber(numberA) && isFiniteNumber(numberB)) return numberA - numberB;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function numericValue(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/,/g, "").replace(/%$/, "").trim();
  return cleaned === "" ? NaN : Number(cleaned);
}

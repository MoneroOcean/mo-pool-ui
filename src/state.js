export const state = {
  // Private app singleton keys are compact because state access is hot and
  // repeated across views: r route, c cache, e endpoint errors, q request times,
  // w wallet watchlist, a active wallet address, s setup ports, p PPLNS seconds,
  // gw graph window, gm graph mode.
  r: { n: "home", p: "#/" },
  c: new Map(),
  e: new Map(),
  q: new Map(),
  w: [],
  a: "",
  s: [],
  p: 0,
  gw: typeof matchMedia === "function" && matchMedia("(max-width: 700px)").matches ? "6h" : "12h",
  gm: "normalized"
};

export function setCache(key, value) {
  state.c.set(key, { value, time: Date.now() });
  state.e.delete(key);
}

export function getCache(key) {
  return state.c.get(key)?.value;
}

export function setError(key, error) {
  state.e.set(key, error);
}

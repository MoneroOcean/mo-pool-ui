export const state = {
  // Shared app state lives here so view modules do not each keep their own
  // routing, cache, wallet, and graph defaults.
  r: { n: "home", p: "#/" },
  c: new Map(),
  e: new Map(),
  q: new Map(),
  w: [],
  a: "",
  s: [],
  p: 0,
  gw: typeof matchMedia === "function" && matchMedia("(max-width: 700px)").matches ? "6h" : "12h",
  gm: "xmr"
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

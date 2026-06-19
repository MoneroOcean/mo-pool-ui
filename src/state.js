export const state = {
  // Shared app state. Keys: r=route, c=cache Map, e=errors Map, w=watchlist wallets,
  // a=active address, s=setup ports, p=pplns window seconds, gw=graph window, gm=graph mode.
  r: { n: "home", p: "#/" },
  c: new Map(),
  e: new Map(),
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
  console.warn("api error (serving stale/last-good value)", key, error);
}

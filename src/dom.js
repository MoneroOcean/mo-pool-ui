// Small DOM wrappers keep event-binding code consistent and null-safe.
export const byId = (id) => document.getElementById(id);
export const qs = (selector, root = document) => root?.querySelector(selector);
export const qsa = (selector, root = document) => root?.querySelectorAll(selector) || [];
export const on = (node, event, handler) => node?.addEventListener(event, handler);
export const off = (node, event, handler) => node?.removeEventListener(event, handler);
export const attr = (node, name, value) => node?.setAttribute(name, value);
export const tog = (node, name, force) => node?.classList.toggle(name, force);

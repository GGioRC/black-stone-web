// Lo pequeño que usan todas las vistas.

/** Escapa un texto para meterlo en HTML. */
export const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Un id seguro a partir de una clave: «chamber.extra.audit-0» → «k-chamber-extra-audit-0». */
export const idOf = (key) => "k-" + String(key).replace(/[^a-zA-Z0-9_-]/g, "-");

/** Guarda y lee del navegador sin romperse si no hay almacenamiento (modo privado, vista previa). */
export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento: sólo esta sesión */ }
  },
};

/** Un botón que se confirma en la misma página: confirm() no sale en todos los navegadores y ahí cuenta como «No». */
export function askButton(asking, action, label, question, yes, no) {
  if (asking !== action) return `<button type="button" class="quiet" data-action="${action}">${h(label)}</button>`;
  return `<span class="ask" role="group" aria-label="${h(question)}"><span class="ask-q">${h(question)}</span>
    <button type="button" class="danger" data-action="${action}-yes">${h(yes)}</button>
    <button type="button" class="quiet" data-action="ask-cancel">${h(no)}</button></span>`;
}

/** Junta resultados iguales seguidos de una tabla d%: «1–2 Padded Armor». */
export function ranges(results) {
  const rows = Object.entries(results).map(([k, v]) => [+k, v]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [n, v] of rows) {
    const last = out[out.length - 1];
    if (last && last.to === n - 1 && last.result === v.result && last.page === v.page) last.to = n;
    else out.push({ from: n, to: n, result: v.result, page: v.page ?? null });
  }
  return out;
}
export const rangeLabel = (r) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`);

/** Vuelve a poner el foco donde estaba después de pintar de nuevo. */
export function keepFocus(render) {
  const el = document.activeElement;
  const id = el?.id;
  const pos = el && "selectionStart" in el ? (() => { try { return el.selectionStart; } catch { return null; } })() : null;
  render();
  if (!id) return;
  const again = document.getElementById(id);
  if (again && again !== document.activeElement) {
    again.focus({ preventScroll: true });
    if (pos != null) { try { again.setSelectionRange(pos, pos); } catch { /* number inputs */ } }
  }
}

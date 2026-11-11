// El armazón: carga las tablas, pinta la vista de la ruta y guarda lo que cambia.
import { Tables } from "./engine.js";
import { T, lang, setLang } from "./i18n.js";
import { ChamberView } from "./chamber.js";
import { ReferenceView } from "./reference.js";
import { askButton, h, keepFocus, store } from "./util.js";

const main = document.getElementById("main");
const nav = document.getElementById("nav");
const langs = document.getElementById("lang");

let chamber, reference;
let askingClear = false;

function route() {
  const [, view = "chamber", sub = "tables"] = (location.hash || "#/chamber").split("/");
  return { view, sub };
}

function renderLog() {
  const log = chamber.log;
  const deaths = log.reduce((s, x) => s + (x.deaths || 0), 0);
  if (!log.length) return `<section class="log"><p class="empty">${h(T("logEmpty"))}</p></section>`;
  return `<section class="log">
    <p class="log-stats">${h(T("logStats")(log.length, deaths))}</p>
    <ol class="log-list">${log.map((x) => `<li class="log-entry">
      <p class="log-title"><span class="result-name">${h(x.chamber)}</span>${x.page ? ` <span class="page">${h(T("page")(x.page))}</span>` : ""}</p>
      <p class="log-rolls">${[x.condition, x.loot, x.inhabitant].filter((v) => v && v !== "—").map(h).join(" · ")}</p>
      <p class="log-outcome">${h(T("outcomes")[x.outcome] ?? x.outcome)} · ${h(T("round"))} ${x.rounds}${x.deaths ? ` · ${h(T("deaths"))} ${x.deaths}` : ""}</p>
      ${x.live?.length ? `<p class="log-events">${x.live.map((e) => h(e.text)).join(" · ")}</p>` : ""}
      ${x.notes ? `<p class="log-notes">${h(x.notes)}</p>` : ""}
      <p class="log-date">${h(new Date(x.at).toLocaleString(lang()))}</p>
    </li>`).join("")}</ol>
    <div class="chamber-actions">${askButton(askingClear ? "clear-log" : null, "clear-log", T("logClear"), T("confirmClear"), T("yes"), T("cancel"))}</div>
  </section>`;
}

function render() {
  const { view, sub } = route();
  document.title = view === "ref" ? `${T("navRef")} · Black Stone` : view === "log" ? `${T("navLog")} · Black Stone` : T("app");
  const links = [["chamber", T("navChamber")], ["log", T("navLog")], ["ref", T("navRef")]];
  nav.innerHTML = links.map(([k, v]) => `<a href="#/${k}" ${k === view ? 'aria-current="page"' : ""}>${h(v)}</a>`).join("");
  langs.innerHTML = ["es", "en"].map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === lang()}">${l.toUpperCase()}</button>`).join("");
  keepFocus(() => {
    main.innerHTML = view === "ref" ? reference.render(sub) : view === "log" ? renderLog() : chamber.render();
  });
}

async function start() {
  main.innerHTML = `<p class="empty">${h(T("loading"))}</p>`;
  try {
    const [tables, bestiary, materials, magic] = await Promise.all([
      Tables.load("data/"),
      fetch("data/bestiary.json").then((r) => r.json()),
      fetch("data/materials.json").then((r) => r.json()),
      fetch("data/magic.json").then((r) => r.json()),
    ]);
    chamber = new ChamberView(tables, render);
    reference = new ReferenceView(tables, { bestiary, materials, magic });
  } catch (err) {
    console.error(err);
    main.innerHTML = `<p class="is-invalid">${h(T("loadError"))}</p>`;
    return;
  }
  // Las vistas escuchan en el mismo contenedor; cada una ignora lo que no es suyo.
  chamber.bind(main, render);
  reference.bind(main, render);
  main.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-action]")?.dataset.action;
    if (a === "clear-log") { askingClear = true; render(); }
    else if (a === "ask-cancel" && askingClear) { askingClear = false; render(); }
    else if (a === "clear-log-yes") {
      askingClear = false;
      chamber.log = [];
      store.set("bs.log", []);
      render();
    }
  });
  langs.addEventListener("click", (ev) => {
    const l = ev.target.closest("[data-lang]")?.dataset.lang;
    if (l && l !== lang()) { setLang(l); render(); }
  });
  window.addEventListener("hashchange", () => { render(); main.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); });
  render();
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => { /* sin modo sin conexión */ });
}

start();

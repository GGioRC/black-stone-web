// El armazón: carga las tablas, pinta la vista de la ruta y guarda lo que cambia.
import { Tables } from "./engine.js";
import { T, toggleLang } from "./i18n.js";
import { ChamberView } from "./chamber.js";
import { ReferenceView } from "./reference.js";
import { h, keepFocus, store } from "./util.js";

const main = document.getElementById("main");
const nav = document.getElementById("nav");
const title = document.getElementById("title");
const tagline = document.getElementById("tagline");
const footer = document.getElementById("footer");

let chamber, reference;

function route() {
  const [, view = "chamber", sub = "tables"] = (location.hash || "#/chamber").split("/");
  return { view, sub };
}

function renderLog() {
  const log = chamber.log;
  const deaths = log.reduce((s, x) => s + (x.deaths || 0), 0);
  return `<section aria-labelledby="h-log"><h2 id="h-log">${h(T("navLog"))}</h2>
    ${log.length ? `<p class="dim">${h(T("logStats")(log.length, deaths))}</p>
    <ol class="log">${log.map((x) => `<li>
      <p><strong>${h(x.chamber)}</strong>${x.page ? ` <span class="pg">${h(T("page")(x.page))}</span>` : ""} <span class="dim">· ${h(new Date(x.at).toLocaleString())}</span></p>
      <p>${h(T("roll_condition"))}: ${h(x.condition)} · ${h(T("roll_loot"))}: ${h(x.loot)} · ${h(T("roll_inhabitant"))}: ${h(x.inhabitant)}</p>
      <p>${h(T("outcomes")[x.outcome] ?? x.outcome)} · ${h(T("round"))} ${x.rounds} · ${h(T("deaths"))}: ${x.deaths}</p>
      ${x.live?.length ? `<p class="dim">${x.live.map((e) => `${h(e.label)} → ${h(e.text)}`).join(" · ")}</p>` : ""}
      ${x.notes ? `<p class="note">${h(x.notes)}</p>` : ""}
    </li>`).join("")}</ol>
    <div class="actions"><button type="button" data-action="clear-log">${h(T("logClear"))}</button></div>`
    : `<p class="dim">${h(T("logEmpty"))}</p>`}
  </section>`;
}

function render() {
  const { view, sub } = route();
  document.title = view === "ref" ? `${T("navRef")} · Black Stone` : view === "log" ? `${T("navLog")} · Black Stone` : "Black Stone · The Maze";
  title.textContent = T("app");
  tagline.textContent = T("tagline");
  const links = [["chamber", T("navChamber")], ["log", T("navLog")], ["ref", T("navRef")]];
  nav.innerHTML = links.map(([k, v]) => `<a href="#/${k}" ${k === view ? 'aria-current="page"' : ""}>${h(v)}</a>`).join("") +
    `<button type="button" id="lang" class="link">${h(T("lang"))}</button>`;
  footer.innerHTML = `<p>${h(T("dlc"))}</p><p>${h(T("offline"))}</p>`;
  keepFocus(() => {
    main.innerHTML = view === "ref" ? reference.render(sub) : view === "log" ? renderLog() : chamber.render();
  });
}

async function start() {
  main.innerHTML = `<p class="dim">${h(T("loading"))}</p>`;
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
    main.innerHTML = `<p class="err">${h(T("loadError"))}</p>`;
    return;
  }
  // Las vistas escuchan en el mismo contenedor; cada una ignora lo que no es suyo.
  chamber.bind(main, render);
  reference.bind(main, render);
  main.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-action='clear-log']") && confirm(T("confirmClear"))) {
      chamber.log = [];
      store.set("bs.log", []);
      render();
    }
  });
  nav.addEventListener("click", (ev) => {
    if (ev.target.id === "lang") { toggleLang(); render(); }
  });
  window.addEventListener("hashchange", () => { render(); main.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); });
  render();
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => { /* sin modo sin conexión */ });
}

start();

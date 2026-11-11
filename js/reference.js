// La referencia: las tablas del libro, las criaturas, los ítems y los materiales. Sólo datos y página.
import * as E from "./engine.js";
import { T } from "./i18n.js";
import { h, ranges, rangeLabel } from "./util.js";

/** Las tablas que se consultan, en el orden del libro. */
const LOOKUP = ["A", "B", "C", "D", "3.1", "3.2", "3.2.spark", "3.2.wall", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10",
  "4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9"];

const NAMES = {
  A: "Table A · Chamber", B: "Table B · Condition", C: "Table C · Loot", D: "Table D · Inhabitants",
  "3.1": "3.1 · Wild Magic effects", "3.2": "3.2 · Mistchamber", "3.2.spark": "3.2 · Mistchamber (spark)", "3.2.wall": "3.2 · Mistchamber (wall)",
  "3.3": "3.3 · Legendary Raiders", "3.4": "3.4 · School Forbiddance", "3.5": "3.5 · Arrival Circle Encounter", "3.6": "3.6 · Bonfire Encounter",
  "3.7": "3.7 · Decan House Encounter", "3.8": "3.8 · Temples of Ha'o Traps", "3.9": "3.9 · Hall of the Vanquished Encounter", "3.10": "3.10 · Trap table",
  "4.1": "4.1 · Trinkets", "4.2": "4.2 · Foraging Loot", "4.3": "4.3 · Common Metals", "4.4": "4.4 · Special Metals", "4.5": "4.5 · Minerals",
  "4.6": "4.6 · Clothing Loot", "4.7": "4.7 · Armor Loot", "4.8": "4.8 · Weapon Loot", "4.9": "4.9 · Gear and Tools Loot",
};

const FIELDS = ["ST", "Role", "S&T", "AL", "Perception", "Speed", "Armor", "Savings", "Immunities", "Resistances", "Weaknesses", "L&Y", "Chamber"];

const note = (title, text) => (text ? `<details class="roll-note"><summary>${h(title)}</summary><p>${h(text)}</p></details>` : "");

export class ReferenceView {
  constructor(tables, data) {
    this.t = tables;
    this.data = data; // { bestiary, materials, magic }
    this.table = "A";
    this.number = "";
    this.query = "";
  }

  render(sub) {
    const tabs = [["tables", T("refTables")], ["creatures", T("refCreatures")], ["items", T("refItems")], ["materials", T("refMaterials")]];
    const body = sub === "creatures" ? this.creatures() : sub === "items" ? this.items() : sub === "materials" ? this.materials() : this.tables();
    return `<nav class="ref-nav" aria-label="${h(T("navRef"))}">${tabs.map(([k, v]) => `<a href="#/ref/${k}" ${k === sub ? 'aria-current="page"' : ""}>${h(v)}</a>`).join("")}</nav>
      <div class="ref-body" data-ref-view="${h(sub)}">${body}</div>
      <p class="credit">${h(T("credit"))}</p>`;
  }

  /** Una tabla del libro entera, con los resultados iguales juntos: «1–2 Padded Armor». */
  fullTable(id, open = false) {
    const file = this.t.source(id);
    return `<details class="book-table" ${open ? "open" : ""}><summary>${h(NAMES[id])} <span class="page">${h(T("page")(file.page))}</span></summary>
      <table class="rows"><tbody>${ranges(file.results).map((r) => `<tr><td class="rows-n">${rangeLabel(r)}</td><td>${h(r.result.replace(/^\*+/, ""))}</td></tr>`).join("")}</tbody></table>
    </details>`;
  }

  // ---------------------------------------------------------------- tablas

  tables() {
    const t = this.t, id = this.table, file = t.source(id);
    const die = file.die ?? "d%";
    const n = E.typedValue(this.number, die);
    const typed = String(this.number).trim() !== "";
    const bad = typed && (n == null || !t.has(id, n));
    let out = "";
    if (typed && !bad) {
      const name = id === "A" ? t.chamberName(n) : t.name(id, n);
      const text = [E.loc(t.noteOf(id, n)), id === "A" ? E.loc(t.ruleOf(n)?.note) : "", id === "B" ? E.loc(t.fxOf(n)?.note) : ""].filter(Boolean).join(" ");
      out = `<p class="result"><span class="result-name">${h(name)}</span> <span class="page">${h(T("page")(t.page(id, n) ?? file.page))}</span></p>${note(T("note"), text)}`;
    }
    return `<div class="lookup">
        <label class="lookup-table"><span>${h(T("table"))}</span>
          <select data-ref="table">${LOOKUP.filter((x) => t.source(x)).map((x) => `<option value="${x}" ${x === id ? "selected" : ""}>${h(NAMES[x])}</option>`).join("")}</select></label>
        <label class="lookup-number"><span>${h(T("number"))}</span>
          <input id="ref-number" class="roll-input${bad ? " is-invalid" : ""}" data-ref="number" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
            value="${h(this.number)}" placeholder="${h(die)}" ${bad ? 'aria-invalid="true"' : ""}></label>
      </div>
      <div class="lookup-result" aria-live="polite">${out}</div>
      ${this.fullTable(id)}`;
  }

  // ---------------------------------------------------------------- criaturas

  creatures() {
    const q = this.query.trim().toLowerCase();
    const all = this.data.bestiary.items;
    const list = q ? all.filter((c) => [c.name, c.family, c.Role, c["S&T"], c.Chamber].some((x) => x && x.toLowerCase().includes(q))) : all;
    return `<input id="ref-q" class="search" data-ref="query" type="search" value="${h(this.query)}" placeholder="${h(T("search"))}" aria-label="${h(T("search"))}" autocomplete="off">
      ${list.length ? `<ul class="creature-list">${list.map((c) => `<li class="creature"><details>
        <summary><span class="result-name">${h(c.name)}</span>${c.family ? ` <span class="creature-family">${h(c.family)}</span>` : ""} <span class="page">${h(T("page")(c.page))}</span>${c.AL ? `<span class="creature-al">AL ${h(c.AL)}</span>` : ""}</summary>
        <dl class="stats">${FIELDS.filter((f) => c[f]).map((f) => `<dt>${h(f)}</dt><dd>${h(c[f])}</dd>`).join("")}
        ${c.Attacks ? `<dt>Attacks</dt><dd><ul>${c.Attacks.map((a) => `<li>${h(a)}</li>`).join("")}</ul></dd>` : ""}
        ${c.Special ? `<dt>Special</dt><dd>${h(c.Special.join(" · "))}</dd>` : ""}</dl>
      </details></li>`).join("")}</ul>` : `<p class="empty">${h(T("noMatches"))}</p>`}`;
  }

  // ---------------------------------------------------------------- ítems y materiales

  items() {
    const w = this.t.source("4.8");
    const magic = this.data.magic.items.filter((x) => x.kind === "magic");
    const comps = this.data.magic.items.filter((x) => x.kind === "component");
    return `<section class="ref-section"><h2>${h(T("weapons"))}</h2>
        <div class="scroll"><table class="rows"><thead><tr><th scope="col">${h(T("name"))}</th><th scope="col">${h(T("size"))}</th><th scope="col">${h(T("craft"))}</th></tr></thead><tbody>
        ${Object.entries(w.weapons ?? {}).map(([name, x]) => `<tr><th scope="row">${h(name)}</th><td>${h(E.loc(x.size))}</td><td>${h(E.loc(x.craft))}</td></tr>`).join("")}
        </tbody></table></div></section>
      <section class="ref-section">${["4.8", "4.7", "4.6", "4.9", "4.1"].map((id) => this.fullTable(id)).join("")}</section>
      <section class="ref-section"><h2>${h(T("magicItems"))}</h2>
        <div class="scroll"><table class="rows"><thead><tr><th scope="col">${h(T("name"))}</th><th scope="col">${h(T("category"))}</th><th scope="col">${h(T("rarity"))}</th><th scope="col">p.</th></tr></thead><tbody>
        ${magic.map((x) => `<tr><th scope="row">${h(x.name)}</th><td>${h((x.Category ?? "").replace(/^:\s*/, ""))}</td><td>${h(x.Rarity ?? "")}</td><td>${h(x.page)}</td></tr>`).join("")}
        </tbody></table></div></section>
      <section class="ref-section"><h2>${h(T("components"))}</h2>
        <div class="scroll"><table class="rows"><thead><tr><th scope="col">${h(T("name"))}</th><th scope="col">${h(T("element"))}</th><th scope="col">p.</th></tr></thead><tbody>
        ${comps.map((x) => `<tr><th scope="row">${h(x.name)}</th><td>${h(x.element ?? "—")}</td><td>${h(x.page)}</td></tr>`).join("")}
        </tbody></table></div></section>`;
  }

  materials() {
    const mats = this.data.materials.items;
    const table = (rows) => `<div class="scroll"><table class="rows"><thead><tr><th scope="col">${h(T("name"))}</th><th scope="col">HP</th><th scope="col">${h(T("hardness"))}</th><th scope="col">${h(T("uses"))}</th><th scope="col">p.</th></tr></thead><tbody>
      ${rows.map((m) => `<tr><th scope="row">${h(m.name)}</th><td>${h(m.HP ?? "")}</td><td>${h(m.Hardness ?? "")}</td><td>${h(m.Uses ?? "")}</td><td>${h(m.page)}</td></tr>`).join("")}</tbody></table></div>`;
    return `<section class="ref-section"><h2>${h(T("commonMaterials"))}</h2>${table(mats.filter((m) => m.kind === "common"))}</section>
      <section class="ref-section"><h2>${h(T("specialMaterials"))}</h2>${table(mats.filter((m) => m.kind === "special"))}</section>
      <section class="ref-section">${["4.2", "4.3", "4.4", "4.5"].map((id) => this.fullTable(id)).join("")}</section>`;
  }

  bind(root, rerender) {
    root.addEventListener("input", (ev) => {
      const el = ev.target;
      if (el.dataset.ref === "number") { this.number = el.value; rerender(); }
      else if (el.dataset.ref === "query") { this.query = el.value; rerender(); }
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.dataset.ref === "table") { this.table = el.value; this.number = ""; rerender(); }
    });
  }
}

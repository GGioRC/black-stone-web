// La referencia: las tablas del libro, las criaturas, los ítems y los materiales. Sólo datos y página.
import * as E from "./engine.js";
import { T } from "./i18n.js";
import { h, ranges, rangeLabel } from "./util.js";

/** Las tablas que se consultan, en el orden del libro. 3.10 es regla extendida, pero la mesa la pidió. */
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
    return `<nav class="subnav" aria-label="${h(T("navRef"))}">${tabs.map(([k, v]) => `<a href="#/ref/${k}" ${k === sub ? 'aria-current="page"' : ""}>${h(v)}</a>`).join("")}</nav>
      ${body}
      <p class="source">${h(T("source"))}</p>`;
  }

  // ---------------------------------------------------------------- tablas

  tables() {
    const t = this.t, id = this.table, file = t.source(id);
    const die = file.die ?? "d%";
    const n = E.typedValue(this.number, die);
    let out = "";
    if (String(this.number).trim()) {
      if (n == null || !t.has(id, n)) out = `<p class="err">${h(T("notInTable"))}</p>`;
      else {
        const note = t.noteOf(id, n), foot = t.footnote(id, n);
        out = `<p class="res"><strong>${h(id === "A" ? t.chamberName(n) : t.name(id, n))}</strong> <span class="pg">${h(T("page")(t.page(id, n) ?? file.page))}</span></p>
          ${foot ? `<p class="note dim">${h(E.loc(foot))}</p>` : ""}${note ? `<p class="note">${h(E.loc(note))}</p>` : ""}
          ${id === "A" && t.ruleOf(n)?.note ? `<p class="note">${h(E.loc(t.ruleOf(n).note))}</p>` : ""}
          ${id === "B" && t.fxOf(n)?.note ? `<p class="note">${h(E.loc(t.fxOf(n).note))}</p>` : ""}
          ${id === "4.8" && t.weapon(n).damage ? `<p class="note">${h(T("damage"))}: ${h(t.weapon(n).damage)}</p>` : ""}`;
      }
    }
    const rows = ranges(file.results);
    return `<section aria-labelledby="h-lookup"><h2 id="h-lookup">${h(T("lookup"))}</h2>
      <div class="lookup">
        <div><label for="ref-table">${h(T("table"))}</label>
          <select id="ref-table" data-ref="table">${LOOKUP.filter((x) => t.source(x)).map((x) => `<option value="${x}" ${x === id ? "selected" : ""}>${h(NAMES[x])}</option>`).join("")}</select></div>
        <div><label for="ref-number">${h(T("number"))} <span class="dim">(${h(die)})</span></label>
          <input id="ref-number" data-ref="number" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${h(this.number)}" class="short"></div>
      </div>
      <div class="out" aria-live="polite">${out}</div>
      ${file.note ? `<p class="note">${h(E.loc(file.note))}</p>` : ""}
      <details><summary>${h(T("allRows"))} · ${h(T("page")(file.page))}</summary>
        <table class="rows"><thead><tr><th scope="col">${h(die)}</th><th scope="col">${h(T("table"))} ${h(id)}</th><th scope="col">p.</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${rangeLabel(r)}</td><td>${h(r.result)}</td><td>${h(r.page ?? "")}</td></tr>`).join("")}</tbody></table>
      </details></section>`;
  }

  // ---------------------------------------------------------------- criaturas

  creatures() {
    const q = this.query.trim().toLowerCase();
    const all = this.data.bestiary.items;
    const list = q ? all.filter((c) => [c.name, c.family, c.Role, c["S&T"], c.Chamber].some((x) => x && x.toLowerCase().includes(q))) : all;
    const FIELDS = ["ST", "Role", "S&T", "AL", "Perception", "Speed", "Armor", "Savings", "Immunities", "Resistances", "Weaknesses", "L&Y", "Chamber"];
    return `<section aria-labelledby="h-creatures"><h2 id="h-creatures">${h(T("refCreatures"))} <span class="dim">(${list.length})</span></h2>
      <label for="ref-q">${h(T("search"))}</label>
      <input id="ref-q" data-ref="query" type="search" value="${h(this.query)}" placeholder="${h(T("searchCreatures"))}" autocomplete="off">
      ${list.length ? `<ul class="cards">${list.map((c) => `<li><details>
        <summary><strong>${h(c.name)}</strong>${c.family ? ` <span class="dim">· ${h(c.family)}</span>` : ""} <span class="pg">${h(T("page")(c.page))}</span>${c.AL ? `<br><span class="dim">AL ${h(c.AL)}</span>` : ""}</summary>
        ${c.shared ? `<p class="hint">${h(T("sharedStats"))}</p>` : ""}
        <dl>${FIELDS.filter((f) => c[f]).map((f) => `<dt>${h(f)}</dt><dd>${h(c[f])}</dd>`).join("")}
        ${c.Attacks ? `<dt>Attacks</dt><dd><ul>${c.Attacks.map((a) => `<li>${h(a)}</li>`).join("")}</ul></dd>` : ""}
        ${c.Special ? `<dt>Special</dt><dd>${h(c.Special.join(" · "))} <span class="pg">${h(T("page")(c.page))}</span></dd>` : ""}</dl>
      </details></li>`).join("")}</ul>` : `<p class="dim">${h(T("noMatches"))}</p>`}
    </section>`;
  }

  // ---------------------------------------------------------------- ítems y materiales

  items() {
    const t = this.t, w = t.source("4.8");
    const types = Object.entries(w.weapons ?? {});
    const magic = this.data.magic.items.filter((x) => x.kind === "magic");
    const comps = this.data.magic.items.filter((x) => x.kind === "component");
    const list = (id) => `<details><summary>${h(NAMES[id])} <span class="pg">${h(T("page")(t.source(id).page))}</span></summary>
      <table class="rows"><thead><tr><th scope="col">d%</th><th scope="col">${h(T("refItems"))}</th></tr></thead><tbody>
      ${ranges(t.source(id).results).map((r) => `<tr><td>${rangeLabel(r)}</td><td>${h(r.result)}</td></tr>`).join("")}</tbody></table></details>`;
    return `<section aria-labelledby="h-weapons"><h2 id="h-weapons">${h(T("weapons"))}</h2>
      <div class="scroll"><table class="rows"><thead><tr><th scope="col">${h(T("type"))}</th><th scope="col">${h(T("size"))}</th><th scope="col">${h(T("craft"))}</th><th scope="col">${h(T("damage"))}</th></tr></thead><tbody>
      ${types.map(([name, x]) => `<tr><th scope="row">${h(name)}${x.approx ? ' <span class="approx">≈</span>' : ""}</th><td>${h(E.loc(x.size))}</td><td>${h(E.loc(x.craft))}</td><td>${h(x.damage)}${E.loc(x.type) ? ` · ${h(E.loc(x.type))}` : ""}</td></tr>`).join("")}
      </tbody></table></div>
      ${w.note ? `<p class="note">${h(E.loc(w.note))}</p>` : ""}
      <p class="hint">≈ ${h(T("approx"))}</p>
      </section>
      <section aria-labelledby="h-loot-tables"><h2 id="h-loot-tables">${h(T("refTables"))}</h2>
        ${["4.8", "4.7", "4.6", "4.9", "4.1"].map(list).join("")}
      </section>
      <section aria-labelledby="h-magic"><h2 id="h-magic">${h(T("magicItems"))}</h2>
        <div class="scroll"><table class="rows"><thead><tr><th scope="col">${h(T("refItems"))}</th><th scope="col">${h(T("category"))}</th><th scope="col">${h(T("rarity"))}</th><th scope="col">p.</th></tr></thead><tbody>
        ${magic.map((x) => `<tr><th scope="row">${h(x.name)}</th><td>${h((x.Category ?? "").replace(/^:\s*/, ""))}</td><td>${h(x.Rarity ?? "")}</td><td>${h(x.page)}</td></tr>`).join("")}
        </tbody></table></div>
      </section>
      <section aria-labelledby="h-comps"><h2 id="h-comps">${h(T("components"))}</h2>
        <div class="scroll"><table class="rows"><thead><tr><th scope="col">${h(T("refItems"))}</th><th scope="col">${h(T("element"))}</th><th scope="col">p.</th></tr></thead><tbody>
        ${comps.map((x) => `<tr><th scope="row">${h(x.name)}</th><td>${h(x.element ?? "—")}</td><td>${h(x.page)}</td></tr>`).join("")}
        </tbody></table></div>
      </section>`;
  }

  materials() {
    const t = this.t, mats = this.data.materials.items, w = t.source("4.8").materials ?? {};
    const table = (rows) => `<div class="scroll"><table class="rows"><thead><tr><th scope="col">${h(T("refMaterials"))}</th><th scope="col">HP</th><th scope="col">${h(T("hardness"))}</th><th scope="col">${h(T("uses"))}</th><th scope="col">p.</th></tr></thead><tbody>
      ${rows.map((m) => `<tr><th scope="row">${h(m.name)}</th><td>${h(m.HP ?? "")}</td><td>${h(m.Hardness ?? "")}</td><td>${h(m.Uses ?? "")}</td><td>${h(m.page)}</td></tr>`).join("")}</tbody></table></div>`;
    const list = (id) => `<details><summary>${h(NAMES[id])} <span class="pg">${h(T("page")(t.source(id).page))}</span></summary>
      <table class="rows"><thead><tr><th scope="col">d%</th><th scope="col">${h(T("refMaterials"))}</th></tr></thead><tbody>
      ${ranges(t.source(id).results).map((r) => `<tr><td>${rangeLabel(r)}</td><td>${h(r.result)}</td></tr>`).join("")}</tbody></table></details>`;
    return `<section aria-labelledby="h-common"><h2 id="h-common">${h(T("commonMaterials"))}</h2>${table(mats.filter((m) => m.kind === "common"))}</section>
      <section aria-labelledby="h-special"><h2 id="h-special">${h(T("specialMaterials"))}</h2>${table(mats.filter((m) => m.kind === "special"))}</section>
      <section aria-labelledby="h-wmat"><h2 id="h-wmat">${h(T("weaponMaterials"))}</h2>
        <ul class="plain">${Object.entries(w).map(([name, m]) => `<li><strong>${h(name)}</strong>${m.approx ? ' <span class="approx">≈</span>' : ""} — ${h(E.loc(m.note))}${m.page ? ` <span class="pg">${h(T("page")(m.page))}</span>` : ""}</li>`).join("")}</ul>
      </section>
      <section aria-labelledby="h-ores"><h2 id="h-ores">${h(T("refTables"))}</h2>${["4.2", "4.3", "4.4", "4.5"].map(list).join("")}</section>`;
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

// Las reglas de la cámara: de los dados tecleados a lo que la mesa tiene que saber.
// Nada aquí tira dados. Todo número sale de lo que tecleó la mesa (decisión del 2026-09-13).

/** Las tablas del libro y el archivo de cada una. */
export const FILES = {
  A: "table-a", B: "table-b", C: "table-c", D: "table-d",
  "3.1": "table-3-1", "3.2": "table-3-2", "3.2.spark": "table-3-2-spark", "3.2.wall": "table-3-2-wall",
  "3.3": "table-3-3", "3.4": "table-3-4", "3.5": "table-3-5", "3.6": "table-3-6", "3.7": "table-3-7",
  "3.8": "table-3-8", "3.9": "table-3-9", "3.10": "table-3-10",
  "4.1": "table-4-1", "4.2": "table-4-2", "4.3": "table-4-3", "4.4": "table-4-4", "4.5": "table-4-5",
  "4.6": "table-4-6", "4.7": "table-4-7", "4.8": "table-4-8", "4.9": "table-4-9",
};

const ENCOUNTER = new Set(["3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.2", "3.2.spark", "3.2.wall", "3.3", "3.4", "4.1"]);
const RESOURCE = new Set(["4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.9"]);
const ORE = new Set(["4.3", "4.4", "4.5"]);

/** Las Siete Tiradas, en el orden del libro. La séptima, Mímicos, es opcional y secreta (p. 85). */
export const ROLLS = [
  { id: "chamber", die: "d%", table: "A" },
  { id: "condition", die: "d%", table: "B" },
  { id: "entries", die: "d6", table: null },
  { id: "timer", die: "d10", table: null },
  { id: "loot", die: "d%", table: "C" },
  { id: "inhabitant", die: "d%", table: "D" },
  { id: "mimic", die: "d%", table: null },
];
export const PUBLIC_ROLLS = ROLLS.slice(0, 6).map((r) => r.id);
export const rollDef = (id) => ROLLS.find((r) => r.id === id);

export const TIMER_DEFAULT_DICE = 4;
export const ONE_ENTRY_MULTIPLIER = 10;
export const WINDOW_KEY = "timer.window";
export const INSIDE_KEY = "chamber.inside";
export const MIMIC_KEY = "mimic.0";
export const DOUBLE_MODE = "condition.state.double-mode";
export const TORCHER_TRIGGER = "condition.state.torcher-trigger";
export const LEGENDARY_MODE = "condition.state.legendary-mode";
export const DOORS = "chamber.state.manual-doors";
export const ENTRY = "chamber.state.entry-unlocked";

/** Hogueras: sus puertas se abren y cierran a voluntad (p. 108). */
export const BONFIRES = new Set([27, 28, 30, 42, 71, 73, 85, 88, 98]);
/** La entrada no abre hasta la primera muerte, o hasta encender la hoguera en el 34 (pp. 105, 126). */
export function entryTrigger(chamber) {
  if ([36, 40, 44, 48, 53, 57, 61, 65].includes(chamber)) return "first-death";
  if (chamber === 34) return "bonfire-lit";
  return null;
}

// ---------------------------------------------------------------- idioma de los datos

let lang = "es";
export const setDataLang = (l) => { lang = l; };
/** Un texto del índice en los dos idiomas. Si falta uno, sale el otro. */
export const loc = (l) => (l ? (lang === "es" ? l.es || l.en : l.en || l.es) || "" : "");

// ---------------------------------------------------------------- dados del libro

/** Un dado del libro: «1d6+1», «10d%», «4+1d10», «1d4-1». Se teclea la suma de los dados; el sumando lo pone la app. */
export class Formula {
  constructor(times, sides, plus) { this.times = times; this.sides = sides; this.plus = plus; }
  get die() { return (this.times === 1 ? "" : `${this.times}`) + "d" + (this.sides === 100 ? "%" : this.sides); }
  get label() {
    const p = this.plus > 0 ? `+${this.plus}` : this.plus < 0 ? `${this.plus}` : "";
    return (this.times === 1 ? "1" : "") + this.die + p;
  }
  get min() { return this.times; }
  get max() { return this.times * this.sides; }
  total(typed) { return typed + this.plus; }
  equals(o) { return o && o.times === this.times && o.sides === this.sides && o.plus === this.plus; }
}
export const D100 = new Formula(1, 100, 0);
/** La entrada aguanta abierta 1+1d6 rondas (p. 84). */
export const WINDOW = new Formula(1, 6, 1);

const DICE = /(?:(\d+)\s*\+\s*)?(\d*)d(\d+|%)(?:\s*([+-])\s*(\d+))?/g;

// Quita lo que une un dado con su nombre («plus», «and» en los bordes), no el «and» de «Gear and Tools».
const tidy = (s) => s.replace(/[()&+]/g, " ").trim().replace(/^(plus|and)\b|\b(plus|and)$/g, "").trim().replace(/\s+/g, " ");

/** Cada dado de un texto del libro con lo que cuenta. «1d6+1 Nothics» → Nothics; «Ghoul Pack (1d4+1)» → Ghoul Pack. */
export function countsOf(text) {
  const clean = (text || "").replace(/^[*†ª]+|[*†ª]+$/g, "");
  const found = [...clean.matchAll(DICE)];
  return found.map((m, i) => {
    const [, pre, times, sides, sign, post] = m;
    const plus = (pre ? +pre : 0) + (post ? +post : 0) * (sign === "-" ? -1 : 1);
    const formula = new Formula(times ? +times : 1, sides === "%" ? 100 : +sides, plus);
    const end = m.index + m[0].length;
    const after = clean.substring(end, found[i + 1] ? found[i + 1].index : clean.length);
    const prev = found[i - 1];
    const before = clean.substring(prev ? prev.index + prev[0].length : 0, m.index);
    return { formula, what: tidy(after) || tidy(before) };
  });
}
export const formulaOf = (text) => countsOf(text)[0]?.formula ?? null;

/** «50%<»: sucede si el d% sale menor que 50. «>75%»: si sale mayor que 75 (p. 22). */
export class Chance {
  constructor(limit, under) { this.limit = limit; this.under = under; }
  get label() { return this.under ? `${this.limit}%<` : `>${this.limit}%`; }
  passes(n) { return this.under ? n < this.limit : n > this.limit; }
  static of(text) {
    const m = /(>)?\s*(\d+)%\s*(<)?/.exec(text || "");
    return m ? new Chance(+m[2], !m[1]) : null;
  }
}

/** Lo tecleado, como número. En un d%, el 0 y el 00 valen 100. */
export function typedValue(buffer, die) {
  const s = String(buffer ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n === 0 && die.includes("%") ? 100 : n;
}

// ---------------------------------------------------------------- las tablas

export class Tables {
  constructor(files) { this.files = files; }

  static async load(base = "data/") {
    const entries = await Promise.all(Object.entries(FILES).map(async ([id, f]) => {
      const res = await fetch(`${base}${f}.json`);
      if (!res.ok) throw new Error(`No se pudo leer ${f}.json`);
      return [id, await res.json()];
    }));
    return new Tables(Object.fromEntries(entries));
  }

  source(t) { return this.files[t] ?? null; }
  entry(t, n) { return this.files[t]?.results?.[String(n)] ?? { result: "?", page: null }; }
  has(t, n) { return this.entry(t, n).result !== "?"; }
  name(t, n) { return this.entry(t, n).result.replace(/^\*+/, "").replace(/[†ª]+$/, ""); }
  page(t, n) { return this.entry(t, n).page ?? null; }
  /** El dado que pide la tabla: «d%», «d12». */
  die(t) { return this.files[t]?.die ?? "d%"; }
  /** Cuántos resultados tiene: 100 en las d%, 12 en la 3.7. */
  size(t) { return Object.keys(this.files[t]?.results ?? {}).length; }
  chamberName(n) { return this.name("A", n).replace(/\s*\(\d+d10\)/, "").replace(/\s*\[([^\]]+)\]/, "").trim(); }
  /** Lo que está en la cámara al 100%, entre corchetes en la Tabla A (p. 81): Cuzgulda, Water, Circle. */
  inside(n) { return n == null ? null : (/\s*\[([^\]]+)\]/.exec(this.name("A", n))?.[1] ?? null); }
  ruleOf(n) { return n == null ? null : this.files.A.rules?.[String(n)] ?? null; }
  fxOf(n) { return n == null ? null : this.files.B.fx?.[String(n)] ?? null; }

  /** Lo que dice una tabla que se lee entera: el efecto de la magia salvaje, la nota de un botín. */
  noteOf(t, n) {
    const file = this.files[t];
    if (!file) return null;
    if (file.fx?.[String(n)]?.note) return file.fx[String(n)].note;
    return file.special?.[this.entry(t, n).result] ?? null;
  }

  /** La nota al pie de un resultado de las tablas C y D: «*», «**», «†», «††», «ª», o la de los números sin marca. */
  footnote(t, n) {
    if (t !== "C" && t !== "D") return null;
    const notes = this.files[t].footnotes ?? {};
    const raw = this.entry(t, n).result;
    const mark = /^\*+|[†ª]+$/.exec(raw)?.[0];
    if (t === "C" && mark === "*" && !raw.includes("(")) return notes.ore ?? null;
    if (mark) return notes[mark] ?? null;
    if (raw.includes("(")) return notes.plain ?? null;
    return null;
  }

  /** Un resultado de la Tabla 4.8 con su tipo y su material: «Short Bow (wood)». */
  weapon(n) {
    const raw = this.entry("4.8", n).result;
    const m = /^(.*?)\s*(?:\((.*)\))?$/.exec(raw);
    const base = m?.[1] ?? raw;
    const material = m?.[2]?.toLowerCase() || null;
    const file = this.files["4.8"];
    const typeKey = Object.keys(file.weapons ?? {}).find((k) => k.toLowerCase() === base.toLowerCase());
    const type = typeKey ? file.weapons[typeKey] : null;
    const mat = material ? file.materials?.[material] ?? null : null;
    return { name: raw, type, material, mat, special: file.special?.[raw] ?? null };
  }
}

// ---------------------------------------------------------------- las seis tiradas

/** Todo lo que la app deduce de los siete dados. */
export function derive(r, t) {
  const rule = t.ruleOf(r.chamber);
  const timerDice = rule?.timerDice ?? TIMER_DEFAULT_DICE;
  let entries = r.entries ?? null;
  let entryDie = "d6";
  let entryChange = null;
  const er = rule?.entries;
  if (er?.fixed != null) { entries = er.fixed; entryChange = "fixed"; }
  else if (er?.dice != null) { entryDie = er.dice; entryChange = "other-die"; }
  else if (er?.min != null && entries != null && entries < er.min) { entries = er.min; entryChange = "raised"; }

  const conditionExcluded = r.condition != null && rule != null && (rule.excludeCodes ?? []).includes(r.condition);
  const fx = conditionExcluded ? null : t.fxOf(rule?.fixedCondition ?? r.condition);

  const steps = [];
  let timer = null;
  if (r.timer != null) {
    let v = r.timer;
    steps.push({ kind: "dice", value: v });
    if (fx?.timer === "sealed") steps.push({ kind: "sealed" });
    else if (fx?.timer === "free") steps.push({ kind: "open" });
    else {
      if (fx?.timer === "x2") { v *= 2; steps.push({ kind: "extended", value: v }); }
      if (fx?.timer === "half") { v = Math.floor(v / 2); steps.push({ kind: "reduced", value: v }); }
      if (entries === 1) { v *= ONE_ENTRY_MULTIPLIER; steps.push({ kind: "one-entry", value: v }); }
      if (fx?.timer === "jammed") steps.push({ kind: "jammed" });
      timer = v;
    }
  }
  return { rule, timerDice, entries, entryDie, entryChange, conditionExcluded, fx, steps, timer,
    sealed: fx?.timer === "sealed", open: fx?.timer === "free" };
}

/** La cámara prohíbe esta tirada: el 85 no tira Habitantes, el 93 ni Condición ni Mímicos. */
export const omitted = (roll, r, t) => (t.ruleOf(r.chamber)?.skip ?? []).includes(roll);
/** No se teclea: la cámara la prohíbe, o fija su valor. */
export const skipped = (roll, r, t) =>
  omitted(roll, r, t) || (roll === "entries" && t.ruleOf(r.chamber)?.entries?.fixed != null);
/** Las tiradas públicas que faltan por teclear, en el orden del libro. La primera es la siguiente. */
export const pending = (r, t) => PUBLIC_ROLLS.filter((id) => !skipped(id, r, t) && r[id] == null);

export const sides = (die) => (die.includes("%") ? 100 : +(/d(\d+)/.exec(die)?.[1] ?? 6));

/** Lo que se puede teclear en cada tirada: lo que pueden sacar sus dados. */
export function rangeOf(roll, d) {
  if (roll === "entries") return [1, sides(d.entryDie)];
  if (roll === "timer") return [d.timerDice, d.timerDice * 10];
  return [1, 100];
}

/** Escribe un dado. La cámara manda: cambiarla vacía las demás, porque todas cuelgan de ella (p. 84). */
export function typeRoll(r, roll, n) {
  if (roll === "chamber" && n !== r.chamber) return { chamber: n };
  return { ...r, [roll]: n };
}

/** Lo tecleado en filas hijas que sigue valiendo: se borra lo que colgaba de una tirada que cambió. */
export function keep(typed, before, after) {
  const changed = ROLLS.map((x) => x.id).filter((id) => before[id] !== after[id]);
  return Object.fromEntries(Object.entries(typed).filter(([k]) => !changed.some((id) => k.startsWith(id + "."))));
}

/** Severidad de la tirada secreta. Con menos de 10, Maze Mimics en lugar del Common Mimic (pp. 22, 85). */
export const mimicKind = (n) => (n < 10 ? "infested" : n < 50 ? "common" : "none");

/** La entrada en una ronda: si está abierta y cuántas rondas faltan para el próximo cambio. */
export function door(round, timer, openFor) {
  const period = timer + openFor;
  const phase = round % period;
  return phase < timer ? { open: false, rounds: timer - phase } : { open: true, rounds: period - phase };
}

/** Se puede huir por un Círculo si la condición es Circle o la cámara trae uno (p. 93). */
export const circle = (r, t) =>
  t.ruleOf(r.chamber)?.circle === true || (r.condition != null && t.name("B", r.condition) === "Circle") ||
  t.inside(r.chamber) === "Circle";

// ---------------------------------------------------------------- filas hijas

/** Una tirada que nace de otra. La pide el libro, la tira la mesa y la app suma. */
function child(key, kind, formula, of, page, opts = {}) {
  return { key, kind, formula, of, page, chance: null, required: true, table: null, from: null,
    secret: false, excluded: [], ...opts };
}

const LOOT_LABELS = {
  "4.8": { en: "Weapon", es: "Arma" }, "4.7": { en: "Armor", es: "Armadura" },
  "4.9": { en: "Gear and tools", es: "Equipo y herramientas" }, "4.6": { en: "Clothing", es: "Ropa" },
  "4.2": { en: "Foraging", es: "Forrajeo" }, "4.3": { en: "Common metal", es: "Metal común" },
  "4.4": { en: "Special metal", es: "Metal especial" }, "4.5": { en: "Mineral", es: "Mineral" },
};
const lootLabel = (t) => loc(LOOT_LABELS[t] ?? { en: "Loot", es: "Botín" });

/** Las tablas que nombra el asterisco de la Tabla C (p. 167). Un objeto mágico lo elige el Amo. */
function lootTableFor(result) {
  if (result.startsWith("*Weapons")) return "4.8";
  if (result.startsWith("*Armors")) return "4.7";
  if (result.startsWith("*Gear and Tools")) return "4.9";
  if (result.startsWith("*Clothing")) return "4.6";
  if (result.startsWith("*Foraging")) return "4.2";
  if (result === "*Common Metal Ore") return "4.3";
  if (result === "*Special Metal Ore") return "4.4";
  if (result === "*Mineral Ore") return "4.5";
  return null;
}

/** El botín encadenado: armas, menas, cadáveres. Cada tabla nueva pide su propio d%. */
export function lootChildren(raw, typed, t, { prefix = "loot", directTable = null, directKey = `${prefix}.detail`,
  title = null, mine = false } = {}) {
  const list = [];
  const queue = [];
  const enqueue = (key, table, label, isMine = false) => queue.push({ key, table, title: label, mine: isMine });
  const amount = (key, formula, what) =>
    list.push(child(key, "extra", formula, what, 188, { required: false, from: "loot" }));

  if (directTable) enqueue(directKey, directTable, title ?? lootLabel(directTable), mine);
  const root = directTable ? null : lootTableFor(raw);
  if (root) {
    const count = formulaOf(raw);
    if (!count) enqueue(`${prefix}.detail`, root, lootLabel(root), true);
    else if (typed[`${prefix}.0`] != null) {
      for (let i = 0; i < count.total(typed[`${prefix}.0`]); i++) {
        const key = root === "4.8" ? `${prefix}.0.w${i + 1}` : `${prefix}.0.item${i + 1}`;
        enqueue(key, root, `${lootLabel(root)} ${i + 1}`);
      }
    }
  }
  if (raw.startsWith("Old Corpses") || raw.startsWith("Fresh Corpses")) {
    const count = typed[`${prefix}.0`];
    if (count != null) {
      for (let i = 0; i < count; i++) {
        const key = `${prefix}.0.corpse${i + 1}`;
        const corpse = loc({ en: `Corpse ${i + 1}`, es: `Cadáver ${i + 1}` });
        amount(`${key}.supplies`, new Formula(1, 4, 0), `${corpse} · ${loc({ en: "Supplies", es: "Provisiones" })}`);
        for (const table of ["4.6", "4.7", "4.8"]) enqueue(`${key}.${table}`, table, `${corpse} · ${lootLabel(table)}`);
      }
      list.push(child(`${prefix}.0.alcohol`, "chance", D100, loc({ en: "One unit of alcohol", es: "Una unidad de alcohol" }), 188,
        { chance: new Chance(10, false), required: false, from: "loot" }));
    }
  }
  // Cada expansión necesita su dado tecleado. Hasta los re-tiros entre tablas se detienen en el primero sin teclear.
  while (queue.length) {
    const item = queue.shift();
    const file = t.source(item.table);
    if (!file) continue;
    list.push(child(item.key, item.table === "4.8" ? "weapon" : "extra", D100, `${item.title} · ${file.table}`, file.page,
      { required: false, table: item.table, from: "loot" }));
    const n = typed[item.key];
    if (n == null) continue;
    const result = t.entry(item.table, n).result;
    if (item.table === "C") {
      countsOf(result).forEach(({ formula, what }, i) =>
        list.push(child(`${item.key}.${i}`, result.startsWith("*") ? "times" : "count", formula, what, t.page(item.table, n),
          { required: false, from: "loot" })));
      list.push(...lootChildren(result, typed, t, { prefix: item.key }));
      continue;
    }
    let next = null;
    if (item.table === "4.3" && n <= 2) next = "4.5";
    else if (item.table === "4.3" && n >= 99) next = "4.4";
    else if (item.table === "4.4" && n <= 2) next = "4.3";
    else if ((item.table === "4.6" || item.table === "4.9" || item.table === "4.8") && n >= 99) next = item.table;
    else if (item.table === "4.8" && result.includes("(common metal)")) next = "4.3";
    if (next) enqueue(`${item.key}.detail`, next, `${item.title} · ${lootLabel(next)}`, item.mine);
    else {
      let amounts = [];
      if (item.mine && item.table === "4.3") amounts = [{ formula: new Formula(1, 10, 0), what: result }];
      else if (item.table === "4.2") amounts = countsOf(result).length ? countsOf(result) : [{ formula: new Formula(1, 4, 0), what: result }];
      else if (item.mine || item.table === "4.9") amounts = countsOf(result);
      amounts.forEach(({ formula, what }, i) =>
        // La cantidad de una veta sólo se tira si la extracción sale bien, ya jugando.
        list.push(child(`${item.key}.count.${i}`, "extra", formula, what,
          t.page(item.table, n), { required: false, from: "loot", extraction: item.mine })));
      if (item.table === "4.2" && ((n >= 19 && n <= 36) || (n >= 46 && n <= 63))) {
        list.push(child(`${item.key}.seeds.0`, "extra", new Formula(1, 4, 0), loc({ en: "Seeds", es: "Semillas" }),
          n <= 54 ? 173 : 174, { required: false, from: "loot" }));
      }
    }
  }
  return list;
}

/** Lo que añade una cámara o una condición. Con probabilidad o con dado, es una fila hija. */
function addExtra(list, key, e, page, from, typed, t) {
  const what = loc(e.of);
  const chance = Chance.of(e.chance ?? "");
  if (chance) {
    list.push(child(`${key}.chance`, "chance", D100, what, page, { chance, required: false, from }));
    if (!(typed[`${key}.chance`] != null && chance.passes(typed[`${key}.chance`]))) return;
  }
  const formula = formulaOf(e.die ?? "");
  const table = e.table && t.source(e.table) ? e.table : null;
  if (table && (e.mode === "times" || table === "C")) {
    if (formula) list.push(child(key, "times", formula, what, page, { required: false, from }));
    const fixed = /^\d+$/.test(e.die ?? "") ? +e.die : null;
    const count = fixed ?? (typed[key] != null && formula ? formula.total(typed[key]) : null);
    if (count == null) return;
    for (let i = 0; i < count; i++) {
      if (ENCOUNTER.has(table)) addExtra(list, `${key}.item${i + 1}`, { ...e, mode: null, die: e.selectionDie ?? "1d%", chance: null }, page, from, typed, t);
      else list.push(...lootChildren("", typed, t, { directTable: table, directKey: `${key}.item${i + 1}`, title: `${what} · ${i + 1}` }));
    }
  } else if (formula) {
    if (table && (RESOURCE.has(table) || table === "4.8")) {
      list.push(...lootChildren("", typed, t, { directTable: table, directKey: key, title: what, mine: ORE.has(table) }));
    } else {
      const other = e.differentFrom ? typed[`chamber.extra.${e.differentFrom}`] : null;
      list.push(child(key, "extra", formula, what, page,
        { required: e.required === true, table, from, excluded: other != null ? [other] : [] }));
      if (table && typed[key] != null) {
        const n = typed[key];
        countsOf(t.entry(table, n).result).filter((c) => c.formula.sides > 0).forEach(({ formula: f, what: label }, i) =>
          list.push(child(`${key}.count.${i}`, "count", f, label, t.page(table, n), { required: false, from })));
        (t.source(table)?.fx?.[String(n)]?.rolls ?? []).forEach((c, i) =>
          addExtra(list, `${key}.effect.${i}`, c, t.page(table, n), from, typed, t));
      }
      if (e.lootDetails && typed[key] != null) {
        list.push(...lootChildren(e.lootDetails, { ...typed, [`${key}.0`]: formula.total(typed[key]) }, t, { prefix: key }));
      }
    }
  }
}

const inRange = (n, a, b) => n != null && n >= a && n <= b;

/** En qué tirada se muestra lo que añade una cámara: el botín en Botín, los enemigos en Habitantes, lo demás en Cámara. */
export function sectionOf(kind) {
  if (["loot", "exclusiveLoot", "ultimate"].includes(kind)) return "loot";
  if (["inhabitant", "threat"].includes(kind)) return "inhabitant";
  return "chamber";
}

/** Lo que la cámara trae sin tirar nada: «agua abundante», «Tears of the Gods». Va como línea fija en su tirada. */
export function fixedExtras(rule) {
  return (rule?.extras ?? []).filter((e) => !e.die && !e.chance && !e.repeat)
    .map((e) => ({ of: e.of, kind: e.kind, section: sectionOf(e.kind) }));
}

/** Las filas hijas de la cámara, en orden: la ventana de la entrada y cada dado que traen los resultados. */
export function children(r, d, t, typed = {}) {
  const list = [];
  if (d.timer != null) list.push(child(WINDOW_KEY, "window", WINDOW, "", 84, { from: "timer" }));
  for (const roll of ["condition", "loot", "inhabitant"]) {
    const n = r[roll];
    if (n == null) continue;
    const table = rollDef(roll).table;
    if (skipped(roll, r, t) || (roll === "condition" && d.conditionExcluded)) continue;
    const raw = t.entry(table, n).result;
    // En el botín, el asterisco dice que el dado es cuántas veces se tira su tabla (p. 167).
    const kind = roll === "loot" && raw.startsWith("*") ? "times" : "count";
    countsOf(raw).forEach(({ formula, what }, i) =>
      list.push(child(`${roll}.${i}`, kind, formula, what, t.page(table, n), { from: roll })));
    if (roll === "loot") list.push(...lootChildren(raw, typed, t));
  }
  const extras = d.rule?.extras ?? [];
  extras.forEach((e, i) => {
    if (e.repeat != null) return;
    const from = ["loot", "exclusiveLoot", "ultimate"].includes(e.kind) ? "loot" : null;
    const dependency = e.unless ? extras.find((x) => x.id === e.unless) : null;
    let key = `chamber.extra.${e.id ?? i}`;
    if (dependency) key = `chamber.extra.${dependency.id}.fallback.${e.id}`;
    else if (e.differentFrom) key = `chamber.extra.${e.differentFrom}.distinct.${e.id}`;
    if (dependency) {
      const chance = Chance.of(dependency.chance ?? "");
      const answer = typed[`chamber.extra.${dependency.id}.chance`];
      if (answer == null || !chance || chance.passes(answer)) return;
    }
    const start = list.length;
    const parent = e.perKey ? extras.find((x) => x.id === e.perKey) : null;
    if (parent) {
      const formula = formulaOf(parent.die ?? "");
      const answer = typed[`chamber.extra.${parent.id}`];
      if (formula && answer != null) {
        for (let level = 0; level < formula.total(answer); level++) {
          addExtra(list, `chamber.extra.${parent.id}.level${level + 1}.${e.id}`,
            { ...e, of: { en: `Level ${level + 1} · ${e.of?.en ?? ""}`, es: `Nivel ${level + 1} · ${e.of?.es ?? ""}` } },
            d.rule.page, from, typed, t);
        }
      }
    } else addExtra(list, key, e, d.rule.page, from, typed, t);
    for (let k = start; k < list.length; k++) {
      list[k].section ??= sectionOf(e.kind);
      if (e.kind === "ultimate") list[k].group = "ultimate";
    }
  });
  const fx = d.fx;
  if (fx) {
    // El Ghoul Pack trae su 1d4+1 en el nombre y en el dato: se pide una vez.
    const named = r.condition != null ? countsOf(t.entry("B", r.condition).result).map((c) => c.formula) : [];
    (fx.rolls ?? []).forEach((e, i) => {
      if (e.repeat != null) return; // ésa se tira jugando
      if (inRange(r.condition, 37, 41) || (inRange(r.condition, 70, 74) && i > 0)) return;
      if (inRange(r.condition, 65, 69) && typed[LEGENDARY_MODE] === 2) return;
      const f = formulaOf(e.die ?? "");
      if (!named.some((x) => x.equals(f))) {
        const start = list.length;
        addExtra(list, `condition.fx.${i}`, e, fx.page, "condition", typed, t);
        for (let k = start; k < list.length; k++) {
          if (["3.2", "3.2.spark", "3.2.wall", "3.4", "3.3"].includes(list[k].table)) list[k].required = true;
        }
      }
    });
    if (inRange(r.condition, 37, 41) && typed[DOUBLE_MODE] === 1) {
      const start = list.length;
      addExtra(list, "condition.double.encounter", { die: "1d%", table: "D", of: { en: "Second encounter · Table D", es: "Segundo encuentro · Tabla D" } }, 92, "condition", typed, t);
      for (let k = start; k < list.length; k++) list[k].required = true;
    }
    if (inRange(r.condition, 60, 64) && typed[TORCHER_TRIGGER] === 1) {
      addExtra(list, "condition.torcher.encounter", { die: "1d%", table: "D", of: { en: "Inhabitant drawn by the Torcher · Table D", es: "Habitante atraído por Torcher · Tabla D" } }, 92, "condition", typed, t);
    }
    if (inRange(r.condition, 70, 74)) {
      const count = typed["condition.fx.0"];
      if (inRange(count, 2, 20)) {
        for (let i = 0; i < count; i++) {
          const prefix = `condition.market.vendor${i + 1}`;
          list.push(...lootChildren("", typed, t, { directTable: "C", directKey: `${prefix}.loot`,
            title: loc({ en: `Myconid ${i + 1} offer · not bought`, es: `Oferta Myconid ${i + 1} · no adquirida` }) })
            .map((c) => ({ ...c, from: "condition", required: false })));
          addExtra(list, `${prefix}.trinket`, { die: "1d%", table: "4.1", of: { en: `Myconid ${i + 1} · trinket for sale`, es: `Myconid ${i + 1} · baratija en venta` } }, 93, "condition", typed, t);
          const trinket = typed[`${prefix}.trinket`];
          const raw = { 45: "*Clothing (1d6+1)", 47: "*Gear and Tools (1d6+1)", 48: "*Armors (1d6+1)", 50: "*Weapons (1d8+1)" }[trinket];
          if (raw) {
            const extra = typed[`${prefix}.trinket.count.0`] != null ? { [`${prefix}.trinket.0`]: typed[`${prefix}.trinket.count.0`] } : {};
            list.push(...lootChildren(raw, { ...typed, ...extra }, t, { prefix: `${prefix}.trinket` })
              .map((c) => ({ ...c, from: "condition", required: false })));
          }
          if (trinket === 59) addExtra(list, `${prefix}.trinket.archfiend`, { die: "1d12", table: "3.7", of: { en: "Punishment this token comes from", es: "Castigo del que procede el token" } }, 170, "condition", typed, t);
        }
        if (count > 10) list.push(child("condition.market.visitors", "extra", new Formula(1, 4, 0),
          loc({ en: "Raiders visiting from another Bonfire", es: "Incursores de visita de otra Hoguera" }), 93, { required: false, from: "condition" }));
      }
    }
  }
  // Lo que la cámara trae al 100%, entre corchetes en la Tabla A (p. 81): no se tira, está.
  const inside = t.inside(r.chamber);
  if (inside) list.push(child(INSIDE_KEY, "inside", D100, inside, 81, { required: false, from: "loot" }));
  // Infestada: el libro manda tirar 1d10 Maze Mimics (p. 85). Es tan secreta como su d%.
  if (r.mimic != null && mimicKind(r.mimic) === "infested") {
    list.push(child(MIMIC_KEY, "count", new Formula(1, 10, 0), "Maze Mimics", 297, { required: false, from: "mimic", secret: true }));
  }
  return list;
}

/** Si un valor tecleado vale para esa fila: cabe en sus dados, no está excluido y existe en su tabla. */
export function answerValid(c, value, t) {
  if (value == null || value < c.formula.min || value > c.formula.max) return false;
  if (c.excluded.includes(value)) return false;
  return !c.table || t.has(c.table, value);
}

export const conditionChoicePending = (r, typed) => inRange(r.condition, 37, 41) && ![1, 2].includes(typed[DOUBLE_MODE]);
/** En la Cámara de los Sueños no vale la Prohibición de Adivinación: hay que re-tirar la escuela (p. 130). */
export const schoolExcluded = (r, typed) => r.chamber === 59 && inRange(r.condition, 80, 84) && typed["condition.fx.0"] === 3;

/** Lo que falta para poder entrar: las seis tiradas, las hijas obligatorias y las decisiones de la mesa. */
export function blockers(r, typed, t) {
  const d = derive(r, t);
  const rolls = pending(r, t);
  const kids = children(r, d, t, typed).filter((c) => c.required && !answerValid(c, typed[c.key], t));
  return { rolls, children: kids, excluded: d.conditionExcluded, choice: conditionChoicePending(r, typed),
    school: schoolExcluded(r, typed), ready: !rolls.length && !kids.length && !d.conditionExcluded &&
      !conditionChoicePending(r, typed) && !schoolExcluded(r, typed) };
}

/** Lo que se tira una y otra vez mientras se juega: la magia salvaje y las ocurrencias de la cámara. */
export function live(r, d) {
  const out = [];
  (d.fx?.rolls ?? []).forEach((e) => {
    if (e.repeat && e.table) out.push({ key: `live.${e.repeat}`, extra: e, page: d.fx.page, source: "condition" });
  });
  (d.rule?.extras ?? []).forEach((e) => {
    if (e.repeat) out.push({ key: `chamber.extra.${e.id}`, extra: e, page: d.rule.page, source: "chamber" });
  });
  return out;
}

/** Resuelve una ocurrencia jugando: su probabilidad, su dado y, si lo hay, su tabla. */
export function resolveLive(item, { chance: chanceRoll = null, total = null } = {}, t) {
  const e = item.extra;
  const chance = Chance.of(e.chance ?? "");
  if (chance && chanceRoll == null) return null;
  if (chance && !chance.passes(chanceRoll)) {
    return { text: e.repeat === "entry-found" ? loc({ en: "The entry is not false", es: "La entrada no es falsa" }) : loc({ en: "It does not happen", es: "No sucede" }) };
  }
  if (e.repeat === "entry-found") return { text: loc({ en: "False entry: found out on crossing and coming back", es: "Entrada falsa; se descubre al cruzar y regresar a la cámara" }) };
  const formula = formulaOf(e.die ?? "");
  if (!formula) return { text: loc({ en: "It happens", es: "Sucede" }) };
  if (total == null || total < formula.min || total > formula.max) return null;
  const value = formula.total(total);
  if (e.table && t.source(e.table)) {
    if (!t.has(e.table, value)) return null;
    return { text: t.name(e.table, value), table: e.table, value, page: t.page(e.table, value), note: t.noteOf(e.table, value) };
  }
  return { text: `${value} · ${loc(e.of)}`, value };
}

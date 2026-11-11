// La cámara: las Siete Tiradas con lo que cuelga de cada una, el juego dentro y el cierre.
// El marcado lleva clases con nombre (roll-section, derived-row, dice-row…) para el diseño final.
import * as E from "./engine.js";
import { T } from "./i18n.js";
import { askButton, h, idOf, store } from "./util.js";

const EMPTY = () => ({ rolls: {}, typed: {}, buffers: {}, round: 0, locked: false, mimicHidden: true,
  live: [], liveBuffers: {}, deaths: 0 });

/** Las notas de las tablas C y D que sólo explican cómo leer la tabla: la app ya lo hace. */
const READING_NOTES = { C: ["*", "plain", "ore"], D: ["†"] };

/** «Arma 2 · 4.8» → «Arma»; «diez tiradas extra · 3 · C» → «diez tiradas extra». */
const groupTitle = (of) => of.replace(/\s·\s[\w.]+$/, "").replace(/(\s·\s|\s)\d+$/, "");
const REPEATED = /^(.*)\.(item|w)(\d+)$/;

export class ChamberView {
  constructor(tables, onLogChange) {
    this.t = tables;
    this.onLogChange = onLogChange;
    this.d = { ...EMPTY(), ...store.get("bs.draft", {}) };
    this.log = store.get("bs.log", []);
    this.mimics = store.get("bs.mimics", false);
  }

  save() { store.set("bs.draft", this.d); }

  // ---------------------------------------------------------------- cambios

  /** Una de las siete. Cambiar la cámara vacía todo lo demás (p. 84). */
  setRoll(id, raw) {
    const d = this.d;
    d.buffers[id] = raw;
    const der = E.derive(d.rolls, this.t);
    const n = E.typedValue(raw, id === "entries" ? der.entryDie : E.rollDef(id).die);
    const [a, b] = E.rangeOf(id, der);
    const before = d.rolls;
    let after;
    if (n == null || n < a || n > b) {
      after = id === "chamber" ? {} : { ...before };
      delete after[id];
    } else after = E.typeRoll(before, id, n);
    if (id === "chamber" && after.chamber !== before.chamber) { d.buffers = { chamber: raw }; d.typed = {}; }
    else d.typed = E.keep(d.typed, before, after);
    d.rolls = after;
    this.save();
  }

  /** Una tirada derivada. Lo que colgaba de ella se borra: dependía de este valor. */
  setChild(key, raw) {
    const d = this.d;
    const c = this.children().find((x) => x.key === key);
    if (!c) return;
    d.buffers[key] = raw;
    const n = E.typedValue(raw, c.formula.die);
    for (const k of Object.keys(d.typed)) {
      if (k.startsWith(key + ".") && k !== `${key}.chance`) { delete d.typed[k]; delete d.buffers[k]; }
    }
    if (n != null && E.answerValid(c, n, this.t)) d.typed[key] = n;
    else delete d.typed[key];
    this.save();
  }

  setChoice(key, value) {
    this.d.typed[key] = value;
    if (key === E.DOUBLE_MODE && value === 2) this.drop("condition.double.encounter");
    if (key === E.TORCHER_TRIGGER && value === 0) this.drop("condition.torcher.encounter");
    if (key === E.LEGENDARY_MODE && value === 2) this.drop("condition.fx.0");
    this.save();
  }

  drop(prefix) {
    for (const map of [this.d.typed, this.d.buffers]) {
      for (const k of Object.keys(map)) if (k === prefix || k.startsWith(prefix + ".")) delete map[k];
    }
  }

  children() { return E.children(this.d.rolls, E.derive(this.d.rolls, this.t), this.t, this.d.typed); }

  reset() { this.d = EMPTY(); this.save(); }

  /** Entra si ya está todo; si no, lleva el foco a lo primero que falta. */
  enter(root) {
    if (E.blockers(this.d.rolls, this.d.typed, this.t).ready) {
      this.d.locked = true;
      this.d.round = 0;
      this.save();
      return true;
    }
    const missing = root.querySelector(".roll-input:not(:disabled)[value=''], [aria-invalid='true'], .is-needed input");
    missing?.focus();
    missing?.scrollIntoView({ block: "center", behavior: "smooth" });
    return false;
  }

  recordLive(key) {
    const item = E.live(this.d.rolls, E.derive(this.d.rolls, this.t)).find((x) => x.key === key);
    if (!item) return;
    const b = this.d.liveBuffers[key] ?? {};
    const die = E.formulaOf(item.extra.die ?? "")?.die ?? "d%";
    const r = E.resolveLive(item, { chance: E.typedValue(b.chance, "d%"), total: E.typedValue(b.total, die) }, this.t);
    if (!r) return;
    this.d.live.push({ key, round: this.d.round, label: E.loc(item.extra.of), ...r });
    this.d.liveBuffers[key] = {};
    this.save();
  }

  close(form) {
    const d = this.d, t = this.t, r = d.rolls, der = E.derive(r, t);
    const name = (roll, table) => (r[roll] != null && !E.skipped(roll, r, t) ? t.name(table, r[roll]) : "—");
    this.log.unshift({
      at: Date.now(),
      chamber: r.chamber != null ? t.chamberName(r.chamber) : "?",
      page: r.chamber != null ? t.page("A", r.chamber) : null,
      condition: der.conditionExcluded ? "—" : name("condition", "B"),
      loot: name("loot", "C"), inhabitant: name("inhabitant", "D"),
      entries: der.entries, timer: der.timer, sealed: der.sealed, open: der.open,
      rounds: d.round, outcome: form.outcome, deaths: d.deaths,
      notes: (form.notes || "").trim(), rolls: r, typed: d.typed, live: d.live,
    });
    store.set("bs.log", this.log);
    this.reset();
    this.onLogChange?.();
  }

  // ---------------------------------------------------------------- pintar

  render() {
    const d = this.d, der = E.derive(d.rolls, this.t);
    const kids = this.children();
    const ids = E.ROLLS.map((x) => x.id).filter((id) => id !== "mimic" || this.mimics);
    const sections = ids.map((id, i) => this.section(id, i + 1, der, kids)).join("");
    if (d.locked) {
      return `<div class="chamber" data-state="playing">
        <details class="chamber-summary"><summary>${this.summaryLine(der)}</summary>${sections}</details>
        ${this.playing(der)}
      </div>`;
    }
    return `<div class="chamber" data-state="setup">
      ${sections}
      <label class="mimic-switch"><input type="checkbox" data-action="mimics" ${this.mimics ? "checked" : ""}> ${h(T("useMimics"))} <span class="page">${h(T("page")(85))}</span></label>
      <div class="chamber-actions">
        <button type="button" class="primary" data-action="enter">${h(T("enter"))}</button>
        ${Object.keys(d.rolls).length ? askButton(this.asking, "new", T("newChamber"), T("confirmNew"), T("yes"), T("cancel")) : ""}
      </div>
    </div>`;
  }

  summaryLine(der) {
    const t = this.t, r = this.d.rolls;
    const parts = [t.chamberName(r.chamber)];
    if (!E.skipped("condition", r, t) && !der.conditionExcluded) parts.push(t.name("B", der.rule?.fixedCondition ?? r.condition));
    if (!E.skipped("loot", r, t) && r.loot != null) parts.push(t.name("C", r.loot));
    if (!E.skipped("inhabitant", r, t) && r.inhabitant != null) parts.push(t.name("D", r.inhabitant));
    return `<span class="summary-name">${h(parts[0])}</span> ${parts.slice(1).map((p) => `<span class="summary-part">${h(p)}</span>`).join(" · ")}`;
  }

  /** Una de las siete, con su resultado y lo que cuelga de ella. */
  section(id, n, der, kids) {
    const d = this.d, t = this.t, r = d.rolls;
    const skip = r.chamber != null && E.skipped(id, r, t);
    const fixed = skip && id === "entries" && der.entryChange === "fixed";
    const page = { last: this.mainPage(id, der) };
    const own = kids.filter((c) => this.sectionOf(c) === id && !c.extraction);
    const fixedLines = r.chamber != null ? E.fixedExtras(der.rule).filter((e) => e.section === id) : [];
    const body = skip && !fixed ? "" : this.result(id, der);
    const derived = own.length || fixedLines.length ? this.derivedList(own, fixedLines, page) : "";
    return `<section class="roll-section${skip && !fixed ? " is-skipped" : ""}" data-section="${id}">
      ${this.head(id, n, der, skip, fixed)}
      ${body ? `<div class="roll-result">${body}</div>` : ""}
      ${id === "condition" ? this.choices(der) : ""}
      ${derived}
    </section>`;
  }

  sectionOf(c) {
    if (c.section) return c.section;
    if (c.kind === "window") return "timer";
    return c.from ?? "chamber";
  }

  mainPage(id, der) {
    const t = this.t, r = this.d.rolls;
    if (id === "chamber") return r.chamber != null ? t.page("A", r.chamber) : null;
    if (id === "condition") return r.condition != null ? t.page("B", r.condition) : null;
    if (id === "loot") return r.loot != null ? t.page("C", r.loot) : null;
    if (id === "inhabitant") return r.inhabitant != null ? t.page("D", r.inhabitant) : null;
    if (id === "timer") return 84;
    if (id === "mimic") return 85;
    return null;
  }

  head(id, n, der, skip, fixed) {
    const d = this.d, r = d.rolls;
    const input = idOf(`roll.${id}`);
    const label = `<label class="roll-label" for="${input}"><span class="roll-n">${n}</span> <span class="roll-name">${h(T(`roll_${id}`))}</span></label>`;
    if (fixed) return `<div class="roll-head">${label}<span class="roll-value">${h(der.entries)}</span></div>`;
    if (skip) return `<div class="roll-head">${label}<span class="roll-value">—</span></div>`;
    const die = id === "entries" ? der.entryDie : id === "timer" ? `${der.timerDice}d10` : E.rollDef(id).die;
    const raw = d.buffers[id] ?? (r[id] != null ? String(r[id]) : "");
    if (d.locked) return `<div class="roll-head">${label}<span class="roll-value">${h(r[id] ?? "—")}</span></div>`;
    const [a, b] = E.rangeOf(id, der);
    const v = E.typedValue(raw, die);
    const bad = String(raw).trim() !== "" && (v == null || v < a || v > b);
    const hidden = id === "mimic" && d.mimicHidden;
    const waiting = id !== "chamber" && r.chamber == null;
    return `<div class="roll-head">${label}
      <input id="${input}" class="roll-input${bad ? " is-invalid" : ""}" data-roll="${id}" type="${hidden ? "password" : "text"}"
        inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${h(raw)}" placeholder="${h(die)}"
        ${waiting ? "disabled" : ""} ${bad ? 'aria-invalid="true"' : ""} aria-describedby="${input}-die">
      <span id="${input}-die" class="roll-die">${h(bad ? `${a}–${b}` : die)}</span>
      ${id === "mimic" ? `<button type="button" class="quiet" data-action="mimic-toggle" aria-pressed="${!hidden}">${h(hidden ? T("show") : T("hide"))}</button>` : ""}
    </div>`;
  }

  /** El nombre del resultado con su página, y la nota plegada. */
  result(id, der) {
    const t = this.t, r = this.d.rolls, n = r[id];
    if (n == null) return "";
    if (id === "mimic" && this.d.mimicHidden) return `<p class="result is-hidden">${h(T("hidden"))}</p>`;
    const line = (name, page, cls = "") => `<p class="result${cls}"><span class="result-name">${h(name)}</span>${page ? ` <span class="page">${h(T("page")(page))}</span>` : ""}</p>`;
    const note = (title, ...texts) => {
      const body = texts.filter(Boolean).map((x) => `<p>${h(x)}</p>`).join("");
      return body ? `<details class="roll-note"><summary>${h(title)}</summary>${body}</details>` : "";
    };
    switch (id) {
      case "chamber":
        return line(t.chamberName(n), t.page("A", n)) + note(T("chamberRules"), E.loc(der.rule?.note));
      case "condition": {
        if (der.conditionExcluded) {
          return line(t.name("B", n), null, " is-invalid") + `<p class="result-hint">${h(der.rule?.reroll ? E.loc(der.rule.reroll) : T("excluded"))}</p>`;
        }
        const c = der.rule?.fixedCondition ?? n;
        return line(t.name("B", c), t.page("B", c)) + note(T("effect"), E.loc(der.fx?.note));
      }
      case "entries":
        return der.entryChange === "raised" ? `<p class="result"><span class="result-name">${h(der.entries)}</span> <span class="result-hint">${h(T("raised"))}</span></p>` : "";
      case "timer": {
        if (der.sealed) return line(T("sealed"));
        if (der.open) return line(T("noCountdown"));
        const ops = der.steps.slice(1).map((s) => ({ extended: "×2", reduced: "÷2", "one-entry": T("oneEntry") })[s.kind]).filter(Boolean);
        const jam = der.steps.some((s) => s.kind === "jammed");
        return `<p class="result"><span class="result-name">${h(T("rounds")(der.timer))}</span>${ops.length ? ` <span class="result-hint">${h(der.steps[0].value)} ${h(ops.join(" "))}</span>` : ""}</p>${jam ? `<p class="result-hint">${h(T("jammed"))}</p>` : ""}`;
      }
      case "loot":
      case "inhabitant": {
        const tb = id === "loot" ? "C" : "D";
        const raw = t.entry(tb, n).result;
        const mark = /^\*+|[†ª]+$/.exec(raw)?.[0] ?? (raw.includes("(") ? "plain" : null);
        const foot = mark && !(READING_NOTES[tb] ?? []).includes(mark) && !(tb === "C" && mark === "*") ? t.footnote(tb, n) : null;
        return line(t.name(tb, n), t.page(tb, n)) + note(T("note"), E.loc(t.noteOf(tb, n)), E.loc(foot));
      }
      case "mimic":
        return line(T("mimic")[E.mimicKind(n)], null, E.mimicKind(n) !== "none" ? " is-danger" : "");
    }
    return "";
  }

  choices(der) {
    const d = this.d, r = d.rolls, c = r.condition;
    if (c == null || der.conditionExcluded || E.skipped("condition", r, this.t)) return "";
    const radio = (key, name, value, label, checked, disabled) => `<label class="choice-option"><input type="radio" name="${name}" data-choice="${key}" value="${value}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}> ${h(label)}</label>`;
    if (c >= 37 && c <= 41) {
      const v = d.typed[E.DOUBLE_MODE];
      return `<fieldset class="choice${v == null ? " is-needed" : ""}"><legend>${h(T("doubleTitle"))}</legend>${radio(E.DOUBLE_MODE, "double", 1, T("doubleTwo"), v === 1, d.locked)}${radio(E.DOUBLE_MODE, "double", 2, T("doubleTimes"), v === 2, d.locked)}</fieldset>`;
    }
    if (c >= 65 && c <= 69 && !d.locked) {
      const v = d.typed[E.LEGENDARY_MODE] ?? 1;
      return `<fieldset class="choice"><legend>${h(T("legendaryTitle"))}</legend>${radio(E.LEGENDARY_MODE, "legendary", 1, T("legendaryTable"), v !== 2)}${radio(E.LEGENDARY_MODE, "legendary", 2, T("legendaryMM"), v === 2)}</fieldset>`;
    }
    if (E.schoolExcluded(r, d.typed)) return `<p class="result-hint is-invalid">${h(T("schoolExcluded"))}</p>`;
    return "";
  }

  /** Lo que cuelga de una tirada: filas, filas de casillas para las repetidas y el grupo del Arma Definitiva. */
  derivedList(own, fixedLines, page) {
    const groups = new Map();
    for (const c of own) {
      const m = REPEATED.exec(c.key);
      if (m && c.table && !c.chance) {
        const base = `${m[1]}.${m[2]}`;
        if (!groups.has(base)) groups.set(base, []);
        groups.get(base).push(c);
      }
    }
    const ultimate = own.filter((c) => c.group === "ultimate");
    const done = new Set();
    const rows = [];
    for (const c of own) {
      if (done.has(c.key)) continue;
      if (c.group === "ultimate") {
        ultimate.forEach((x) => done.add(x.key));
        rows.push(this.ultimateGroup(ultimate, fixedLines.filter((e) => e.kind === "ultimate")));
        continue;
      }
      const m = REPEATED.exec(c.key);
      const base = m ? `${m[1]}.${m[2]}` : null;
      if (base && groups.get(base)?.length > 1) {
        groups.get(base).forEach((x) => done.add(x.key));
        rows.push(this.diceRow(groups.get(base), page));
        continue;
      }
      done.add(c.key);
      rows.push(this.derivedRow(c, page));
    }
    if (!ultimate.length && fixedLines.some((e) => e.kind === "ultimate")) rows.push(this.ultimateGroup([], fixedLines.filter((e) => e.kind === "ultimate")));
    fixedLines.filter((e) => e.kind !== "ultimate").forEach((e) => rows.push(`<p class="fixed-line">${h(E.loc(e.of))}</p>`));
    return `<div class="derived">${rows.join("")}</div>`;
  }

  /** La página sólo si cambia respecto a la línea de arriba. */
  page(p, page) {
    if (!p || p === page.last) return "";
    page.last = p;
    return ` <span class="page">${h(T("page")(p))}</span>`;
  }

  label(c) {
    if (c.kind === "window") return T("window");
    if (c.kind === "times") return `${c.of} · ${T("times")}`;
    return c.of;
  }

  /** Lo que salió en una derivada, en corto. */
  answer(c) {
    const t = this.t, v = this.d.typed[c.key];
    if (v == null) return "";
    if (c.chance) return c.chance.passes(v) ? `<span class="derived-yes">✓</span>` : `<span class="derived-no">✗</span>`;
    if (c.table) return `<span class="result-name">${h(t.name(c.table, v))}</span>`;
    return `<span class="derived-total">→ ${h(c.formula.total(v))}</span>`;
  }

  input(c, cls = "derived-input", aria = "") {
    const d = this.d;
    const raw = d.buffers[c.key] ?? (d.typed[c.key] != null ? String(d.typed[c.key]) : "");
    const bad = String(raw).trim() !== "" && d.typed[c.key] == null;
    const hidden = c.secret && d.mimicHidden;
    if (d.locked && c.required) return `<span class="derived-value">${h(raw)}</span>`;
    return `<input id="${idOf(c.key)}" class="${cls}${bad ? " is-invalid" : ""}" data-child="${h(c.key)}" type="${hidden ? "password" : "text"}"
      inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${h(raw)}" placeholder="${h(c.formula.die)}"
      ${bad ? 'aria-invalid="true"' : ""} ${aria}>`;
  }

  derivedRow(c, page) {
    const t = this.t, d = this.d;
    if (c.kind === "inside") return `<p class="fixed-line">${h(c.of)}</p>`;
    if (c.secret && d.mimicHidden) return "";
    const v = d.typed[c.key];
    const raw = d.buffers[c.key] ?? "";
    const bad = String(raw).trim() !== "" && v == null;
    const die = c.chance ? c.chance.label : c.formula.label;
    const note = c.table && v != null ? t.noteOf(c.table, v) : null;
    const resultPage = c.table && v != null ? t.page(c.table, v) : null;
    const needed = c.required && v == null;
    return `<div class="derived-row${needed ? " is-needed" : ""}${c.table ? "" : " is-inline"}" data-key="${h(c.key)}">
      <label class="derived-label" for="${idOf(c.key)}">${h(this.label(c))}${this.page(c.page, page)}</label>
      <span class="derived-die">${h(bad ? `${c.formula.min}–${c.formula.max}` : die)}</span>
      ${this.input(c)}
      <span class="derived-result">${this.answer(c)}${this.page(resultPage, page)}</span>
      ${note ? `<details class="roll-note"><summary>${h(T("note"))}</summary><p>${h(E.loc(note))}</p></details>` : ""}
    </div>`;
  }

  /** Las repetidas: «+10 tiradas de la Tabla C» en una fila de casillas, con lo que salió debajo. */
  diceRow(items, page) {
    const t = this.t, d = this.d;
    const first = items[0];
    const title = `${groupTitle(first.of)} · ${T("table")} ${t.source(first.table).table}`;
    const results = items.map((c, i) => {
      const v = d.typed[c.key];
      return v == null ? "" : `<li><span class="dice-n">${i + 1}</span> <span class="result-name">${h(t.name(c.table, v))}</span>${this.page(t.page(c.table, v), page)}</li>`;
    }).join("");
    return `<div class="dice-row" data-group="${h(first.key.replace(REPEATED, "$1"))}">
      <p class="derived-label">${h(title)}${this.page(first.page, page)}</p>
      <div class="dice-cells">${items.map((c, i) => this.input(c, "dice-cell", `aria-label="${h(title)} ${i + 1}"`)).join("")}</div>
      ${results ? `<ol class="dice-results">${results}</ol>` : ""}
    </div>`;
  }

  /** Los componentes del Arma Definitiva, juntos al final del Botín. */
  ultimateGroup(items, fixedLines) {
    const reasons = items.filter((c) => c.chance).map((c) => c.of.split(/;\s*/)[1] ?? "");
    const shared = reasons.length > 1 && reasons.every((x) => x && x === reasons[0]) ? reasons[0] : "";
    const rows = items.map((c) => {
      const name = shared ? c.of.split(/;\s*/)[0] : c.of;
      const v = this.d.typed[c.key];
      return `<div class="derived-row is-inline ultimate-row${c.chance && v != null && c.chance.passes(v) ? " is-found" : ""}">
        <label class="derived-label" for="${idOf(c.key)}">${h(name)}</label>
        <span class="derived-die">${h(c.chance ? c.chance.label : c.formula.label)}</span>
        ${this.input(c)}
        <span class="derived-result">${this.answer(c)}</span>
      </div>`;
    }).join("");
    const fixed = fixedLines.map((e) => `<p class="fixed-line">${h(E.loc(e.of))}</p>`).join("");
    return `<div class="ultimate-group"><p class="group-title">${h(T("ultimate"))}${shared ? ` <span class="group-hint">· ${h(shared)}</span>` : ""}</p>${rows}${fixed}</div>`;
  }

  playing(der) {
    const d = this.d, t = this.t, r = d.rolls;
    const trigger = E.entryTrigger(r.chamber);
    const manual = E.BONFIRES.has(r.chamber);
    let door;
    if (der.sealed) door = T("sealed");
    else if (der.open) door = T("noCountdown");
    else if (manual && d.typed[E.DOORS] != null) door = d.typed[E.DOORS] === 1 ? T("opened") : T("closed");
    else if (der.timer != null && d.typed[E.WINDOW_KEY] != null) {
      const dr = E.door(d.round, der.timer, E.WINDOW.total(d.typed[E.WINDOW_KEY]));
      const open = dr.open && !(trigger && d.typed[E.ENTRY] !== 1);
      door = open ? T("doorOpen")(dr.rounds) : T("doorClosed")(dr.rounds);
    }
    const live = E.live(r, der);
    return `<section class="play-panel" aria-label="${h(T("inChamber"))}">
      <div class="round-counter">
        <button type="button" data-action="round-" aria-label="${h(T("prevRound"))}" ${d.round <= 0 ? "disabled" : ""}>−</button>
        <p><span class="round-label">${h(T("round"))}</span> <strong class="round-value" aria-live="polite">${d.round}</strong></p>
        <button type="button" data-action="round+" aria-label="${h(T("nextRound"))}">+</button>
      </div>
      ${door ? `<p class="door-status" role="status">${h(door)}</p>` : ""}
      ${trigger ? `<label class="gate-check"><input type="checkbox" data-flag="${E.ENTRY}" ${d.typed[E.ENTRY] === 1 ? "checked" : ""}> ${h(trigger === "first-death" ? T("gateDeath") : T("gateFire"))}</label>` : ""}
      ${manual ? `<div class="bonfire-doors"><button type="button" data-action="doors-open">${h(T("open"))}</button><button type="button" data-action="doors-close">${h(T("close"))}</button></div>` : ""}
      ${E.circle(r, t) ? `<p class="circle-note">${h(T("circle"))}</p>` : ""}
      ${r.condition >= 60 && r.condition <= 64 && !der.conditionExcluded ? `<fieldset class="choice"><legend>${h(T("torcherTitle"))}</legend>
        <label class="choice-option"><input type="radio" name="torcher" data-choice="${E.TORCHER_TRIGGER}" value="1" ${d.typed[E.TORCHER_TRIGGER] === 1 ? "checked" : ""}> ${h(T("torcherYes"))}</label>
        <label class="choice-option"><input type="radio" name="torcher" data-choice="${E.TORCHER_TRIGGER}" value="0" ${d.typed[E.TORCHER_TRIGGER] === 0 ? "checked" : ""}> ${h(T("torcherNo"))}</label></fieldset>` : ""}
      ${this.children().filter((c) => c.extraction).map((c) => this.extractRow(c)).join("")}
      ${live.map((x) => this.liveRow(x)).join("")}
      ${d.live.length ? `<ol class="events">${d.live.map((e) => `<li><span class="event-round">${h(T("round"))} ${e.round}</span> <span class="result-name">${h(e.text)}</span>${e.page ? ` <span class="page">${h(T("page")(e.page))}</span>` : ""}${e.note ? `<details class="roll-note"><summary>${h(T("note"))}</summary><p>${h(E.loc(e.note))}</p></details>` : ""}</li>`).join("")}</ol>` : ""}
      <form class="close-form" data-form="close">
        <fieldset class="choice"><legend>${h(T("outcome"))}</legend>
          ${Object.entries(T("outcomes")).map(([k, v], i) => `<label class="choice-option"><input type="radio" name="outcome" value="${k}" ${i === 0 ? "checked" : ""}> ${h(v)}</label>`).join("")}
        </fieldset>
        <div class="deaths-counter">
          <span class="round-label">${h(T("deaths"))}</span>
          <button type="button" data-action="deaths-" aria-label="−1" ${d.deaths <= 0 ? "disabled" : ""}>−</button>
          <strong class="round-value">${d.deaths}</strong>
          <button type="button" data-action="deaths+" aria-label="+1">+</button>
        </div>
        <details class="close-notes"><summary>${h(T("notes"))}</summary><textarea name="notes" rows="3" aria-label="${h(T("notes"))}"></textarea></details>
        <div class="chamber-actions"><button type="submit" class="primary">${h(T("save"))}</button>
          ${askButton(this.asking, "discard", T("discard"), T("confirmDiscard"), T("yes"), T("cancel"))}</div>
      </form>
    </section>`;
  }

  /** Una veta: su cantidad se tira sólo cuando la extracción sale bien, ya dentro. */
  extractRow(c) {
    const v = this.d.typed[c.key];
    if (v != null) return ""; // ya anotada: queda en los sucesos
    const raw = this.d.liveBuffers[c.key]?.total ?? "";
    const n = E.typedValue(raw, c.formula.die);
    const bad = String(raw).trim() !== "" && (n == null || n < c.formula.min || n > c.formula.max);
    return `<div class="live-row extract-row">
      <p class="derived-label">${h(T("extract")(c.of))}${c.page ? ` <span class="page">${h(T("page")(c.page))}</span>` : ""}</p>
      <div class="live-inputs">
        <input id="${idOf(c.key)}-x" class="derived-input${bad ? " is-invalid" : ""}" data-live="${h(c.key)}" data-part="total" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${h(raw)}" placeholder="${h(c.formula.label)}" aria-label="${h(c.formula.label)}">
        <button type="button" data-action="extract" data-key="${h(c.key)}">${h(T("record"))}</button>
      </div>
    </div>`;
  }

  recordExtract(key) {
    const c = this.children().find((x) => x.key === key);
    if (!c) return;
    const n = E.typedValue(this.d.liveBuffers[key]?.total, c.formula.die);
    if (n == null || n < c.formula.min || n > c.formula.max) return;
    this.d.typed[key] = n;
    this.d.live.push({ key, round: this.d.round, label: T("extract")(c.of), text: `${T("extract")(c.of)} → ${c.formula.total(n)}` });
    delete this.d.liveBuffers[key];
    this.save();
  }

  liveRow(item) {
    const e = item.extra;
    const b = this.d.liveBuffers[item.key] ?? {};
    const chance = E.Chance.of(e.chance ?? "");
    const f = E.formulaOf(e.die ?? "");
    const id = idOf(item.key);
    const label = E.loc(e.of).replace(/^Tabla [\d.]+,\s*|^Table [\d.]+,\s*/, "");
    return `<div class="live-row">
      <p class="derived-label">${h(label)}${item.page ? ` <span class="page">${h(T("page")(item.page))}</span>` : ""}</p>
      <div class="live-inputs">
        ${chance ? `<input id="${id}-c" class="derived-input" data-live="${h(item.key)}" data-part="chance" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${h(b.chance ?? "")}" placeholder="${h(chance.label)}" aria-label="${h(chance.label)}">` : ""}
        ${f ? `<input id="${id}-d" class="derived-input" data-live="${h(item.key)}" data-part="total" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${h(b.total ?? "")}" placeholder="${h(f.label)}" aria-label="${h(f.label)}">` : ""}
        <button type="button" data-action="live" data-key="${h(item.key)}">${h(T("record"))}</button>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------- eventos

  bind(root, rerender) {
    root.addEventListener("input", (ev) => {
      const el = ev.target;
      if (el.dataset.roll) { this.setRoll(el.dataset.roll, el.value); rerender(); }
      else if (el.dataset.child) { this.setChild(el.dataset.child, el.value); rerender(); }
      else if (el.dataset.live) {
        (this.d.liveBuffers[el.dataset.live] ??= {})[el.dataset.part] = el.value;
        this.save();
      }
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.dataset.choice) { this.setChoice(el.dataset.choice, +el.value); rerender(); }
      else if (el.dataset.flag) {
        if (el.checked) this.d.typed[el.dataset.flag] = 1; else delete this.d.typed[el.dataset.flag];
        this.save(); rerender();
      } else if (el.dataset.action === "mimics") {
        this.mimics = el.checked;
        store.set("bs.mimics", this.mimics);
        rerender();
      }
    });
    root.addEventListener("click", (ev) => {
      const el = ev.target.closest("button[data-action]");
      if (!el) return;
      const a = el.dataset.action;
      if (a === "mimic-toggle") this.d.mimicHidden = !this.d.mimicHidden;
      else if (a === "enter") { if (!this.enter(root)) return; window.scrollTo({ top: 0 }); }
      else if (a === "new" || a === "discard") { this.asking = a; rerender(); return; }
      else if (a === "new-yes" || a === "discard-yes") { this.asking = null; this.reset(); }
      else if (a === "ask-cancel") { this.asking = null; rerender(); return; }
      else if (a === "round+") this.d.round += 1;
      else if (a === "round-") this.d.round = Math.max(0, this.d.round - 1);
      else if (a === "deaths+") this.d.deaths += 1;
      else if (a === "deaths-") this.d.deaths = Math.max(0, this.d.deaths - 1);
      else if (a === "doors-open") this.d.typed[E.DOORS] = 1;
      else if (a === "doors-close") this.d.typed[E.DOORS] = 0;
      else if (a === "live") this.recordLive(el.dataset.key);
      else if (a === "extract") this.recordExtract(el.dataset.key);
      else return;
      this.save();
      rerender();
    });
    root.addEventListener("submit", (ev) => {
      if (ev.target.dataset.form !== "close") return;
      ev.preventDefault();
      const f = new FormData(ev.target);
      this.close({ outcome: f.get("outcome"), notes: f.get("notes") });
      rerender();
      window.scrollTo({ top: 0 });
    });
  }
}

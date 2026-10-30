// La cámara: las Siete Tiradas, sus tiradas derivadas, el juego dentro y el cierre.
import * as E from "./engine.js";
import { T } from "./i18n.js";
import { h, idOf, store } from "./util.js";

const EMPTY = () => ({ rolls: {}, typed: {}, buffers: {}, round: 0, locked: false, mimicHidden: true, live: [], liveBuffers: {} });

export class ChamberView {
  constructor(tables, onLogChange) {
    this.t = tables;
    this.onLogChange = onLogChange;
    this.d = { ...EMPTY(), ...store.get("bs.draft", {}) };
    this.log = store.get("bs.log", []);
  }

  save() { store.set("bs.draft", this.d); }

  // ---------------------------------------------------------------- cambios

  /** Una de las siete. Cambiar la cámara vacía todo lo demás (p. 84). */
  setRoll(id, raw) {
    const d = this.d;
    d.buffers[id] = raw;
    const der = E.derive(d.rolls, this.t);
    const die = id === "entries" ? der.entryDie : E.rollDef(id).die;
    const n = E.typedValue(raw, die);
    const [a, b] = E.rangeOf(id, der);
    const before = d.rolls;
    let after;
    if (n == null || n < a || n > b) {
      after = { ...before };
      delete after[id];
      if (id === "chamber") after = {};
    } else after = E.typeRoll(before, id, n);
    if (id === "chamber" && after.chamber !== before.chamber) {
      d.buffers = { chamber: raw };
      d.typed = {};
    } else d.typed = E.keep(d.typed, before, after);
    d.rolls = after;
    // El dado de Temporizador cambia con la cámara: lo tecleado fuera de rango se descarta.
    this.save();
  }

  /** Una tirada derivada. Lo que colgaba de ella se borra: depende de este valor. */
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
    const d = this.d;
    d.typed[key] = value;
    if (key === E.DOUBLE_MODE && value === 2) this.drop("condition.double.encounter");
    if (key === E.TORCHER_TRIGGER && value === 0) this.drop("condition.torcher.encounter");
    if (key === E.LEGENDARY_MODE && value === 2) this.drop("condition.fx.0");
    this.save();
  }

  drop(prefix) {
    for (const k of Object.keys(this.d.typed)) if (k === prefix || k.startsWith(prefix + ".")) delete this.d.typed[k];
    for (const k of Object.keys(this.d.buffers)) if (k === prefix || k.startsWith(prefix + ".")) delete this.d.buffers[k];
  }

  children() { return E.children(this.d.rolls, E.derive(this.d.rolls, this.t), this.t, this.d.typed); }

  reset() { this.d = EMPTY(); this.save(); }

  enter() {
    if (!E.blockers(this.d.rolls, this.d.typed, this.t).ready) return;
    this.d.locked = true;
    this.d.round = 0;
    this.save();
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
    this.log.unshift({
      at: Date.now(),
      chamber: r.chamber != null ? t.chamberName(r.chamber) : "?",
      page: r.chamber != null ? t.page("A", r.chamber) : null,
      condition: r.condition != null && !E.skipped("condition", r, t) ? t.name("B", r.condition) : "—",
      loot: r.loot != null && !E.skipped("loot", r, t) ? t.name("C", r.loot) : "—",
      inhabitant: r.inhabitant != null && !E.skipped("inhabitant", r, t) ? t.name("D", r.inhabitant) : "—",
      entries: der.entries, timer: der.timer, sealed: der.sealed, open: der.open,
      rounds: d.round, outcome: form.outcome, deaths: Math.max(0, parseInt(form.deaths, 10) || 0),
      notes: (form.notes || "").trim(), rolls: r, typed: d.typed, live: d.live,
    });
    store.set("bs.log", this.log);
    this.reset();
    this.onLogChange?.();
  }

  // ---------------------------------------------------------------- pintar

  render() {
    const d = this.d, t = this.t, r = d.rolls;
    const der = E.derive(r, t);
    const kids = this.children();
    const block = E.blockers(r, d.typed, t);
    return `
      <p class="lead">${h(T("manual"))}</p>
      <section aria-labelledby="h-rolls">
        <h2 id="h-rolls">${h(T("rolls"))}</h2>
        <ol class="rolls">${E.ROLLS.map((x) => this.rollRow(x.id, der)).join("")}</ol>
      </section>
      ${this.choices(der)}
      ${kids.length ? `
      <section aria-labelledby="h-derived">
        <h2 id="h-derived">${h(T("derived"))}</h2>
        <p class="hint">${h(T("derivedHint"))}</p>
        <ul class="kids">${kids.map((c) => this.childRow(c)).join("")}</ul>
      </section>` : ""}
      ${d.locked ? this.playing(der, kids) : this.gate(block)}
    `;
  }

  rollRow(id, der) {
    const d = this.d, t = this.t, r = d.rolls;
    const def = E.rollDef(id);
    const label = T(`roll_${id}`);
    const skip = r.chamber != null && E.skipped(id, r, t);
    const die = id === "entries" ? der.entryDie : id === "timer" ? `${der.timerDice}d10` : def.die;
    const input = idOf(`roll.${id}`);
    const secret = id === "mimic";
    const hidden = secret && d.mimicHidden;
    const raw = d.buffers[id] ?? (r[id] != null ? String(r[id]) : "");
    const locked = d.locked || (id !== "chamber" && r.chamber == null);
    let body = "";
    if (skip && id === "entries" && der.entryChange === "fixed") body = `<p>${h(T("fixedEntries")(der.entries))}</p>`;
    else if (skip) body = `<p class="dim">${h(T("notRolled"))}</p>`;
    else {
      const err = this.rollError(id, raw, der);
      body = `
        <div class="field">
          <input id="${input}" data-roll="${id}" type="${hidden ? "password" : "text"}" inputmode="numeric" pattern="[0-9]*"
            autocomplete="off" value="${h(raw)}" ${locked ? "disabled" : ""} aria-describedby="${input}-out"
            placeholder="${h(die)}">
          <span class="die">${h(id === "timer" ? T("typeSum")(die) : die)}</span>
          ${secret ? `<button type="button" class="link" data-action="mimic-toggle" aria-pressed="${!hidden}">${h(hidden ? T("show") : T("hide"))}</button>` : ""}
        </div>
        <div id="${input}-out" class="out" aria-live="polite">${err ? `<p class="err">${h(err)}</p>` : hidden && r.mimic != null ? `<p class="dim">${h(T("hidden"))}</p>` : this.rollResult(id, der)}</div>`;
    }
    return `<li class="roll${skip ? " skipped" : ""}"><label for="${input}"><span class="n">${E.ROLLS.findIndex((x) => x.id === id) + 1}</span> ${h(label)}</label>${secret ? `<p class="hint">${h(T("mimicOptional"))}</p>` : ""}${body}</li>`;
  }

  rollError(id, raw, der) {
    if (!String(raw ?? "").trim()) return null;
    const die = id === "entries" ? der.entryDie : E.rollDef(id).die;
    const n = E.typedValue(raw, die);
    const [a, b] = E.rangeOf(id, der);
    if (n == null || n < a || n > b) return T("outOfRange")(a, b);
    return null;
  }

  rollResult(id, der) {
    const t = this.t, r = this.d.rolls, n = r[id];
    if (n == null) return "";
    const pg = (p) => (p ? ` <span class="pg">${h(T("page")(p))}</span>` : "");
    const note = (l, cls = "note") => (l && E.loc(l) ? `<p class="${cls}">${h(E.loc(l))}</p>` : "");
    switch (id) {
      case "chamber": {
        const rule = der.rule;
        const brings = (rule?.extras ?? []).map((e) => {
          const kind = T("kinds")[e.kind] ?? e.kind;
          const dice = [e.chance, e.die && !/^\d+$/.test(e.die) ? e.die : e.die ? `×${e.die}` : null].filter(Boolean).join(" · ");
          return `<li><span class="tag">${h(kind)}</span> ${h(E.loc(e.of))}${dice ? ` <span class="dim">(${h(dice)})</span>` : ""}${e.repeat ? ` <span class="dim">· ${h(T("liveTitle"))}</span>` : ""}</li>`;
        }).join("");
        return `<p class="res"><strong>${h(t.chamberName(n))}</strong>${pg(t.page("A", n))}</p>
          ${t.inside(n) ? `<p>[${h(t.inside(n))}]</p>` : ""}
          ${note(rule?.skipNote, "note dim")}${note(rule?.note)}${rule?.check ? `<p class="note approx">≈ ${h(E.loc(rule.check))}</p>` : ""}
          ${rule?.special ? `<p class="dim">${h(T("page")(rule.special))}</p>` : ""}
          ${brings ? `<details><summary>${h(T("chamberBrings"))}</summary><ul class="brings">${brings}</ul></details>` : ""}`;
      }
      case "condition": {
        if (der.conditionExcluded) return `<p class="err">${h(t.name("B", n))} — ${h(der.rule?.reroll ? E.loc(der.rule.reroll) : T("excluded"))}</p>`;
        const fixed = der.rule?.fixedCondition;
        return `<p class="res"><strong>${h(t.name("B", fixed ?? n))}</strong>${pg(t.page("B", fixed ?? n))}</p>${note(der.fx?.note)}`;
      }
      case "entries": {
        const change = der.entryChange === "raised" ? T("raised")(der.entries) : der.entryChange === "other-die" ? T("otherDie")(der.entryDie) : "";
        return `<p class="res"><strong>${h(der.entries)}</strong></p>${change ? `<p class="note">${h(change)}</p>` : ""}`;
      }
      case "timer": {
        const steps = der.steps.map((s) => { const f = T("timerSteps")[s.kind]; return typeof f === "function" ? f(s.value) : f; });
        return `<ol class="steps">${steps.map((s) => `<li>${h(s)}</li>`).join("")}</ol>${der.timer != null ? `<p class="res"><strong>${h(T("timerResult")(der.timer))}</strong> <span class="pg">${h(T("page")(84))}</span></p>` : ""}`;
      }
      case "loot":
      case "inhabitant": {
        const tb = id === "loot" ? "C" : "D";
        return `<p class="res"><strong>${h(t.name(tb, n))}</strong>${pg(t.page(tb, n))}</p>${note(t.footnote(tb, n), "note dim")}${note(t.noteOf(tb, n))}`;
      }
      case "mimic":
        return `<p class="res${E.mimicKind(n) !== "none" ? " danger" : ""}"><strong>${h(T("mimic")[E.mimicKind(n)])}</strong> <span class="pg">${h(T("page")(85))}</span></p>`;
    }
    return "";
  }

  choices(der) {
    const d = this.d, r = d.rolls, c = r.condition;
    if (c == null || der.conditionExcluded || E.skipped("condition", r, this.t)) return "";
    const radio = (key, value, label, disabled) => `<label class="opt"><input type="radio" name="${h(key)}" data-choice="${h(key)}" value="${value}" ${d.typed[key] === value ? "checked" : ""} ${disabled ? "disabled" : ""}> ${h(label)}</label>`;
    let out = "";
    if (c >= 37 && c <= 41) {
      out += `<fieldset class="choice"><legend>${h(T("doubleTitle"))}</legend>${radio(E.DOUBLE_MODE, 1, T("doubleTwo"), d.locked)}${radio(E.DOUBLE_MODE, 2, T("doubleTimes"), d.locked)}</fieldset>`;
    }
    if (c >= 65 && c <= 69 && !d.locked) {
      const mode = d.typed[E.LEGENDARY_MODE] ?? 1;
      out += `<fieldset class="choice"><legend>${h(T("legendaryTitle"))}</legend>
        <label class="opt"><input type="radio" name="legendary" data-choice="${E.LEGENDARY_MODE}" value="1" ${mode !== 2 ? "checked" : ""}> ${h(T("legendaryTable"))}</label>
        <label class="opt"><input type="radio" name="legendary" data-choice="${E.LEGENDARY_MODE}" value="2" ${mode === 2 ? "checked" : ""}> ${h(T("legendaryMM"))}</label></fieldset>`;
    }
    if (E.schoolExcluded(r, d.typed)) out += `<p class="err">${h(T("schoolExcluded"))}</p>`;
    return out;
  }

  childRow(c) {
    const d = this.d, t = this.t;
    const id = idOf(c.key);
    const label = c.kind === "window" ? T("window") : c.of;
    const tag = c.from ? T(`roll_${c.from}`) : T("roll_chamber");
    const hidden = c.secret && d.mimicHidden;
    if (c.kind === "inside") {
      return `<li class="kid"><span class="tag">${h(tag)}</span> <strong>${h(c.of)}</strong> · 100% <span class="pg">${h(T("page")(81))}</span></li>`;
    }
    if (hidden) return `<li class="kid"><span class="tag">${h(tag)}</span> <span class="dim">${h(T("hidden"))}</span></li>`;
    const raw = d.buffers[c.key] ?? (d.typed[c.key] != null ? String(d.typed[c.key]) : "");
    const value = d.typed[c.key];
    const locked = d.locked && c.required;
    let out = "";
    const n = E.typedValue(raw, c.formula.die);
    if (String(raw).trim() && value == null) {
      out = n != null && c.table && n >= c.formula.min && n <= c.formula.max && !c.excluded.includes(n) ? T("notInTable") : T("outOfRange")(c.formula.min, c.formula.max);
      out = `<p class="err">${h(out)}</p>`;
    } else if (value != null) {
      if (c.chance) out = `<p class="res${c.chance.passes(value) ? "" : " dim"}">${h(c.chance.passes(value) ? T("chanceYes") : T("chanceNo"))}</p>`;
      else if (c.kind === "weapon") {
        const w = t.weapon(value);
        out = `<p class="res"><strong>${h(w.name.replace(/^\*+/, ""))}</strong> <span class="pg">${h(T("page")(t.page("4.8", value)))}</span></p>${w.damage ? `<p class="note">${h(T("damage"))}: ${h(w.damage)}${w.type?.approx || w.mat?.approx ? ` <span class="approx">${h(T("approx"))}</span>` : ""}</p>` : ""}${w.special ? `<p class="note">${h(E.loc(w.special))}</p>` : ""}`;
      } else if (c.table) {
        const note = t.noteOf(c.table, value);
        out = `<p class="res"><strong>${h(t.name(c.table, value))}</strong> <span class="pg">${h(T("page")(t.page(c.table, value)))}</span></p>${note ? `<p class="note">${h(E.loc(note))}</p>` : ""}`;
      } else out = `<p class="res"><strong>${h(c.formula.total(value))}</strong>${c.formula.plus ? ` <span class="dim">(${value}${c.formula.plus > 0 ? "+" : ""}${c.formula.plus})</span>` : ""}</p>`;
    }
    const die = c.chance ? `d% · ${c.chance.label}` : c.formula.label;
    return `<li class="kid${c.required ? " req" : ""}">
      <label for="${id}"><span class="tag">${h(tag)}</span> ${h(label)}${c.page ? ` <span class="pg">${h(T("page")(c.page))}</span>` : ""}
        <span class="badge">${h(c.required ? T("required") : T("optional"))}</span></label>
      <div class="field">
        <input id="${id}" data-child="${h(c.key)}" type="${c.secret && hidden ? "password" : "text"}" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
          value="${h(raw)}" placeholder="${h(c.formula.die)}" ${locked ? "disabled" : ""} aria-describedby="${id}-out">
        <span class="die">${h(die)}</span>
      </div>
      <div id="${id}-out" class="out" aria-live="polite">${out}</div>
    </li>`;
  }

  gate(block) {
    const t = this.t;
    const items = [];
    if (block.rolls.length) items.push(T("missingRolls")(block.rolls.map((id) => T(`roll_${id}`)).join(", ")));
    if (block.excluded) items.push(T("excluded"));
    if (block.choice) items.push(T("missingChoice"));
    if (block.school) items.push(T("schoolExcluded"));
    if (block.children.length) items.push(T("missingKids")(block.children.length));
    return `<section class="gate" aria-label="${h(items.length ? T("missing") : T("enter"))}">
      ${items.length ? `<h2>${h(T("missing"))}</h2><ul>${items.map((x) => `<li>${h(x)}</li>`).join("")}</ul>` : ""}
      <div class="actions">
        <button type="button" class="primary" data-action="enter" ${block.ready ? "" : "disabled"}>${h(T("enter"))}</button>
        ${Object.keys(this.d.rolls).length ? `<button type="button" data-action="new">${h(T("newChamber"))}</button>` : ""}
      </div>
    </section>`;
  }

  playing(der, kids) {
    const d = this.d, t = this.t, r = d.rolls;
    const windowTyped = d.typed[E.WINDOW_KEY];
    const trigger = E.entryTrigger(r.chamber);
    const manual = E.BONFIRES.has(r.chamber);
    let doorText;
    if (der.sealed) doorText = T("doorSealed");
    else if (der.open) doorText = T("doorFree");
    else if (manual && d.typed[E.DOORS] != null) doorText = d.typed[E.DOORS] === 1 ? T("opened") : T("closed");
    else if (der.timer != null && windowTyped != null) {
      const dr = E.door(d.round, der.timer, E.WINDOW.total(windowTyped));
      const open = dr.open && !(trigger && d.typed[E.ENTRY] !== 1);
      doorText = open ? T("doorOpen")(dr.rounds) : T("doorClosed")(dr.rounds);
    } else doorText = T("doorNeedWindow");
    const live = E.live(r, der);
    return `<section class="play" aria-labelledby="h-play">
      <h2 id="h-play">${h(T("inChamber"))}</h2>
      <div class="round">
        <button type="button" data-action="round-" aria-label="${h(T("prevRound"))}" ${d.round <= 0 ? "disabled" : ""}>−</button>
        <p><span class="dim">${h(T("round"))}</span> <strong aria-live="polite">${d.round}</strong></p>
        <button type="button" data-action="round+" aria-label="${h(T("nextRound"))}">+</button>
      </div>
      <p class="door" role="status">${h(doorText)}</p>
      ${trigger ? `<label class="opt"><input type="checkbox" data-flag="${E.ENTRY}" ${d.typed[E.ENTRY] === 1 ? "checked" : ""}> ${h(trigger === "first-death" ? T("gateDeath") : T("gateFire"))} · ${h(T("gateDone"))}</label>` : ""}
      ${manual ? `<p>${h(T("bonfireDoors"))}</p><div class="actions"><button type="button" data-action="doors-open">${h(T("open"))}</button><button type="button" data-action="doors-close">${h(T("close"))}</button></div>` : ""}
      ${E.circle(r, t) ? `<p>${h(T("circle"))}</p>` : ""}
      ${r.condition >= 60 && r.condition <= 64 && !der.conditionExcluded ? `<fieldset class="choice"><legend>${h(T("torcherTitle"))}</legend>
        <label class="opt"><input type="radio" name="torcher" data-choice="${E.TORCHER_TRIGGER}" value="1" ${d.typed[E.TORCHER_TRIGGER] === 1 ? "checked" : ""}> ${h(T("torcherYes"))}</label>
        <label class="opt"><input type="radio" name="torcher" data-choice="${E.TORCHER_TRIGGER}" value="0" ${d.typed[E.TORCHER_TRIGGER] === 0 ? "checked" : ""}> ${h(T("torcherNo"))}</label></fieldset>` : ""}
      ${live.length ? `<h3>${h(T("liveTitle"))}</h3><p class="hint">${h(T("liveHint"))}</p><ul class="kids">${live.map((x) => this.liveRow(x)).join("")}</ul>` : ""}
      ${d.live.length ? `<h3>${h(T("happened"))}</h3><ol class="events">${d.live.map((e) => `<li><span class="dim">${h(T("round"))} ${e.round}</span> · ${h(e.label)} → <strong>${h(e.text)}</strong>${e.page ? ` <span class="pg">${h(T("page")(e.page))}</span>` : ""}${e.note ? `<br><span class="note">${h(E.loc(e.note))}</span>` : ""}</li>`).join("")}</ol>` : ""}
      <form class="close" data-form="close">
        <h3>${h(T("closeTitle"))}</h3>
        <fieldset><legend>${h(T("outcome"))}</legend>
          ${Object.entries(T("outcomes")).map(([k, v], i) => `<label class="opt"><input type="radio" name="outcome" value="${k}" ${i === 0 ? "checked" : ""}> ${h(v)}</label>`).join("")}
        </fieldset>
        <label for="deaths">${h(T("deaths"))}</label>
        <input id="deaths" name="deaths" type="text" inputmode="numeric" pattern="[0-9]*" value="0" class="short">
        <label for="notes">${h(T("notes"))}</label>
        <textarea id="notes" name="notes" rows="2"></textarea>
        <div class="actions"><button type="submit" class="primary">${h(T("save"))}</button></div>
      </form>
    </section>`;
  }

  liveRow(item) {
    const e = item.extra;
    const b = this.d.liveBuffers[item.key] ?? {};
    const chance = E.Chance.of(e.chance ?? "");
    const f = E.formulaOf(e.die ?? "");
    const id = idOf(item.key);
    return `<li class="kid"><p>${h(E.loc(e.of))}${item.page ? ` <span class="pg">${h(T("page")(item.page))}</span>` : ""}</p>
      <div class="field">
        ${chance ? `<label class="mini" for="${id}-c">${h(T("chance"))} ${h(chance.label)}</label><input id="${id}-c" data-live="${h(item.key)}" data-part="chance" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${h(b.chance ?? "")}" class="short" placeholder="d%">` : ""}
        ${f ? `<label class="mini" for="${id}-d">${h(f.label)}</label><input id="${id}-d" data-live="${h(item.key)}" data-part="total" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${h(b.total ?? "")}" class="short" placeholder="${h(f.die)}">` : ""}
        <button type="button" data-action="live" data-key="${h(item.key)}">${h(T("record"))}</button>
      </div></li>`;
  }

  // ---------------------------------------------------------------- eventos

  bind(root, rerender) {
    root.addEventListener("input", (ev) => {
      const el = ev.target;
      if (el.dataset.roll) { this.setRoll(el.dataset.roll, el.value); rerender(); }
      else if (el.dataset.child) { this.setChild(el.dataset.child, el.value); rerender(); }
      else if (el.dataset.live) {
        const b = (this.d.liveBuffers[el.dataset.live] ??= {});
        b[el.dataset.part] = el.value;
        this.save();
      }
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.dataset.choice) { this.setChoice(el.dataset.choice, +el.value); rerender(); }
      else if (el.dataset.flag) {
        if (el.checked) this.d.typed[el.dataset.flag] = 1; else delete this.d.typed[el.dataset.flag];
        this.save(); rerender();
      }
    });
    root.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-action]");
      if (!el) return;
      const a = el.dataset.action;
      if (a === "mimic-toggle") this.d.mimicHidden = !this.d.mimicHidden;
      else if (a === "enter") this.enter();
      else if (a === "new") { if (!confirm(T("confirmNew"))) return; this.reset(); }
      else if (a === "round+") this.d.round += 1;
      else if (a === "round-") this.d.round = Math.max(0, this.d.round - 1);
      else if (a === "doors-open") this.d.typed[E.DOORS] = 1;
      else if (a === "doors-close") this.d.typed[E.DOORS] = 0;
      else if (a === "live") this.recordLive(el.dataset.key);
      else return;
      this.save();
      rerender();
    });
    root.addEventListener("submit", (ev) => {
      if (ev.target.dataset.form !== "close") return;
      ev.preventDefault();
      const f = new FormData(ev.target);
      this.close({ outcome: f.get("outcome"), deaths: f.get("deaths"), notes: f.get("notes") });
      rerender();
      window.scrollTo({ top: 0 });
    });
  }
}

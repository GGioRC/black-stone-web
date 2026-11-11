// Pruebas del motor contra las tablas reales. Abrir tests.html: todas deben salir en verde.
import * as E from "./engine.js";

const results = [];
const test = (name, fn) => {
  try { fn(); results.push([name, null]); } catch (err) { results.push([name, err.message]); }
};
const eq = (a, b, msg = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperaba ${JSON.stringify(b)}, salió ${JSON.stringify(a)}`);
};
const ok = (v, msg) => { if (!v) throw new Error(msg); };

const t = await E.Tables.load("data/");
const keys = (r, typed = {}) => E.children(r, E.derive(r, t), t, typed).map((c) => c.key);

test("Dados del libro: 1d6+1, 20+1d%, 1d4-1, 10d%", () => {
  eq(E.countsOf("1d6+1 Nothics").map((c) => [c.formula.label, c.what]), [["1d6+1", "Nothics"]]);
  eq(E.countsOf("*Ghoul Pack (1d4+1)").map((c) => [c.formula.label, c.what]), [["1d4+1", "Ghoul Pack"]]);
  eq(E.formulaOf("20+1d%").plus, 20);
  eq(E.formulaOf("1d4-1").plus, -1);
  eq([E.formulaOf("10d%").min, E.formulaOf("10d%").max], [10, 1000]);
});

test("Percentiles estrictos: 50%< acepta 1–49; >75% acepta 76–100 (p. 22)", () => {
  const under = E.Chance.of("50%<"), over = E.Chance.of(">75%");
  eq([under.passes(49), under.passes(50), over.passes(75), over.passes(76)], [true, false, false, true]);
});

test("Mímicos: <10 infestada, <50 común, resto nada (p. 85)", () => {
  eq([9, 10, 49, 50].map(E.mimicKind), ["infested", "common", "common", "none"]);
});

test("En un d%, 0 y 00 valen 100", () => {
  eq([E.typedValue("0", "d%"), E.typedValue("00", "d%"), E.typedValue("0", "d6")], [100, 100, 0]);
});

test("Las 100 cámaras tienen nombre, página y regla", () => {
  for (let n = 1; n <= 100; n++) {
    ok(t.has("A", n) && t.page("A", n), `cámara ${n} sin nombre o página`);
    ok(t.ruleOf(n), `cámara ${n} sin regla`);
  }
});

test("Tablas B, C y D completas de 1 a 100", () => {
  for (const tb of ["B", "C", "D"]) for (let n = 1; n <= 100; n++) ok(t.has(tb, n), `${tb} ${n} vacío`);
});

test("Una sola entrada multiplica el Temporizador ×10 (p. 85)", () => {
  const d = E.derive({ chamber: 20, condition: 60, entries: 1, timer: 20 }, t);
  eq(d.timer, 200);
});

test("Sealed Chamber: sin cuenta atrás (p. 87)", () => {
  const d = E.derive({ chamber: 8, condition: 1, entries: 2, timer: 30 }, t);
  eq([d.sealed, d.timer], [true, null]);
});

test("Una condición excluida pide re-tirar (Hydras' Nest excluye Sealed Chamber)", () => {
  const d = E.derive({ chamber: 1, condition: 1 }, t);
  eq(d.conditionExcluded, true);
  ok(!E.blockers({ chamber: 1, condition: 1, entries: 2, timer: 20, loot: 50, inhabitant: 50 }, {}, t).ready, "dejó entrar");
});

test("Deep Rest Temple no tira Condición, Habitantes ni Mímicos (p. 137)", () => {
  const r = { chamber: 93 };
  eq(["condition", "inhabitant", "mimic"].map((x) => E.skipped(x, r, t)), [true, true, true]);
  eq(E.pending(r, t), ["entries", "timer", "loot"]);
});

test("Decan House: la Tabla 3.7 es obligatoria antes de entrar", () => {
  const r = { chamber: 2, entries: 2, timer: 50, loot: 50 };
  const block = E.blockers(r, { "timer.window": 3 }, t);
  ok(block.children.some((c) => c.table === "3.7"), "no pide la 3.7");
});

test("Deep Tombs: 1d10+5 niveles, un d% de esqueletos por nivel", () => {
  const r = { chamber: 8 };
  const levels = keys(r, { "chamber.extra.audit20260921-0": 3 }).filter((k) => k.includes(".level"));
  eq(levels.length, 8);
});

test("Botín con asterisco: el dado es cuántas veces se tira la tabla (p. 167)", () => {
  const r = { chamber: 50, loot: 3 };
  const k = keys(r, { "loot.0": 2 });
  ok(k.includes("loot.0.w1") && k.includes("loot.0.w3") && !k.includes("loot.0.w4"), k.join(","));
});

test("Cambiar una tirada borra lo que colgaba de ella", () => {
  const kept = E.keep({ "loot.0": 2, "inhabitant.0": 1 }, { loot: 3, inhabitant: 41 }, { loot: 4, inhabitant: 41 });
  eq(kept, { "inhabitant.0": 1 });
});

test("Cambiar la cámara vacía las demás tiradas (p. 84)", () => {
  eq(E.typeRoll({ chamber: 8, condition: 12 }, "chamber", 9), { chamber: 9 });
});

test("Ventana de la entrada: cerrada el Temporizador, abierta 1+1d6 rondas", () => {
  eq(E.door(0, 5, 3), { open: false, rounds: 5 });
  eq(E.door(5, 5, 3), { open: true, rounds: 3 });
  eq(E.door(8, 5, 3), { open: false, rounds: 5 });
});

test("Magia salvaje: se tira jugando en la Tabla 3.1", () => {
  const r = { chamber: 8, condition: 12 };
  const live = E.live(r, E.derive(r, t));
  eq(live.map((x) => x.extra.table), ["3.1"]);
  eq(E.resolveLive(live[0], { total: 7 }, t).text, t.name("3.1", 7));
});

const ul = document.getElementById("results");
ul.innerHTML = results.map(([name, err]) => `<li class="${err ? "err" : ""}">${err ? "✗" : "✓"} ${name}${err ? `<br><small>${err}</small>` : ""}</li>`).join("");
const failed = results.filter((r) => r[1]).length;
document.getElementById("summary").textContent = failed ? `${failed} de ${results.length} fallaron` : `${results.length} de ${results.length} pasan`;
document.title = failed ? "FALLAN pruebas" : "Pruebas OK";

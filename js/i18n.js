// Los textos de la interfaz. Los nombres del libro (Sealed Chamber, Hitmen Outpost…) no se traducen.
import { setDataLang } from "./engine.js";

const S = {
  es: {
    app: "Black Stone · The Maze",
    navChamber: "Cámara", navLog: "Registro", navRef: "Referencia",
    roll_chamber: "Cámara", roll_condition: "Condición", roll_entries: "Entradas", roll_timer: "Temporizador",
    roll_loot: "Botín", roll_inhabitant: "Habitantes", roll_mimic: "Mímicos",
    page: (p) => `p. ${p}`,
    chamberRules: "Reglas de la cámara", effect: "Efecto", note: "Nota",
    excluded: "No aplica en esta cámara · vuelve a tirar",
    raised: "mínimo de la cámara",
    rounds: (v) => `${v} rondas`, oneEntry: "×10 una entrada",
    sealed: "Sellada", noCountdown: "Sin cuenta atrás", jammed: "Atascada · prueba Difícil para abrir",
    window: "Rondas abierta", times: "tiradas", table: "Tabla", ultimate: "Arma Definitiva",
    useMimics: "Usar Mímicos", show: "Ver", hide: "Tapar", hidden: "Oculto",
    mimic: { infested: "Infestada · 1d10 Maze Mimics", common: "Common Mimic", none: "Sin mímicos" },
    doubleTitle: "Doble monstruo", doubleTwo: "Dos encuentros", doubleTimes: "Duplicar las cantidades",
    legendaryTitle: "Raider legendario", legendaryTable: "Tabla 3.3", legendaryMM: "Lo elige el Amo",
    schoolExcluded: "Aquí no se prohíbe la Adivinación · vuelve a tirar la escuela (p. 130)",
    enter: "Entrar a la cámara", newChamber: "Nueva cámara", confirmNew: "¿Borrar esta cámara y empezar otra?",
    discard: "Descartar", confirmDiscard: "¿Descartar esta cámara? No se guarda en el registro.",
    inChamber: "En la cámara", round: "Ronda", prevRound: "Ronda anterior", nextRound: "Siguiente ronda",
    doorOpen: (n) => `Entrada abierta · se cierra en ${n}`, doorClosed: (n) => `Entrada cerrada · se abre en ${n}`,
    opened: "Puertas abiertas", closed: "Puertas cerradas", open: "Abrir", close: "Cerrar",
    gateDeath: "Ya hubo una muerte (p. 105)", gateFire: "La hoguera está encendida (p. 126)",
    circle: "Círculo · se puede huir por él (p. 93)",
    torcherTitle: "Torcher", torcherYes: "Escapó o se cumplió el plazo", torcherNo: "Se evitó",
    record: "Anotar",
    outcome: "Cómo terminó",
    outcomes: { cleared: "Salieron por una entrada", time: "Se acabó el tiempo", circle: "Huyeron por un Círculo", wiped: "Murieron todos" },
    deaths: "Muertes", notes: "Notas", save: "Guardar en el registro",
    logEmpty: "Aún no hay cámaras.", logClear: "Borrar el registro", confirmClear: "¿Borrar todas las cámaras del registro?",
    logStats: (c, d) => `${c} ${c === 1 ? "cámara" : "cámaras"} · ${d} ${d === 1 ? "muerte" : "muertes"}`,
    refTables: "Tablas", refCreatures: "Criaturas", refItems: "Ítems", refMaterials: "Materiales",
    number: "Número", allRows: "Tabla completa", search: "Buscar", noMatches: "Nada coincide.",
    weapons: "Armas", size: "Tamaño", craft: "Coste",
    magicItems: "Objetos mágicos", components: "Componentes del Arma Definitiva",
    category: "Categoría", rarity: "Rareza", element: "Elemento", name: "Nombre",
    commonMaterials: "Materiales comunes", specialMaterials: "Materiales especiales", hardness: "Dureza", uses: "Usos",
    credit: "The Maze © M. A. Bastarrachea Magnani · Axo stories",
    loading: "Cargando…", loadError: "No se pudieron cargar las tablas. Recarga la página.",
  },
  en: {
    app: "Black Stone · The Maze",
    navChamber: "Chamber", navLog: "Log", navRef: "Reference",
    roll_chamber: "Chamber", roll_condition: "Condition", roll_entries: "Entries", roll_timer: "Timer",
    roll_loot: "Loot", roll_inhabitant: "Inhabitants", roll_mimic: "Mimics",
    page: (p) => `p. ${p}`,
    chamberRules: "Chamber rules", effect: "Effect", note: "Note",
    excluded: "Does not apply in this chamber · roll again",
    raised: "chamber minimum",
    rounds: (v) => `${v} rounds`, oneEntry: "×10 one entry",
    sealed: "Sealed", noCountdown: "No countdown", jammed: "Jammed · Hard check to open",
    window: "Rounds open", times: "rolls", table: "Table", ultimate: "Ultimate Weapon",
    useMimics: "Use Mimics", show: "Show", hide: "Hide", hidden: "Hidden",
    mimic: { infested: "Infested · 1d10 Maze Mimics", common: "Common Mimic", none: "No mimics" },
    doubleTitle: "Double Monster", doubleTwo: "Two encounters", doubleTimes: "Double the quantities",
    legendaryTitle: "Legendary Raider", legendaryTable: "Table 3.3", legendaryMM: "Maze Master picks",
    schoolExcluded: "Divination is not forbidden here · roll the school again (p. 130)",
    enter: "Enter the chamber", newChamber: "New chamber", confirmNew: "Discard this chamber and start another?",
    discard: "Discard", confirmDiscard: "Discard this chamber? It is not saved to the log.",
    inChamber: "In the chamber", round: "Round", prevRound: "Previous round", nextRound: "Next round",
    doorOpen: (n) => `Entry open · closes in ${n}`, doorClosed: (n) => `Entry closed · opens in ${n}`,
    opened: "Doors open", closed: "Doors closed", open: "Open", close: "Close",
    gateDeath: "Someone has died (p. 105)", gateFire: "The bonfire is lit (p. 126)",
    circle: "Circle · they can flee through it (p. 93)",
    torcherTitle: "Torcher", torcherYes: "It escaped or time ran out", torcherNo: "Avoided",
    record: "Record",
    outcome: "How it ended",
    outcomes: { cleared: "They left through an entry", time: "Time ran out", circle: "They fled through a Circle", wiped: "Everyone died" },
    deaths: "Deaths", notes: "Notes", save: "Save to the log",
    logEmpty: "No chambers yet.", logClear: "Clear the log", confirmClear: "Delete every chamber in the log?",
    logStats: (c, d) => `${c} ${c === 1 ? "chamber" : "chambers"} · ${d} ${d === 1 ? "death" : "deaths"}`,
    refTables: "Tables", refCreatures: "Creatures", refItems: "Items", refMaterials: "Materials",
    number: "Number", allRows: "Whole table", search: "Search", noMatches: "Nothing matches.",
    weapons: "Weapons", size: "Size", craft: "Cost",
    magicItems: "Magic items", components: "Ultimate Weapon components",
    category: "Category", rarity: "Rarity", element: "Element", name: "Name",
    commonMaterials: "Common materials", specialMaterials: "Special materials", hardness: "Hardness", uses: "Uses",
    credit: "The Maze © M. A. Bastarrachea Magnani · Axo stories",
    loading: "Loading…", loadError: "The tables could not load. Reload the page.",
  },
};

const stored = (() => { try { return localStorage.getItem("bs.lang"); } catch { return null; } })();
let current = stored || ((navigator.language || "es").toLowerCase().startsWith("es") ? "es" : "en");
setDataLang(current);
document.documentElement.lang = current;

export const lang = () => current;
export const T = (key) => S[current][key] ?? S.en[key] ?? key;
export function setLang(l) {
  current = l;
  setDataLang(current);
  document.documentElement.lang = current;
  try { localStorage.setItem("bs.lang", current); } catch { /* sin almacenamiento: sólo esta sesión */ }
}

"""Saca del libro los datos cortos de referencia para la web: criaturas, materiales y objetos mágicos.

Lee la transcripción local `The_Maze.md` (no se publica) y escribe en `web/data/`:
  bestiary.json   criaturas del capítulo 5 con sus datos de juego (sin la descripción en cursiva)
  materials.json  materiales comunes y especiales (HP, dureza y usos)
  magic.json      objetos mágicos y componentes del Arma Definitiva (categoría, rareza)

Sólo nombres, cifras y la página: el detalle se lee en el libro. Uso:
  python -X utf8 web/tools/build_reference.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOK = ROOT / "The_Maze.md"
OUT = ROOT / "web" / "data"

PAGE = re.compile(r"<!--\s*p\.(\d+)\s*-->")
HEADING = re.compile(r"^(#{2,5})\s+(.*\S)\s*$")
FIELD = re.compile(r"^\s*-?\s*\*{2,3}([^*:]+?):?\*{2,3}:?\s*(.*)$")


def lines_with_pages(start_marker, end_marker):
    """Las líneas entre dos títulos del libro, cada una con la página en que cae."""
    page, inside, out = None, False, []
    for raw in BOOK.read_text(encoding="utf-8").splitlines():
        m = PAGE.search(raw)
        if m:
            page = int(m.group(1))
            continue
        if not inside and raw.strip() == start_marker:
            inside = True
        elif inside and raw.strip() == end_marker:
            break
        if inside:
            out.append((page, raw.rstrip()))
    if not out:
        sys.exit(f"No encontré {start_marker!r} en {BOOK}")
    return out


def blocks(lines, levels):
    """Corta en bloques por título: [(nivel, título, página, [líneas])]."""
    result, current = [], None
    for page, line in lines:
        h = HEADING.match(line)
        if h and len(h.group(1)) in levels:
            current = [len(h.group(1)), h.group(2).strip(), page, []]
            result.append(current)
        elif current is not None:
            current[3].append(line)
    return result


def clean(text):
    text = re.sub(r"\*+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .;")


def short(text, limit=140):
    """Lo mecánico de un campo, sin las frases que lo explican: hasta el primer punto."""
    text = clean(text)
    cut = re.split(r"(?<=[a-z\])])\.\s", text, maxsplit=1)[0]
    return cut if len(cut) <= limit else cut[: limit - 1].rsplit(" ", 1)[0] + "…"


SMALL = {"of", "and", "or", "the", "in"}


def title_case(name):
    """«OKTAR'S HITMEN» → «Oktar's Hitmen»; los nombres que ya vienen en minúsculas se quedan."""
    name = re.sub(r"^\d+[a-z]?\.\s*", "", name).strip()
    letters = [c for c in name if c.isalpha()]
    if sum(c.isupper() for c in letters) <= len(letters) / 2:
        return name
    words = name.lower().split(" ")
    upper = lambda w: re.sub(r"^([^a-z]*)([a-z])", lambda m: m.group(1) + m.group(2).upper(), w)
    return " ".join(w if i and w in SMALL else upper(w) for i, w in enumerate(words))


# ---------------------------------------------------------------- criaturas

TOP = {"ST", "Role", "S&T", "AL", "Perception", "Speed", "Defenses", "Attacks", "Special",
       "Weaknesses", "L&Y", "Chamber"}
DEF = {"Armor", "Savings", "Immunities", "Resistances"}
KEEP = ["ST", "Role", "S&T", "AL", "Perception", "Speed", "Armor", "Savings", "Immunities",
        "Resistances", "Weaknesses", "L&Y", "Chamber"]


def creature(lines):
    data, attacks, special, section = {}, [], [], None
    for line in lines:
        m = FIELD.match(line)
        if not m:
            continue
        key, value = clean(m.group(1)), m.group(2)
        if key in TOP or key in DEF:
            section = key if key in ("Defenses", "Attacks", "Special") else (
                "Defenses" if key in DEF else None)
            if key in KEEP and value.strip():
                data[key] = short(value, 160)
            continue
        if section == "Attacks":
            bracket = re.search(r"\[[^\]]*\]", value)
            kind = re.match(r"\s*(\([^)]*\))", value)
            attacks.append(" ".join(x for x in [key, kind.group(1) if kind else "",
                                                 bracket.group(0) if bracket else ""] if x))
        elif section == "Special":
            special.append(key)
    if attacks:
        data["Attacks"] = attacks
    if special:
        data["Special"] = special
    return data


def bestiary():
    lines = lines_with_pages("# 5. Inhabitants of the Maze", "# 6. Spoiler warning")
    # La Tabla de Ajedrez y los Críticos son reglas extendidas: fuera.
    cut = next(i for i, (_, l) in enumerate(lines) if l.strip() == "## THE CHESS BOARD")
    lines = lines[:cut]
    out, family = [], None
    for level, title, page, body in blocks(lines, {2, 3, 4}):
        stats = creature(body)
        name = title_case(title)
        if name.startswith("(") and name.endswith(")"):
            name = name[1:-1]
        # «8. HYDRA» abre familia; «8a. …» es de esa familia; «THE PIECES» la cierra.
        if re.match(r"^\d+\.", title):
            family = name
        elif re.match(r"^THE\b", title) and title.isupper():
            family = None
        if not stats or name.startswith("A monster compendium"):
            continue
        out.append({"name": name, "family": family if family != name else None,
                    "page": page, "shared": "AL" not in stats or None, **stats})
    return out


# ---------------------------------------------------------------- materiales y objetos

def resources():
    lines = lines_with_pages("## BASIC RESOURCES", "## EXTENDED RULES: LIFE AT THE BONFIRE")
    materials, magic, group = [], [], None
    for level, title, page, body in blocks(lines, {4, 5}):
        upper = title.upper()
        if level == 4 and upper in ("COMMON MATERIALS", "SPECIAL MATERIALS", "MAGIC ITEMS",
                                    "THE ULTIMATE WEAPON"):
            group = upper
            continue
        if title.startswith("Special Ruling"):
            continue
        fields = {}
        for line in body:
            m = FIELD.match(line)
            if m:
                fields[clean(m.group(1))] = m.group(2)
        if group in ("COMMON MATERIALS", "SPECIAL MATERIALS") and level == 4:
            item = {"name": title, "kind": "common" if group.startswith("COMMON") else "special",
                    "page": page}
            for key in ("HP", "Hardness"):
                if key in fields:
                    item[key] = clean(fields[key])
            if "Uses" in fields:
                item["Uses"] = short(fields["Uses"], 160)
            materials.append(item)
        elif group == "MAGIC ITEMS" and level == 4:
            item = {"name": title, "kind": "magic", "page": page}
            for key in ("Category", "Rarity"):
                if key in fields:
                    item[key] = clean(fields[key])
            magic.append(item)
        elif group == "THE ULTIMATE WEAPON" and level == 5:
            m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", title)
            magic.append({"name": m.group(1) if m else title, "kind": "component",
                          "element": m.group(2) if m else None, "page": page})
    return materials, magic


def main():
    beasts = bestiary()
    materials, magic = resources()
    note = "Datos de juego abreviados de The Maze (M. A. Bastarrachea Magnani, Axo stories). El detalle está en la página indicada."
    for name, rows in (("bestiary", beasts), ("materials", materials), ("magic", magic)):
        path = OUT / f"{name}.json"
        path.write_text(json.dumps({"source": note, "items": rows}, ensure_ascii=False, indent=1),
                        encoding="utf-8")
        print(f"{path.name}: {len(rows)}")


if __name__ == "__main__":
    main()

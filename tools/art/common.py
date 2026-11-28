"""Gemeinsame Helfer der Pixel-Pipeline (nur Standardbibliothek + Pillow).

- Pfade, DB-Laden (Vertrag: docs/datenvertrag.md)
- Größenklassen, Farblimits, Seltenheitsfarben (GAME_SPEC Teil F / B5)
- OKLab/OKLCh-Farbumrechnung für Rampen mit Farbtonverschiebung
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_DB = os.path.join(ROOT, "public", "data", "fish_db.json")
FIXTURE_DB = os.path.join(ROOT, "art_src", "fixtures", "fish_db_sample.json")
ART_SRC = os.path.join(ROOT, "art_src")
PAL_DIR = os.path.join(ART_SRC, "palettes")
FISH_DIR = os.path.join(ART_SRC, "fish")
CONTACT_DIR = os.path.join(ART_SRC, "contact")
OUT_DIR = os.path.join(ROOT, "public", "assets", "fish")

GENERATOR_VERSION = "0.3.0"

# Größenklassen (Teil F1 / 5.0)
CANVAS = {"S": (32, 16), "M": (64, 32), "L": (96, 48), "XL": (128, 64), "Boss": (256, 128)}
COLOR_LIMIT = {"S": 12, "M": 16, "L": 16, "XL": 16, "Boss": 24}
SWIM_AMP = {"S": 1, "M": 1, "L": 2, "XL": 2, "Boss": 2}

# Clips (Datenvertrag §4) – Frames und Bildraten
CLIP_FPS = {"swim": 10, "idle": 6, "struggle": 14, "caught": 8}


def clip_frames(klasse: str) -> dict:
    return {"swim": 4 if klasse == "S" else 6, "idle": 4, "struggle": 4, "caught": 3}


RARITY_COLOR = {
    "gewoehnlich": "#B0B7C3",
    "ungewoehnlich": "#5BD16B",
    "selten": "#3FA9F5",
    "episch": "#A86BFF",
    "legendaer": "#FFC83D",
}

WORLD_INDEX = {"W1": "see", "W2": "riff", "W3": "fjord", "W4": "tiefe", "W5": "grotte"}

# Leitfarben aus GAME_SPEC Teil E Abschnitt 4 (Fallback, falls worlds.json fehlt)
LEITFARBEN = {
    "see": [("Himmelblau", "#8FD3F4"), ("Seetuerkis", "#3FA7A3"), ("Tiefgruen", "#1E5F5B"),
            ("Grundschatten", "#12342F"), ("Schilfgruen", "#6BA34A"), ("Stegholz", "#8A5A33"),
            ("Seerosenrosa", "#F4A6C1"), ("Sonnengelb", "#FFE066")],
    "riff": [("Lagunentuerkis", "#2EC4B6"), ("Tiefblau", "#0B4F8A"), ("Abgrundblau", "#06264A"),
             ("Korallenrot", "#FF6F59"), ("Anemonenpink", "#FF9EC7"), ("Tropengelb", "#FFD23F"),
             ("Seeigelviolett", "#7B2CBF"), ("Sandbeige", "#F7E3AF")],
    "fjord": [("Schneeweiss", "#EAF6FF"), ("Frostblau", "#A9D6F5"), ("Gletscherblau", "#4F9DDE"),
              ("Polarnacht", "#12355B"), ("Fjordschwarzblau", "#0A1A2F"), ("Polarlichtgruen", "#5CFFB0"),
              ("Polarlichtviolett", "#B57BFF"), ("Daemmerrosa", "#F2B5D4")],
    "tiefe": [("Abgrundschwarz", "#050A1F"), ("Tiefindigo", "#1B1446"), ("Daemmerviolett", "#3A1C71"),
              ("Biocyan", "#00F5D4"), ("Leuchtgruen", "#7CFF6B"), ("Quallenmagenta", "#F15BB5"),
              ("Laternengelb", "#FEE440"), ("Knochengrau", "#9AA0B5")],
    "grotte": [("Obsidianschwarz", "#1A1015"), ("Basaltgrau", "#3B2A2F"), ("Magmarot", "#D7263D"),
               ("Lavaorange", "#F46036"), ("Glutgelb", "#FFB627"), ("Aschgrau", "#7D6E6E"),
               ("Schwefelgruen", "#C5D86D"), ("Kristallviolett", "#8E44AD")],
}

# ---------------------------------------------------------------- DB


def norm_rarity(s: str) -> str:
    s = (s or "").lower().replace("ö", "oe").replace("ä", "ae").replace("ü", "ue")
    return s if s in RARITY_COLOR else "gewoehnlich"


def resolve_db_path(argv: list[str]) -> str:
    """Erstes Nicht-Flag-Argument = DB-Pfad. Standard public/data/fish_db.json.
    Fehlt die Standard-DB, wird (mit Warnung) die Fixture verwendet."""
    args = [a for a in argv[1:] if not a.startswith("--")]
    if args:
        return os.path.abspath(args[0])
    if os.path.exists(DEFAULT_DB):
        return DEFAULT_DB
    print(f"WARNUNG: {os.path.relpath(DEFAULT_DB, ROOT)} fehlt – verwende Fixture "
          f"{os.path.relpath(FIXTURE_DB, ROOT)}", file=sys.stderr)
    return FIXTURE_DB


def load_db(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    fish = data["fish"] if isinstance(data, dict) else data
    return [normalize_fish(x) for x in fish]


def _canvas(g: dict, klasse: str) -> tuple[int, int]:
    c = g.get("canvas") if isinstance(g, dict) else None
    if isinstance(c, (list, tuple)) and len(c) == 2:
        return int(c[0]), int(c[1])
    if isinstance(c, dict) and "w" in c:
        return int(c["w"]), int(c["h"])
    if isinstance(c, str) and "x" in c:
        w, h = c.lower().split("x")
        return int(w), int(h)
    return CANVAS.get(klasse, (64, 32))


def normalize_fish(f: dict) -> dict:
    """Bringt einen DB-Eintrag in die von der Pipeline benutzte Form (tolerant)."""
    g = f.get("groesse") or {}
    klasse = g.get("klasse") if isinstance(g, dict) else str(g)
    if f.get("boss"):
        klasse = "Boss"
    klasse = klasse if klasse in CANVAS else "M"
    w, h = _canvas(g, klasse)
    welt = f.get("welt", "W1")
    kuerzel = f.get("weltKuerzel") or WORLD_INDEX.get(welt, "see")
    nr = int(f.get("nr") or int(str(f.get("id", "F0"))[1:] or 0))
    slug = f.get("slug") or slugify(f.get("name", f"fisch-{nr}"))
    art = dict(f.get("art") or {})
    art.setdefault("koerperform", "normal")
    art.setdefault("schwanz", "gegabelt")
    art.setdefault("muster", "keins")
    art.setdefault("merkmale", [])
    art.setdefault("leuchtet", bool(f.get("leuchtet", False)))
    if isinstance(art.get("merkmale"), str):
        art["merkmale"] = [m for m in art["merkmale"].split("|") if m]
    return {
        "id": f.get("id", f"F{nr:03d}"),
        "nr": nr,
        "name": f.get("name", slug),
        "welt": welt,
        "kuerzel": kuerzel,
        "assetKey": f.get("assetKey") or f"fish_{kuerzel}_{nr:03d}_{slug}",
        "rarity": norm_rarity(f.get("seltenheit", "")),
        "boss": bool(f.get("boss")),
        "klasse": klasse,
        "canvas": (w, h),
        "art": art,
    }


def slugify(name: str) -> str:
    s = name.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    out = "".join(c if ("a" <= c <= "z" or "0" <= c <= "9") else "-" for c in s)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")


def seed_for(fish_id: str) -> int:
    return int(hashlib.sha256(fish_id.encode("utf-8")).hexdigest()[:8], 16)


def load_leitfarben(kuerzel: str) -> list[tuple[str, str]]:
    """Leitfarben aus public/data/worlds.json (falls vorhanden), sonst Spec-Fallback."""
    p = os.path.join(ROOT, "public", "data", "worlds.json")
    if os.path.exists(p):
        try:
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
            for w in data.get("worlds", []):
                if w.get("kuerzel") == kuerzel:
                    cols = w.get("leitfarben") or w.get("leadPalette")
                    if isinstance(cols, str):
                        cols = cols.split("|")
                    if cols and len(cols) >= 8 and all(is_hex(c) for c in cols):
                        names = [n for n, _ in LEITFARBEN[kuerzel]]
                        return list(zip(names, [c.upper() for c in cols[:8]]))
        except (OSError, ValueError, KeyError):
            pass
    return LEITFARBEN[kuerzel]


# ---------------------------------------------------------------- Farben

def is_hex(s) -> bool:
    if not isinstance(s, str) or not s.startswith("#") or len(s) != 7:
        return False
    try:
        int(s[1:], 16)
        return True
    except ValueError:
        return False


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(c) -> str:
    return "#%02X%02X%02X" % tuple(c[:3])


# deutsche Farbwörter als Notnagel, falls die DB keine Hex-Werte liefert
COLOR_WORDS = {
    "olivgruen": "#5B6B2F", "hellgelb": "#E9D86A", "weiss": "#E8E8E0", "rotbraun": "#8A4B2A",
    "silber": "#C9D1D9", "gold": "#D9B44A", "schwarz": "#202028", "blau": "#3A6FC4",
    "rot": "#C8342C", "orange": "#E8862E", "gelb": "#F2D03A", "gruen": "#4E9A3C",
    "grau": "#8A9098", "braun": "#6E4A2E", "rosa": "#F0A0B8", "violett": "#8A4BC0",
    "tuerkis": "#2EB8B0", "pink": "#F06AA8", "beige": "#E2D2A8", "cyan": "#3CE0E0",
}


def color_or_default(c, default: str) -> str:
    if is_hex(c):
        return c.upper()
    if isinstance(c, str):
        k = c.lower().replace("ü", "ue").replace("ö", "oe").replace("ä", "ae").replace("ß", "ss")
        for word, hx in COLOR_WORDS.items():
            if word in k:
                return hx
    return default


def _lin(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _delin(c: float) -> float:
    c = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return c * 255.0


def rgb_to_oklab(rgb) -> tuple[float, float, float]:
    r, g, b = (_lin(v) for v in rgb[:3])
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)


def oklab_to_rgb_f(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return r, g, bb


def oklch_to_rgb(L, C, h) -> tuple[int, int, int]:
    """OKLCh → sRGB, Chroma wird bis in den Gamut reduziert."""
    hr = math.radians(h)
    for _ in range(40):
        r, g, b = oklab_to_rgb_f(L, C * math.cos(hr), C * math.sin(hr))
        if min(r, g, b) >= -0.0005 and max(r, g, b) <= 1.0005:
            break
        C *= 0.9
    out = []
    for v in (r, g, b):
        v = min(1.0, max(0.0, v))
        out.append(int(round(_delin(v))))
    return tuple(out)


def rgb_to_oklch(rgb):
    L, a, b = rgb_to_oklab(rgb)
    C = math.hypot(a, b)
    h = math.degrees(math.atan2(b, a)) % 360
    return L, C, h


def oklab_dist(c1, c2) -> float:
    a = rgb_to_oklab(c1)
    b = rgb_to_oklab(c2)
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def safe_rgb(c) -> tuple[int, int, int]:
    """Kein reines Schwarz/Weiß (Weiß nur im Augenlicht, wird separat gesetzt)."""
    c = tuple(int(v) for v in c[:3])
    if c == (0, 0, 0):
        return (8, 10, 18)
    if c == (255, 255, 255):
        return (250, 250, 244)
    return c


def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)

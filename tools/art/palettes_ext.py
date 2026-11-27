#!/usr/bin/env python3
"""Zusatzpaletten für Welt-Hintergründe, Figuren und HUD (Style Guide F1: Rampen zu 3–5 Stufen
mit Farbtonverschiebung – Schatten kühler/satter, Lichter wärmer; kein #000/#FFF).

- `see_ext.json`  : Ergänzung zur Weltpalette `see.json` für Himmel/Tageszeiten, Wolken, Stein, Sand,
                    Signalrot. Welt-Grafiken von W1 dürfen nur `see` ∪ `see_ext` benutzen (zusammen
                    ≤ 64 Farben = Master-Palette-Rahmen aus F1).
- `figures.json`  : Figuren & Ausrüstung (weltübergreifend, „gleiche Regeln, eigene Rampen“).
- `hud.json`      : HUD in Holz-Messing-Optik + Seltenheitsfarben aus B5.

Aufruf: python3 tools/art/palettes_ext.py
"""
from __future__ import annotations

import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import palette as P  # noqa: E402

# (Name, Basis, Stufen, Index der Basis)
SEE_EXT = [
    ("Wolke", "#F2EFE2", 4, 3),
    ("Nachtblau", "#1F2B5C", 4, 1),
    ("Abendglut", "#E8743C", 4, 2),
    ("Dunkelholz", "#4F2F1C", 3, 1),
    ("Signalrot", "#C8382F", 4, 1),
    ("Stein", "#8D96A0", 4, 2),
    ("Sand", "#D8BE88", 4, 2),
]

FIGURES = [
    ("Haut", "#E6B48C", 4, 2),
    ("Signalrot", "#C8382F", 4, 1),
    ("Jackenblau", "#3A6FC4", 4, 1),
    ("Jackengruen", "#4E9A3C", 4, 1),
    ("Friesengelb", "#F2C230", 4, 2),
    ("Jeans", "#3F5A86", 3, 1),
    ("Stroh", "#D9B86A", 4, 2),
    ("Holz", "#8A5A33", 4, 1),
    ("Dunkelholz", "#4F2F1C", 3, 1),
    ("Metall", "#9AA4B0", 4, 2),
    ("Wolke", "#F2EFE2", 4, 3),
    ("Froschgruen", "#5DAA3C", 4, 2),
    ("Himmel", "#8FD3F4", 4, 2),
    ("Tinte", "#2A2230", 2, 0),
]

HUD = [
    ("Holz", "#7A4A28", 5, 2),
    ("Messing", "#D4A640", 5, 2),
    ("Pergament", "#E6D4A6", 4, 2),
    ("Tinte", "#2A1E1A", 2, 0),
    ("Signalrot", "#D63A30", 4, 1),
    ("Orange", "#F08A24", 4, 1),
    ("Warngelb", "#F2D03A", 3, 1),
    ("Gruen", "#4FB848", 4, 1),
    ("Wasser", "#3FA7A3", 4, 2),
    ("Wolke", "#F2EFE2", 3, 2),
    # Seltenheit (B5): Basis exakt, je eine dunklere Stufe für die Outline
    ("Gewoehnlich", "#B0B7C3", 3, 1),
    ("Ungewoehnlich", "#5BD16B", 3, 1),
    ("Selten", "#3FA9F5", 3, 1),
    ("Episch", "#A86BFF", 3, 1),
    ("Legendaer", "#FFC83D", 3, 1),
]


def build(spec, kuerzel, note):
    ramps = []
    for name, base, n, idx in spec:
        cols = P.make_ramp(base, n, target_idx=idx, dl=0.085, l_min=0.12, l_max=0.965)
        ramps.append({"name": name, "base": base, "colors": [C.rgb_to_hex(c) for c in cols]})
    flat = []
    for r in ramps:
        for c in r["colors"]:
            if c not in flat:
                flat.append(c)
    pal = {"kuerzel": kuerzel, "hinweis": note, "ramps": ramps, "colors": flat, "count": len(flat)}
    C.ensure_dir(C.PAL_DIR)
    with open(os.path.join(C.PAL_DIR, f"{kuerzel}.json"), "w", encoding="utf-8") as f:
        json.dump(pal, f, indent=2, ensure_ascii=False)
    sw = 16
    mx = max(len(r["colors"]) for r in ramps)
    img = Image.new("RGBA", (sw * mx + 4, sw * len(ramps) + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y, r in enumerate(ramps):
        for x, c in enumerate(r["colors"]):
            d.rectangle([2 + x * sw, 2 + y * sw, 2 + x * sw + sw - 1, 2 + y * sw + sw - 1],
                        fill=C.hex_to_rgb(c) + (255,))
    img.save(os.path.join(C.PAL_DIR, f"{kuerzel}.png"))
    return pal


def main():
    out = [
        build(SEE_EXT, "see_ext", "Ergänzung zu see.json (Himmel/Tageszeit, Wolken, Stein, Sand, Signalrot)"),
        build(FIGURES, "figures", "Figuren & Ausrüstung (weltübergreifend)"),
        build(HUD, "hud", "HUD Holz-Messing + Seltenheitsfarben B5"),
    ]
    for p in out:
        print(f"{p['kuerzel']:8s} {p['count']:2d} Farben -> art_src/palettes/{p['kuerzel']}.json/.png")


if __name__ == "__main__":
    main()

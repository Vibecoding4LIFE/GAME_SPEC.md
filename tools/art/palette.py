"""Paletten: Weltpaletten (24–32 Farben aus 8 Leitfarben) und Fisch-Rampen.

Rampen werden in OKLCh gebaut: dunklere Stufen wandern im Farbton Richtung Blau
und werden satter (kühle Schatten), hellere Stufen wandern Richtung Gelb und
werden leicht entsättigt (warme Lichter). Kein #000000 / #FFFFFF.

Aufruf einzeln:  python3 tools/art/palette.py   (schreibt nur die Weltpaletten)
"""
from __future__ import annotations

import json
import math
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

COOL_HUE = 268.0   # OKLCh-Blau
WARM_HUE = 92.0    # OKLCh-Gelb
L_MIN, L_MAX = 0.17, 0.95


def _toward(h: float, target: float, amount: float) -> float:
    d = ((target - h + 540.0) % 360.0) - 180.0
    step = max(-amount, min(amount, d))
    return (h + step) % 360.0


def make_ramp(base_hex: str, n: int, target_idx: int | None = None, dl: float | None = None,
              hue_step: float = 7.0, l_min: float = L_MIN, l_max: float = L_MAX) -> list[tuple]:
    """n Stufen von dunkel nach hell. Die Basisfarbe liegt (wenn möglich) auf target_idx."""
    L, Cc, h = C.rgb_to_oklch(C.hex_to_rgb(base_hex))
    if n == 1:
        return [C.safe_rgb(C.hex_to_rgb(base_hex))]
    if dl is None:
        dl = {2: 0.15, 3: 0.12, 4: 0.105, 5: 0.092}.get(n, 0.085)
    if target_idx is None:
        target_idx = (n - 1) // 2
    # Basisposition so wählen, dass alle Stufen im Helligkeitsbereich liegen
    best = None
    for b in range(n):
        lo = L - b * dl
        hi = L + (n - 1 - b) * dl
        if lo >= l_min - 1e-6 and hi <= l_max + 1e-6:
            if best is None or abs(b - target_idx) < abs(best - target_idx):
                best = b
    if best is None:
        # zu wenig Platz: Stufen stauchen, Basis bleibt erhalten
        b = target_idx
        room_lo = max(0.0, L - l_min)
        room_hi = max(0.0, l_max - L)
        if b > 0 and room_lo / b < dl:
            dl = room_lo / b if room_lo > 0 else dl
        if (n - 1 - b) > 0 and room_hi / (n - 1 - b) < dl:
            dl = min(dl, room_hi / (n - 1 - b)) if room_hi > 0 else dl
        dl = max(dl, 0.045)
        best = b
    out = []
    for i in range(n):
        k = i - best
        Li = min(l_max, max(l_min * 0.8, L + k * dl))
        if k < 0:
            # Gelb/Orange nicht über Grün abdunkeln, sondern Richtung Rot-Violett
            target = 20.0 if 55.0 <= h <= 125.0 and Cc > 0.06 else COOL_HUE
            if Cc < 0.05:
                # neutrale Töne: Eigenfarbe zurücknehmen, Blau-Anteil zumischen (kühler Schatten)
                a = Cc * math.cos(math.radians(h)) * (1 - 0.18 * -k) + 0.010 * -k * math.cos(math.radians(COOL_HUE))
                bb = Cc * math.sin(math.radians(h)) * (1 - 0.18 * -k) + 0.010 * -k * math.sin(math.radians(COOL_HUE))
                hi_ = math.degrees(math.atan2(bb, a)) % 360
                Ci = math.hypot(a, bb)
            else:
                hi_ = _toward(h, target, hue_step * -k)
                Ci = Cc * (1.0 + 0.05 * -k) + 0.007 * -k
            if Li < 0.42:
                Ci *= max(0.45, Li / 0.42)
        elif k > 0:
            hi_ = _toward(h, WARM_HUE, hue_step * k)
            Ci = Cc * (1.0 - 0.12 * k) + 0.006 * k
        else:
            out.append(C.safe_rgb(C.hex_to_rgb(base_hex)))
            continue
        out.append(C.safe_rgb(C.oklch_to_rgb(Li, max(0.0, Ci), hi_)))
    # Doppelte vermeiden
    for i in range(1, n):
        if out[i] == out[i - 1]:
            r, g, b = out[i]
            out[i] = C.safe_rgb((min(255, r + 6), min(255, g + 6), min(255, b + 4)))
    return out


# ---------------------------------------------------------------- Weltpalette

def world_palette(kuerzel: str) -> dict:
    lf = C.load_leitfarben(kuerzel)
    ramps = []
    for name, hx in lf:
        L = C.rgb_to_oklch(C.hex_to_rgb(hx))[0]
        # sehr dunkle Leitfarben stehen unten, sehr helle oben in ihrer Rampe
        t = (L - 0.25) / 0.65
        target = int(round(max(0.0, min(1.0, t)) * 3))
        cols = make_ramp(hx, 4, target_idx=target, dl=0.085, l_min=0.12, l_max=0.965)
        ramps.append({"name": name, "base": hx, "colors": [C.rgb_to_hex(c) for c in cols]})
    flat = []
    for r in ramps:
        for c in r["colors"]:
            if c not in flat:
                flat.append(c)
    return {"kuerzel": kuerzel, "leitfarben": [hx for _, hx in lf], "ramps": ramps,
            "colors": flat, "count": len(flat)}


def save_world_palette(kuerzel: str) -> dict:
    C.ensure_dir(C.PAL_DIR)
    pal = world_palette(kuerzel)
    with open(os.path.join(C.PAL_DIR, f"{kuerzel}.json"), "w", encoding="utf-8") as f:
        json.dump(pal, f, indent=2, ensure_ascii=False)
    sw = 16
    img = Image.new("RGBA", (sw * 4 + 4, sw * len(pal["ramps"]) + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y, r in enumerate(pal["ramps"]):
        for x, c in enumerate(r["colors"]):
            d.rectangle([2 + x * sw, 2 + y * sw, 2 + x * sw + sw - 1, 2 + y * sw + sw - 1],
                        fill=C.hex_to_rgb(c) + (255,))
    img.save(os.path.join(C.PAL_DIR, f"{kuerzel}.png"))
    return pal


def world_backgrounds(kuerzel: str) -> tuple[tuple, tuple]:
    """(heller, dunkler) Weltgrund für Kontaktbögen – aus der Weltpalette."""
    pal = world_palette(kuerzel)
    cols = [C.hex_to_rgb(c) for c in pal["colors"]]
    by_l = sorted(cols, key=lambda c: C.rgb_to_oklab(c)[0])
    light = by_l[-1]
    dark = by_l[0]
    # Wasserfarben bevorzugen: zweite Leitfarbe-Rampe (Oberflächenwasser) hell
    water = [C.hex_to_rgb(c) for c in pal["ramps"][1]["colors"]]
    if C.rgb_to_oklab(water[-1])[0] > 0.7:
        light = water[-1]
    return light, dark


# ---------------------------------------------------------------- Fischpalette

def fish_ramps(art: dict, klasse: str, boss: bool, merkmale: list[str], schillernd: bool = False) -> dict:
    """Rampen für einen Fisch. Größen so gewählt, dass das Limit (12/16/24) meist
    ohne Zusammenlegen passt; fishgen legt nach dem Rendern ggf. Nachbarn zusammen."""
    farben = art.get("schillerndFarben") if schillernd else art.get("farben")
    farben = list(farben or [])
    defaults = ["#6A7F5A", "#E2DCC0", "#C9A84A", "#8A5A3A", "#D8B040"]
    cols = [C.color_or_default(farben[i] if i < len(farben) else None, defaults[i]) for i in range(5)]
    has_iris = len(farben) >= 5 and C.is_hex(farben[4])
    big = boss or klasse == "Boss"
    if klasse == "S":
        sizes = {"main": 5, "belly": 2, "acc": 2, "fin": 2}
    elif big:
        sizes = {"main": 5, "belly": 4, "acc": 4, "fin": 4}
    else:
        sizes = {"main": 5, "belly": 3, "acc": 3, "fin": 3}
    ramps = {
        "main": make_ramp(cols[0], sizes["main"], target_idx=2),
        "belly": make_ramp(cols[1], sizes["belly"], target_idx=sizes["belly"] - 2 if sizes["belly"] > 2 else 1),
        "acc": make_ramp(cols[2], sizes["acc"], target_idx=(sizes["acc"] - 1) // 2 + (1 if sizes["acc"] > 2 else 0)),
        "fin": make_ramp(cols[3], sizes["fin"], target_idx=(sizes["fin"] - 1) // 2),
    }
    if has_iris:
        ramps["iris"] = make_ramp(cols[4], 2 if big else 1, target_idx=1 if big else 0)
    if "haken" in merkmale:
        ramps["metal"] = make_ramp("#AEB6C2", 3 if big else 2, target_idx=1)
    if "moos" in merkmale:
        ramps["moss"] = make_ramp("#5E8C3A", 3 if big else 2, target_idx=1)
    ramps["white"] = [(255, 255, 255)]
    return {"ramps": ramps, "base": cols, "has_iris": has_iris}


def main() -> None:
    for k in C.LEITFARBEN:
        pal = save_world_palette(k)
        print(f"{k:7s} {pal['count']:2d} Farben -> art_src/palettes/{k}.json/.png")


if __name__ == "__main__":
    main()

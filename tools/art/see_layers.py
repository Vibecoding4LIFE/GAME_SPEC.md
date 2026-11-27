"""Parallax-Ebenen von Welt 1 „Sonnenspiegelsee“ (F1/F7/F8.6) – prozedural, deterministisch.

Alle Ebenen 960 px breit und horizontal kachelbar (Ausnahme: Bootshaus/Steg, ein fest platziertes Bild).
Farben nur aus `see.json` ∪ `see_ext.json`, 2×2-Bayer nur hier in den Hintergründen.
"""
from __future__ import annotations

import math
import random

import common as C
import see_layout as L
from pixkit import Img, Pal, bayer, fbm1, pnoise1

W = L.WORLD_W
PAL = None


def pal() -> Pal:
    global PAL
    if PAL is None:
        PAL = Pal("see", "see_ext")
    return PAL


def hx(s: str):
    return C.hex_to_rgb(s) + (255,)


def R(name, i):
    return pal()(name, i)


# =========================================================================== Himmel

SKY = {
    "tag": {"stops": ["#407DBC", "#569ACF", "#71B7E1", "#8FD3F4"],
            "cloud": ["#71B7E1", "#B4B8BE", "#D3D3D0", "#F2EFE2"]},
    "morgen": {"stops": ["#569ACF", "#71B7E1", "#8FD3F4", "#D3D3D0", "#F4A6C1", "#FFE066"],
               "cloud": ["#BE6C9F", "#D988AF", "#F4A6C1", "#F2EFE2"]},
    "abend": {"stops": ["#2D4473", "#3E5E89", "#BE6C9F", "#E8743C", "#FD9755", "#F0BE2C"],
              "cloud": ["#A15090", "#D34F25", "#FD9755", "#FFE066"]},
    "nacht": {"stops": ["#111934", "#111934", "#1F2B5C", "#2D4473", "#3E5E89"],
              "cloud": ["#111934", "#1F2B5C", "#2D4473", "#3E5E89"]},
}
SKY_H = 124
CLOUDS = [  # (x-Mitte, Unterkante y, Breite, Höhe, seed)
    (90, 46, 64, 22, 1), (300, 30, 44, 15, 2), (470, 58, 90, 26, 3), (690, 36, 54, 18, 4),
    (860, 66, 40, 13, 5), (590, 80, 30, 9, 6), (200, 84, 36, 10, 7),
]


def cumulus(img: Img, cx, base_y, width, height, ramp, seed):
    rng = random.Random(seed * 131)
    circles = []
    n = max(3, int(width / 9))
    for i in range(n):
        t = i / (n - 1)
        hm = height * (1.0 - 0.55 * (2 * t - 1) ** 2)
        r = rng.uniform(0.42, 0.62) * hm + 2
        x = cx - width / 2 + r * 0.6 + t * (width - r * 1.2) + rng.uniform(-2, 2)
        y = base_y - hm + r
        circles.append((x, y, r))
    for _ in range(n // 2):  # zweite Reihe Quellwolken
        x = cx + rng.uniform(-0.3, 0.3) * width
        hm = height * 0.75
        r = rng.uniform(0.35, 0.55) * hm + 2
        circles.append((x, base_y - hm * 0.85 + r, r))
    x0, x1 = int(cx - width / 2 - 4), int(cx + width / 2 + 4)
    y0 = int(base_y - height * 1.3) - 2
    for y in range(y0, base_y + 1):
        for x in range(x0, x1 + 1):
            best = None
            for (ccx, ccy, r) in circles:
                dx, dy = x + 0.5 - ccx, y + 0.5 - ccy
                d = math.hypot(dx, dy)
                if d <= r and (best is None or (r - d) / r > best[0]):
                    best = ((r - d) / r, dx / r, dy / r)
            if best is None:
                continue
            _, nx, ny = best
            light = -0.62 * nx - 0.78 * ny
            fromb = base_y - y
            if fromb <= 1:
                lvl = 0 if fromb == 0 else 1
            elif light > 0.42:
                lvl = 3
            elif light > -0.12:
                lvl = 2
            elif light > -0.5 or fromb > 5:
                lvl = 1
            else:
                lvl = 0
            # weiche Übergänge mit Bayer zwischen 2 und 3
            if lvl == 2 and light > 0.28 and bayer(x, y, 0.5):
                lvl = 3
            img.set(x, y, ramp[lvl])


def sky(tod: str) -> Img:
    spec = SKY[tod]
    img = Img(W, SKY_H, pal(), wrap=True)
    stops = [hx(c) for c in spec["stops"]]
    img.vgrad(0, W - 1, 0, SKY_H - 1, stops)
    rng = random.Random(77)
    if tod == "nacht":
        for _ in range(150):
            x, y = rng.randrange(W), rng.randrange(2, 86)
            c = hx(rng.choice(["#F2EFE2", "#D3D3D0", "#B4B8BE", "#FFE066"]))
            img.set(x, y, c)
        for _ in range(9):
            x, y = rng.randrange(W), rng.randrange(6, 60)
            c = hx("#F2EFE2")
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                img.set(x + dx, y + dy, c if (dx, dy) == (0, 0) else hx("#B4B8BE"))
    ramp = [hx(c) for c in spec["cloud"]]
    for (cx, by, w, h, s) in CLOUDS:
        if tod == "nacht" and s % 2 == 0:
            continue
        cumulus(img, cx, by, w, h, ramp, s)
    if tod in ("abend", "morgen"):
        # lange, dünne Schleierwolken am Horizont
        for (x0, y, ln) in ((40, 92, 120), (380, 98, 160), (700, 88, 110)):
            for x in range(x0, x0 + ln):
                if pnoise1(x / 9, 107, 5) > 0.35:
                    img.set(x, y, ramp[2])
                    if pnoise1(x / 5, 192, 9) > 0.6:
                        img.set(x, y - 1, ramp[3])
    return img


# =========================================================================== Ferne

FAR_Y, FAR_H = 46, 68   # Weltposition und Höhe (Unterkante = y 113)


def far() -> Img:
    img = Img(W, FAR_H, pal(), wrap=True)
    H = FAR_H
    # 1) Hügelkette (Luftperspektive, blau)
    hill_c, hill_l = hx("#569ACF"), hx("#71B7E1")
    for x in range(W):
        top = int(18 + 16 * fbm1(x, W, 4, 11, 3))
        for y in range(top, H):
            img.set(x, y, hill_c)
        if fbm1(x + 1, W, 4, 11, 3) * 16 + 18 > top - 0.5:
            img.set(x, top, hill_l)
    # 2) Mischwald (Laubkronen + Fichten), entsättigt
    lit, body, shade, dark = hx("#5B9182"), hx("#3E786E"), hx("#426256"), hx("#2A4B42")
    rng = random.Random(21)
    clearing = (262, 316)
    church_x = 700
    trees = []
    x = 0
    while x < W:
        if clearing[0] < x < clearing[1]:
            x += 3
            continue
        kind = "fichte" if rng.random() < 0.38 else "laub"
        h = rng.randint(12, 22) + int(8 * pnoise1(x / 60, 16, 3))
        trees.append((x, kind, h))
        x += rng.randint(5, 9)
    base_y = H - 9
    for (tx, kind, h) in trees:
        top = base_y - h
        if kind == "laub":
            r = rng.uniform(4.5, 7.5)
            cy = top + r
            for (ox, oy, rr) in ((0, 0, r), (-r * 0.6, r * 0.5, r * 0.8), (r * 0.6, r * 0.45, r * 0.85)):
                for (px, py) in img.disc_pixels(tx + ox, cy + oy, rr, rr * 0.9):
                    nx = (px + 0.5 - tx - ox) / rr
                    ny = (py + 0.5 - cy - oy) / rr
                    lv = -0.6 * nx - 0.8 * ny
                    c = lit if lv > 0.35 else (body if lv > -0.35 else shade)
                    img.set(px, py, c)
            for y in range(int(cy + r), base_y + 2):
                img.set(tx, y, dark)
        else:
            tiers = max(3, h // 4)
            for i in range(h):
                y = top + i
                half = int(1 + (i % (h // tiers + 1)) * 0.7 + i * 0.18)
                for dx in range(-half, half + 1):
                    c = lit if dx < 0 and dx >= -half + 1 and i % 4 < 2 else (shade if dx > half // 2 else body)
                    img.set(tx + dx, y, c)
            img.set(tx, top - 1, body)
    # Waldboden-Band
    for x in range(W):
        for y in range(base_y - 2, H):
            if img.get(x, y)[3] == 0 or y >= base_y:
                img.set(x, y, shade if y < base_y + 3 else dark)
    # Lichtung mit Grillhütte
    for x in range(clearing[0] - 4, clearing[1] + 4):
        for y in range(base_y - 2, base_y + 3):
            img.set(x, y, hx("#5C7B6A") if bayer(x, y, 0.5) else hx("#5B9182"))
    _grill_hut(img, 288, base_y)
    _church(img, church_x, base_y)
    return img


def _grill_hut(img: Img, x, base):
    wall, wall_d, roof, roof_l = hx("#A0754B"), hx("#8A5A33"), hx("#763E16"), hx("#8A5A33")
    # Hütte 15×8, Satteldach
    for y in range(base - 7, base + 1):
        for dx in range(-7, 8):
            img.set(x + dx, y, wall if dx < 3 else wall_d)
    for i in range(6):
        y = base - 8 - i
        for dx in range(-9 + i, 10 - i):
            img.set(x + dx, y, roof_l if dx < 0 else roof)
    img.rect(x - 2, base - 5, x, base, hx("#4F2F1C"))          # Tür
    img.rect(x + 4, base - 5, x + 5, base - 4, hx("#F0BE2C"))  # Fenster (warmes Licht)
    img.vline(x + 6, base - 16, base - 10, hx("#596375"))      # Kamin
    img.set(x + 7, base - 16, hx("#596375"))
    smoke = [hx("#D3D3D0"), hx("#F2EFE2"), hx("#B4B8BE")]
    for i, (sx, sy, r) in enumerate(((7, -19, 1.6), (9, -23, 2.1), (12, -28, 2.5), (15, -33, 2.2))):
        for (px, py) in img.disc_pixels(x + sx, base + sy, r, r):
            img.set(px, py, smoke[1] if (px - x - sx) + (py - base - sy) < 0 else smoke[2])
    # Bank und Tisch
    img.hline(x + 11, x + 16, base - 2, hx("#8A5A33"))
    img.set(x + 12, base - 1, hx("#763E16"))
    img.set(x + 15, base - 1, hx("#763E16"))


def _church(img: Img, x, base):
    stone_l, stone, stone_d = hx("#A4B1BC"), hx("#8D96A0"), hx("#737C8A")
    roof_l, roof, roof_d = hx("#D988AF"), hx("#BE6C9F"), hx("#A15090")
    cu_l, cu, cu_d = hx("#5B9182"), hx("#3E786E"), hx("#1E5F5B")
    # Kirchenschiff rechts vom Turm
    for y in range(base - 12, base + 1):
        for dx in range(5, 26):
            img.set(x + dx, y, stone if dx < 20 else stone_d)
    for i in range(7):
        y = base - 13 - i
        for dx in range(4 + i, 27 - i):
            img.set(x + dx, y, roof_l if i > 4 else (roof if dx < 20 else roof_d))
    for wx in (9, 14, 19):
        img.vline(x + wx, base - 9, base - 6, hx("#596375"))
    # Turm
    top = base - 42
    for y in range(top, base + 1):
        for dx in range(-4, 5):
            c = stone_l if dx < -1 else (stone if dx < 3 else stone_d)
            img.set(x + dx, y, c)
    img.hline(x - 4, x + 4, top, stone_d)
    # Uhr und Schallluken
    for (dx, dy) in ((-1, 0), (0, 0), (1, 0), (0, -1), (0, 1)):
        img.set(x + dx, top + 6 + dy, hx("#F2EFE2"))
    img.set(x, top + 6, hx("#596375"))
    img.set(x + 1, top + 5, hx("#596375"))
    img.vline(x - 1, top + 12, top + 15, hx("#596375"))
    img.vline(x + 1, top + 12, top + 15, hx("#596375"))
    img.vline(x - 1, base - 4, base, hx("#4F2F1C"))
    img.vline(x, base - 5, base, hx("#4F2F1C"))
    # Helm (Kupfer-Patina) – Zwiebel + Spitze
    for i in range(14):
        y = top - 1 - i
        half = [5, 5, 4, 3, 3, 4, 4, 3, 2, 1, 1, 1, 0, 0][i]
        for dx in range(-half, half + 1):
            c = cu_l if dx < 0 else (cu if dx < 2 else cu_d)
            img.set(x + dx, y, c)
    img.vline(x, top - 19, top - 15, hx("#C1820C"))
    img.hline(x - 1, x + 1, top - 18, hx("#C1820C"))
    # Dorfhäuser
    for (hx0, w, h) in ((-22, 12, 7), (-36, 10, 6), (30, 11, 7), (43, 9, 5)):
        for y in range(base - h, base + 1):
            for dx in range(w):
                img.set(x + hx0 + dx, y, hx("#D3D3D0") if dx < w - 3 else hx("#B4B8BE"))
        for i in range(4):
            for dx in range(-1 + i, w + 1 - i):
                img.set(x + hx0 + dx, base - h - 1 - i, roof if dx < w // 2 + 1 else roof_d)
        img.set(x + hx0 + 3, base - h + 2, hx("#596375"))
        img.set(x + hx0 + w - 4, base - h + 2, hx("#596375"))


# =========================================================================== Mitte (gegenüberliegendes Ufer)

MID_Y, MID_H = 76, 38   # Unterkante y = 113


def mid() -> Img:
    img = Img(W, MID_H, pal(), wrap=True)
    H = MID_H
    rng = random.Random(33)
    g0, g1, g2, g3 = (R("Schilfgruen", i) for i in range(4))
    t0, t1 = R("Tiefgruen", 0), R("Tiefgruen", 1)
    bank_top = H - 6
    # Uferböschung
    for x in range(W):
        top = bank_top + int(2.5 * pnoise1(x / 24, 40, 8))
        for y in range(top, H):
            c = g1 if y == top else (t1 if y < H - 2 else t0)
            if y == top + 1 and bayer(x, y, 0.5):
                c = g1
            img.set(x, y, c)
    # Büsche/Erlen
    beach = (396, 470)
    for i in range(46):
        bx = rng.randrange(W)
        if beach[0] - 8 < bx < beach[1] + 8 or 130 < bx < 176:
            continue
        r = rng.uniform(3.5, 7.5)
        by = bank_top - r * 0.6
        for (px, py) in img.disc_pixels(bx, by, r * 1.2, r):
            nx, ny = (px + .5 - bx) / (r * 1.2), (py + .5 - by) / r
            lv = -0.6 * nx - 0.8 * ny
            img.set(px, py, g2 if lv > 0.3 else (g1 if lv > -0.4 else g0))
        for k in range(int(r)):
            px, py = bx + rng.randint(-int(r), int(r)), by + rng.randint(-int(r * .6), int(r * .2))
            if img.get(px, py) in (g2,):
                img.set(px, py, g3)
    _willow(img, 152, bank_top)
    _beach(img, beach, bank_top)
    _diving_tower(img, 560, bank_top)
    # Schilfgürtel (vorne)
    for x in range(W):
        if beach[0] - 4 < x < beach[1] + 4:
            continue
        dens = pnoise1(x / 14, 69, 44)
        if dens < 0.42:
            continue
        if rng.random() < 0.55:
            h = int(5 + 10 * dens + rng.randint(0, 3))
            top = bank_top + 2 - h
            lean = rng.choice((-1, 0, 0, 1))
            for i in range(h):
                y = bank_top + 2 - i
                xx = x + (lean if i > h * 0.6 else 0)
                c = g3 if i == h - 1 else (g2 if (x % 3 == 0) else g1)
                img.set(xx, y, c)
            if rng.random() < 0.18:  # Rohrkolben
                img.vline(x + lean, top - 1, top + 2, hx("#763E16"))
                img.set(x + lean, top - 1, hx("#8A5A33"))
                img.set(x + lean, top - 2, g2)
    return img


def _willow(img: Img, x, base):
    trunk, trunk_d = hx("#8A5A33"), hx("#763E16")
    for y in range(base - 14, base + 1):
        img.set(x, y, trunk)
        img.set(x + 1, y, trunk_d)
    img.line(x, base - 12, x - 6, base - 20, trunk)
    img.line(x + 1, base - 13, x + 7, base - 21, trunk_d)
    g = [R("Schilfgruen", i) for i in range(4)]
    cx, cy = x, base - 22
    for (px, py) in img.disc_pixels(cx, cy, 17, 9):
        nx, ny = (px + .5 - cx) / 17, (py + .5 - cy) / 9
        lv = -0.6 * nx - 0.8 * ny
        img.set(px, py, g[2] if lv > 0.3 else (g[1] if lv > -0.3 else g[0]))
    # hängende Zweige
    for dx in range(-18, 19):
        if dx % 2:
            continue
        ln = int(10 + 6 * pnoise1((dx + 40) / 3, 30, 4))
        y0 = cy + int(4 * math.sqrt(max(0, 1 - (dx / 18) ** 2)))
        for i in range(ln):
            c = g[1] if dx > 4 else (g[2] if i < 3 else g[1])
            if i == ln - 1:
                c = g[0]
            img.set(cx + dx, y0 + i, c)
        img.set(cx + dx, y0, g[3] if dx < 0 else g[2])


def _beach(img: Img, rng_x, base):
    s = [R("Sand", i) for i in range(4)]
    for x in range(rng_x[0], rng_x[1]):
        edge = min(x - rng_x[0], rng_x[1] - x)
        top = base - min(3, edge // 4) + 1
        for y in range(top, base + 6):
            c = s[3] if y == top else (s[2] if y < base + 3 else s[1])
            img.set(x, y, c)
    # Sonnenschirm
    ux = rng_x[0] + 22
    img.vline(ux, base - 12, base, hx("#B4B8BE"))
    for i in range(4):
        for dx in range(-8 + i * 2, 9 - i * 2):
            stripe = ((dx + 8) // 3) % 2 == 0
            img.set(ux + dx, base - 12 - i, R("Signalrot", 1 if i < 2 else 2) if stripe else R("Wolke", 3 if i else 2))
    # Handtücher, Rettungsring-Ständer
    img.hline(ux + 6, ux + 12, base + 1, R("Seerosenrosa", 2))
    img.hline(ux + 15, ux + 20, base + 2, R("Himmelblau", 1))
    rx = rng_x[1] - 14
    img.vline(rx, base - 10, base, hx("#8A5A33"))
    for (dx, dy) in ((-2, -8), (-1, -9), (0, -9), (1, -9), (2, -8), (2, -7), (2, -6), (1, -5), (0, -5),
                     (-1, -5), (-2, -6), (-2, -7)):
        img.set(rx + dx, base + dy, R("Signalrot", 1) if (dx + dy) % 3 else R("Wolke", 3))


def _diving_tower(img: Img, x, base):
    wood, wood_d, wood_l = hx("#A0754B"), hx("#763E16"), hx("#B69264")
    for lx in (x, x + 10):
        img.vline(lx, base - 18, base + 3, wood_d)
    img.hline(x - 1, x + 11, base - 18, wood_l)
    img.hline(x - 1, x + 11, base - 17, wood)
    img.hline(x - 1, x + 16, base - 9, wood_l)    # untere Plattform mit Brett
    img.hline(x - 1, x + 16, base - 8, wood)
    for y in range(base - 17, base, 3):
        img.hline(x + 1, x + 9, y, wood_d)
    img.line(x + 11, base - 18, x + 13, base - 23, wood_d)  # Geländer
    img.line(x - 1, base - 18, x - 1, base - 22, wood_d)
    img.hline(x - 1, x + 12, base - 22, wood)


# =========================================================================== Wasseroberfläche (4 Frames)

SURF_Y, SURF_H = 114, 10    # Zeilen 114..119 ferne Wasserfläche, 120 Wasserlinie, 121..123 unter der Haut
GLINTS = None


def _glints():
    global GLINTS
    if GLINTS is None:
        rng = random.Random(91)
        GLINTS = []
        for _ in range(120):
            GLINTS.append((rng.randrange(W), rng.randrange(0, SURF_H), rng.randint(2, 7), rng.randrange(4)))
    return GLINTS


def surface(frame: int) -> Img:
    img = Img(W, SURF_H, pal(), wrap=True)
    far_d, far_m, far_l = hx("#3E786E"), hx("#67C2B6"), hx("#8FD3F4")
    for y in range(SURF_H):
        wy = SURF_Y + y
        for x in range(W):
            if wy <= 115:       # Spiegelung des Ufers
                c = far_d if (wy == 114 or bayer(x, y, 0.5)) else far_m
            elif wy < 120:
                c = far_m if bayer(x + frame * 2, y, 0.25 + 0.15 * (wy - 116)) else far_l
                c = far_l if wy == 119 else c
            elif wy == 120:
                c = hx("#8FD3F4")
            else:
                c = hx("#67C2B6")
            img.set(x, y, c)
    # Glanzlinien: Phase p, Länge wächst/schrumpft über 4 Frames (nahtlose Schleife)
    for (gx, gy, ln, ph) in _glints():
        wy = SURF_Y + gy
        k = (frame + ph) % 4
        cur = [ln, ln - 2, 0, ln - 2][k]
        if cur <= 0:
            continue
        drift = [0, 1, 1, 0][k]
        if wy < 116:
            col = hx("#67C2B6")
        elif wy <= 120:
            col = hx("#F2EFE2")
        else:
            col = hx("#8FD3F4")
        for i in range(cur):
            img.set(gx + drift + i, gy, col)
    return img


# =========================================================================== Wasserkörper

WATER_STOPS = [  # (Welt-y, Farbe)
    (120, "#67C2B6"), (176, "#3FA7A3"), (240, "#138C90"), (300, "#1A6F78"), (380, "#1E5F5B"),
    (470, "#084647"), (560, "#12342F"), (640, "#12342F"),
]


def water_color(x, wy):
    for (ya, ca), (yb, cb) in zip(WATER_STOPS, WATER_STOPS[1:]):
        if ya <= wy <= yb:
            f = (wy - ya) / max(1, yb - ya)
            return hx(cb) if bayer(x, wy, f) else hx(ca)
    return hx(WATER_STOPS[-1][1])


def water_back() -> Img:
    H = L.WORLD_H - L.SURFACE_Y
    img = Img(W, H, pal(), wrap=True)
    for y in range(H):
        wy = y + L.SURFACE_Y
        for x in range(W):
            img.set(x, y, water_color(x, wy))
    # ferne Kraut-Silhouetten (eine Stufe heller/dunkler als das Wasser)
    rng = random.Random(55)
    spots = [z for z in L.KRAUT_ZONES]
    for i in range(80):
        za, zb = spots[i % len(spots)]
        x = rng.randint(za - 50, zb + 50)
        base = L.floor_y(x) - L.SURFACE_Y + 2 if za <= x <= zb else L.y_of(15.2) - L.SURFACE_Y
        h = rng.randint(24, 70)
        ph = rng.random() * 6
        for k in range(h):
            y = base - k
            dx = int(round(2 * math.sin(k / 9 + ph)))
            c = water_color(x, y + L.SURFACE_Y)
            sil = pal().step(c, -1)
            img.set(x + dx, y, sil)
            if k % 3 == 0 and k > 4:
                img.set(x + dx - 1, y, sil)
                img.set(x + dx + 1, y - 1, sil)
    # Kaustik-Netz unter der Oberfläche (0–2 m), wird nach unten seltener
    for y in range(2, 44):
        for x in range(W):
            v = math.sin(2 * math.pi * x / 48 + 2.2 * math.sin(2 * math.pi * y / 22 + 2 * math.pi * x / 320)) \
                + math.sin(2 * math.pi * (x + y * 0.7) / 80) * 0.6
            if abs(v) < 0.09 and bayer(x, y, 1.0 - y / 44):
                img.set(x, y, pal().step(water_color(x, y + L.SURFACE_Y), 1)
                        if y > 6 else hx("#8FD3F4"))
    # Schwebeteilchen
    for i in range(520):
        x = rng.randrange(W)
        y = rng.randrange(30, H - 20)
        c = water_color(x, y + L.SURFACE_Y)
        img.set(x, y, pal().step(c, 1))
    return img


# =========================================================================== Godrays (transparent)

GOD_H = 230
BEAMS = [(20, 14), (96, 9), (170, 20), (300, 12), (380, 24), (520, 10), (590, 18), (720, 13), (800, 22), (900, 9)]


def godrays() -> Img:
    img = Img(W, GOD_H, pal(), wrap=True)
    slant = 0.42
    for (bx, bw) in BEAMS:
        for y in range(2, GOD_H):
            fade = 1.0 - y / GOD_H
            x0 = bx + y * slant
            for i in range(bw):
                edge = min(i + 1, bw - i) / (bw / 2)
                dens = min(0.5, 0.55 * fade * min(1.0, edge * 1.4))
                x = int(x0 + i)
                if bayer(x, y, dens):
                    wy = y + L.SURFACE_Y
                    c = water_color(x, wy)
                    img.set(x, y, pal().step(c, 1) if wy > 176 else hx("#8FD3F4"))
    return img


# =========================================================================== Bootshaus + Steg (fest platziert)

STEG_Y = 20          # Weltposition der Bildoberkante; Bild 232×100 → bis y 119


def _planks_v(img: Img, x0, x1, y0, y1, cols, w=4):
    """Senkrechte Bretter: links Licht, rechts Schatten, Fuge dunkel."""
    for x in range(x0, x1 + 1):
        k = (x - x0) % w
        c = cols[3] if k == 0 else (cols[2] if k < w - 1 else cols[1])
        if k == w - 1 and (x - x0) // w % 3 == 1:
            c = cols[0]
        for y in range(y0, y1 + 1):
            img.set(x, y, c)


def steg() -> Img:
    img = Img(232, 100, pal())
    oy = STEG_Y
    wood = [R("Stegholz", i) for i in range(4)]
    dark = [R("Dunkelholz", i) for i in range(3)]
    red = [R("Signalrot", i) for i in range(4)]
    cream = [R("Wolke", i) for i in range(4)]
    deck_y = L.STEG_DECK_Y - oy
    # --- Pfähle über Wasser + Kreuzstreben
    for px in L.PILES:
        for y in range(deck_y + 3, L.SURFACE_Y - oy):
            img.set(px, y, wood[2])
            img.set(px + 1, y, wood[1])
            img.set(px + 2, y, wood[1])
            img.set(px + 3, y, dark[1])
        img.set(px + 1, L.SURFACE_Y - oy - 1, R("Seetuerkis", 3))   # nasser Rand
    for a, b in zip(L.PILES, L.PILES[1:]):
        if b - a > 30:
            continue
        img.line(a + 4, deck_y + 5, b - 1, deck_y + 13, dark[1])
        img.line(a + 4, deck_y + 13, b - 1, deck_y + 5, dark[0])
    # --- Steg-Deck (Seitenbalken)
    x0, x1 = 2, L.STEG_X1
    img.hline(x0, x1, deck_y, wood[3])
    img.hline(x0, x1, deck_y + 1, wood[2])
    img.hline(x0, x1, deck_y + 2, wood[1])
    img.hline(x0, x1, deck_y + 3, dark[1])
    for x in range(x0 + 5, x1, 13):
        img.set(x, deck_y + 2, R("Stein", 2))
    for x in range(x0, x1, 9):
        img.set(x, deck_y, wood[2])
    # --- Bootshaus (Giebelseite zum Betrachter)
    hx0, hx1, wall_top = 12, 86, 66 - oy
    wall_bot = deck_y - 1
    _planks_v(img, hx0, hx1, wall_top, wall_bot, wood)
    for x in range(hx0, hx1 + 1):            # Schatten unter der Traufe
        img.set(x, wall_top, dark[1])
        img.set(x, wall_top + 1, wood[0] if x % 4 else dark[1])
    img.vline(hx1, wall_top, wall_bot, wood[0])
    img.vline(hx1 - 1, wall_top, wall_bot, wood[0])
    # Giebeldreieck mit waagerechten Brettern
    apex_x, apex_y = 49, 36 - oy
    for y in range(apex_y, wall_top):
        t = (y - apex_y) / (wall_top - apex_y)
        half = int(t * (hx1 - hx0) / 2)
        for x in range(apex_x - half, apex_x + half + 1):
            row = (y - apex_y) % 3
            c = wood[3] if row == 0 else (wood[2] if x < apex_x + half - 2 else wood[1])
            img.set(x, y, c)
    # Rundfenster im Giebel
    cx, cy = apex_x, apex_y + 17
    for (px, py) in img.disc_pixels(cx + .5, cy + .5, 4.6, 4.6):
        img.set(px, py, cream[2])
    for (px, py) in img.disc_pixels(cx + .5, cy + .5, 3.4, 3.4):
        img.set(px, py, R("Nachtblau", 2))
    img.set(cx - 1, cy - 1, R("Himmelblau", 2))
    img.set(cx - 2, cy, R("Himmelblau", 1))
    img.hline(cx - 3, cx + 3, cy, cream[1])
    img.vline(cx, cy - 3, cy + 3, cream[1])
    # Dach: zwei Ziegelbänder (links hell = Licht, rechts dunkel)
    th = 6
    for side in (-1, 1):
        for i in range(0, 48):
            x = apex_x + side * i
            yb = apex_y - 4 + int(i * 0.72)
            for k in range(th):
                y = yb + k
                tile_row = (k + (i // 4)) % 3
                if side < 0:
                    c = red[3] if k == 0 else (red[2] if tile_row else red[1])
                else:
                    c = red[2] if k == 0 else (red[1] if tile_row else red[0])
                if (i % 4 == 0) and k > 0:
                    c = red[0] if side > 0 else red[1]
                img.set(x, y, c)
            img.set(x, yb + th, dark[0])           # Traufschatten
    for k in range(3):                              # First
        img.hline(apex_x - 1, apex_x + 1, apex_y - 5 + k, red[0] if k == 2 else red[2])
    # Wetterfahne (Fisch)
    img.vline(apex_x, apex_y - 14, apex_y - 6, dark[1])
    fish = [(-3, 0), (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (-2, -1), (-1, -1), (0, -1), (1, -1),
            (-1, 1), (0, 1), (1, 1), (3, -1), (3, 1), (4, -2), (4, 2), (4, 0)]
    for (dx, dy) in fish:
        img.set(apex_x + dx, apex_y - 15 + dy, R("Sonnengelb", 1 if dy >= 0 else 2))
    img.set(apex_x - 2, apex_y - 15, R("Dunkelholz", 0))
    # Tor (Bootstor) mit Z-Strebe
    dx0, dx1, dy0 = 20, 44, 76 - oy
    for x in range(dx0, dx1 + 1):
        k = (x - dx0) % 4
        for y in range(dy0, wall_bot + 1):
            img.set(x, y, wood[1] if k else wood[0])
    img.hline(dx0, dx1, dy0, wood[3])
    img.vline(dx0, dy0, wall_bot, wood[3])
    img.vline((dx0 + dx1) // 2, dy0, wall_bot, dark[1])
    for half in ((dx0 + 1, (dx0 + dx1) // 2 - 1), ((dx0 + dx1) // 2 + 1, dx1 - 1)):
        img.hline(half[0], half[1], dy0 + 4, wood[2])
        img.hline(half[0], half[1], wall_bot - 3, wood[2])
        img.line(half[0], wall_bot - 3, half[1], dy0 + 4, wood[2])
    img.set((dx0 + dx1) // 2 - 2, dy0 + 13, R("Stein", 3))
    img.set((dx0 + dx1) // 2 + 2, dy0 + 13, R("Stein", 3))
    # Schild über dem Tor (Fischsymbol statt Text)
    img.rect(dx0 + 3, dy0 - 7, dx1 - 3, dy0 - 3, wood[3])
    img.hline(dx0 + 3, dx1 - 3, dy0 - 3, wood[1])
    for (fx, fy_) in ((0, 0), (1, 0), (2, 0), (3, 0), (1, -1), (2, -1), (1, 1), (2, 1), (4, -1), (4, 1)):
        img.set((dx0 + dx1) // 2 - 2 + fx, dy0 - 5 + fy_, R("Himmelblau", 0))
    # Fenster mit Blumenkasten
    wx0, wx1, wy0, wy1 = 56, 72, 77 - oy, 89 - oy
    img.rect(wx0, wy0, wx1, wy1, cream[3])
    img.rect(wx0 + 1, wy0 + 1, wx1 - 1, wy1 - 1, R("Nachtblau", 1))
    img.vline((wx0 + wx1) // 2, wy0, wy1, cream[2])
    img.hline(wx0, wx1, (wy0 + wy1) // 2, cream[2])
    img.set(wx0 + 2, wy0 + 2, R("Himmelblau", 2))
    img.set(wx0 + 3, wy0 + 2, R("Himmelblau", 1))
    img.set(wx0 + 2, wy0 + 3, R("Himmelblau", 1))
    img.set(wx1 - 3, (wy0 + wy1) // 2 + 2, R("Sonnengelb", 2))   # Lampe drinnen
    img.vline(wx1, wy0, wy1, cream[1])
    img.hline(wx0, wx1, wy1, cream[1])
    img.rect(wx0 - 1, wy1 + 1, wx1 + 1, wy1 + 4, wood[1])       # Kasten
    img.hline(wx0 - 1, wx1 + 1, wy1 + 1, wood[3])
    rng = random.Random(12)
    for x in range(wx0, wx1 + 1):
        h = rng.randint(1, 3)
        for k in range(h):
            img.set(x, wy1 - k, R("Schilfgruen", 2 if k == h - 1 else 1))
        if x % 3 == 0:
            img.set(x, wy1 - h, R("Seerosenrosa", 3 if x % 2 else 2))
            img.set(x + 1, wy1 - h - 1, R("Seerosenrosa", 2))
        elif x % 5 == 1:
            img.set(x, wy1 - h, R("Sonnengelb", 3))
    # Rettungsring links vom Tor
    rcx, rcy = 15.5, 86.5 - oy
    for (px, py) in img.disc_pixels(rcx, rcy, 4.6, 4.6):
        d = math.hypot(px + .5 - rcx, py + .5 - rcy)
        if d >= 2.2:
            ang = math.atan2(py + .5 - rcy, px + .5 - rcx)
            q = int(((ang + math.pi) / (math.pi / 2)) + 0.5) % 4
            c = red[1] if q % 2 else cream[3]
            if px + py > rcx + rcy + 2:
                c = red[0] if q % 2 else cream[1]
            img.set(px, py, c)
    img.set(int(rcx), int(rcy) - 5, dark[0])
    # Laterne rechts vom Tor
    img.hline(46, 49, 74 - oy, dark[0])
    img.vline(49, 74 - oy, 76 - oy, dark[0])
    img.rect(48, 77 - oy, 50, 80 - oy, R("Sonnengelb", 3))
    img.hline(48, 50, 76 - oy, dark[0])
    img.hline(48, 50, 81 - oy, dark[0])
    img.set(50, 79 - oy, R("Sonnengelb", 1))
    # Kletterrosen an der rechten Ecke
    for y in range(70 - oy, wall_bot):
        x = hx1 + 1 + int(1.5 * math.sin(y / 3.0))
        img.set(x, y, R("Schilfgruen", 1))
        if y % 3 == 0:
            img.set(x - 1, y, R("Schilfgruen", 2))
            img.set(x + 1, y + 1, R("Schilfgruen", 0))
        if y % 7 == 2:
            img.set(x, y - 1, R("Seerosenrosa", 3))
            img.set(x + 1, y - 1, R("Seerosenrosa", 2))
            img.set(x, y, R("Seerosenrosa", 1))
    # Ruder an der Wand gelehnt
    img.line(52, wall_bot, 55, 92 - oy, wood[3])
    img.line(53, wall_bot, 56, 92 - oy, wood[1])
    img.rect(55, 86 - oy, 57, 92 - oy, wood[2])
    img.vline(57, 86 - oy, 92 - oy, wood[0])
    # --- Sitzkisten an den Steg-Plätzen (Sitzfläche = Spielerplatz-y)
    for spot in L.PLAYER_SPOTS:
        if spot["typ"] != "steg":
            continue
        cx = spot["x"]
        top = spot["y"] - oy
        img.rect(cx - 6, top, cx + 6, deck_y - 1, wood[2])
        img.hline(cx - 6, cx + 6, top, wood[3])
        img.hline(cx - 6, cx + 6, top + 3, wood[0])
        img.vline(cx - 6, top, deck_y - 1, wood[3])
        img.vline(cx + 6, top, deck_y - 1, dark[1])
        img.set(cx - 4, top + 1, R("Stein", 2))
        img.set(cx + 4, top + 1, R("Stein", 2))
    # --- Requisiten auf dem Steg
    by = deck_y - 1
    # Eimer mit Fischschwanz
    bx = 148
    for y in range(by - 6, by + 1):
        w = 3 if y > by - 6 else 4
        for x in range(bx - w, bx + w + 1):
            img.set(x, y, R("Stein", 3) if x < bx - 1 else (R("Stein", 2) if x < bx + 2 else R("Stein", 1)))
    img.hline(bx - 4, bx + 4, by - 6, R("Stein", 0))
    img.line(bx - 4, by - 7, bx, by - 10, R("Stein", 0))
    img.line(bx, by - 10, bx + 4, by - 7, R("Stein", 0))
    for (dx, dy) in ((1, -7), (2, -8), (3, -9), (1, -9), (3, -7)):
        img.set(bx + dx, by + dy, R("Sonnengelb", 1))
    # Angelkiste
    kx = 191
    img.rect(kx, by - 5, kx + 8, by, red[1])
    img.hline(kx, kx + 8, by - 5, red[2])
    img.vline(kx, by - 5, by, red[2])
    img.hline(kx, kx + 8, by - 3, red[0])
    img.rect(kx + 3, by - 7, kx + 5, by - 6, R("Stein", 1))
    img.set(kx + 4, by - 3, R("Sonnengelb", 2))
    # Poller mit Tau am Stegende
    px = L.STEG_X1 - 4
    for y in range(deck_y - 9, deck_y):
        img.set(px, y, wood[3])
        img.set(px + 1, y, wood[2])
        img.set(px + 2, y, wood[1])
        img.set(px + 3, y, dark[1])
    img.hline(px, px + 3, deck_y - 10, wood[3])
    for (dx, dy) in ((-1, -5), (0, -6), (1, -6), (2, -6), (3, -6), (4, -5), (-1, -4), (4, -4), (0, -3), (3, -3)):
        img.set(px + dx, deck_y + dy, R("Sand", 2 if dy < -4 else 1))
    # Leiter am Stegende
    lx = L.STEG_X1 + 2
    for y in range(deck_y - 3, L.SURFACE_Y - oy):
        img.set(lx, y, R("Stein", 1))
        img.set(lx + 4, y, R("Stein", 0))
    for y in range(deck_y - 1, L.SURFACE_Y - oy, 4):
        img.hline(lx + 1, lx + 3, y, R("Stein", 2))
    return img


# =========================================================================== Vordergrund (Schilfhalme)

FG_Y, FG_H = 38, 116          # Welt-y 38..153 (Halme reichen unter die Oberfläche)
FG_CLUMPS = [(26, 18), (262, 12), (512, 22), (690, 14), (900, 26)]


def foreground() -> Img:
    img = Img(W, FG_H, pal(), wrap=True)
    rng = random.Random(71)
    surf = L.SURFACE_Y - FG_Y
    for (cx, width) in FG_CLUMPS:
        n = width // 2 + 3
        for i in range(n):
            x = cx - width // 2 + rng.randint(0, width)
            top = rng.randint(4, 46)
            bottom = FG_H - 1 - rng.randint(0, 10)
            lean = rng.uniform(-6, 6)
            blade = rng.random() < 0.35
            pts = []
            for y in range(top, bottom + 1):
                t = (bottom - y) / max(1, bottom - top)
                pts.append((round(x + lean * t * t), y))
            for (px, py) in pts:
                under = py >= surf
                if under:
                    c0, c1 = R("Tiefgruen", 0), R("Tiefgruen", 1)
                else:
                    c0, c1 = R("Schilfgruen", 0), R("Schilfgruen", 1 if py > top + 3 else 2)
                img.set(px, py, c1)
                img.set(px + 1, py, c0)
                if blade and not under and py > top + 2:
                    img.set(px - 1, py, R("Schilfgruen", 2) if py % 5 else R("Schilfgruen", 3))
            if rng.random() < 0.3 and top > 6:   # Rohrkolben
                hx_, hy_ = pts[0]
                img.rect(hx_ - 1, hy_ - 7, hx_ + 1, hy_ - 1, R("Dunkelholz", 1))
                img.vline(hx_ - 1, hy_ - 7, hy_ - 2, R("Stegholz", 1))
                img.vline(hx_ + 1, hy_ - 6, hy_ - 1, R("Dunkelholz", 0))
                img.vline(hx_, hy_ - 11, hy_ - 8, R("Schilfgruen", 1))
            # überhängendes Blatt
            if rng.random() < 0.5:
                bx, by = pts[min(len(pts) - 1, rng.randint(6, 20))]
                d = rng.choice((-1, 1))
                for k in range(rng.randint(6, 12)):
                    img.set(bx + d * k, by + (k * k) // 14, R("Schilfgruen", 2 if k < 3 else 1))
    return img


# =========================================================================== Nebel (Parallax-Schicht, Morgennebel)

FOG_Y, FOG_H = 92, 40


def fog() -> Img:
    img = Img(W, FOG_H, pal(), wrap=True)
    for y in range(FOG_H):
        for x in range(W):
            band = fbm1(x, W, 6, 300 + (y // 6), 2)
            core = 1.0 - abs(y - FOG_H * 0.55) / (FOG_H * 0.55)
            t = max(0.0, min(0.75, (band - 0.35) * 1.6 * core))
            if bayer(x, y, t):
                img.set(x, y, R("Wolke", 3) if y < FOG_H * 0.5 else R("Wolke", 2))
    return img

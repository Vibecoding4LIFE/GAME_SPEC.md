"""Deko-Sprites von Welt 1 (Atlas `atlas_world_see`) – Style Guide F1, Animationen aus dem Standbild (F5).

Jeder Eintrag: Sprite(key, frames, fps, loop, yoyo, anchors, eyes). Frame-Namen: `<key>_<n>`,
key = `see_<objekt>[_<variante>]_<clip>`; Standbilder haben den Clip `still`.
Anker (Pixel im Frame) landen als `anchors` in den Frame-Daten der Atlas-JSON (Phaser: frame.customData).
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from pixkit import Img, bayer, from_map, shift_rows, translated
from see_layers import R, hx, pal


@dataclass
class Sprite:
    key: str
    frames: list
    fps: int | None = None
    loop: bool = True
    yoyo: bool = False
    anchors: dict = field(default_factory=dict)
    eyes: int = 0
    note: str = ""


def S(w, h) -> Img:
    return Img(w, h, pal())


def shade3(lv, cols):
    """Licht oben links: lv > 0.35 hell, > -0.35 Grundton, sonst Schatten."""
    return cols[2] if lv > 0.35 else (cols[1] if lv > -0.35 else cols[0])


def lit_ellipse(img: Img, cx, cy, rx, ry, cols):
    for (px, py) in img.disc_pixels(cx, cy, rx, ry):
        nx, ny = (px + .5 - cx) / rx, (py + .5 - cy) / ry
        img.set(px, py, shade3(-0.6 * nx - 0.8 * ny, cols))


# --------------------------------------------------------------------------- Seerosen

def lily_pad(var):
    w = {"a": 17, "b": 13, "c": 21}[var]
    img = S(w + 2, 7)
    g = [R("Schilfgruen", i) for i in range(4)]
    cx, cy, rx, ry = (w + 2) / 2, 3.6, w / 2, 2.4
    for (px, py) in img.disc_pixels(cx, cy, rx, ry):
        ny = (py + .5 - cy) / ry
        nx = (px + .5 - cx) / rx
        c = g[2] if ny < -0.2 else (g[1] if ny < 0.5 else g[0])
        if ny < -0.2 and nx < -0.2:
            c = g[3]
        img.set(px, py, c)
    # Kerbe (V-Schnitt) leicht rechts der Mitte
    nxp = int(cx + rx * 0.25)
    img.set(nxp, int(cy - ry) + 1, (0, 0, 0, 0))
    img.set(nxp, int(cy - ry) + 2, g[0])
    # Blattadern
    for k in range(2, int(rx) - 1, 3):
        img.set(int(cx) - k, int(cy) - 1, g[2])
        img.set(int(cx) + k, int(cy) - 1, g[1])
    img.outline()
    return img


FLOWER = [
    "......o......",
    ".....olo.....",
    "..o..lmd..o..",
    ".olo.lyd.omo.",
    ".olmolyymomd.",
    "oolmmyyYmmddo",
    "olmlmmlmmmdmo",
    ".oollmmmmddo.",
    "...ggGGGGg...",
]


def lily_flower():
    lg = {"o": R("Seerosenrosa", 0), "d": R("Seerosenrosa", 1), "m": R("Seerosenrosa", 2),
          "l": R("Seerosenrosa", 3), "y": R("Sonnengelb", 3), "Y": R("Sonnengelb", 2),
          "g": R("Schilfgruen", 1), "G": R("Schilfgruen", 0)}
    return from_map(FLOWER, lg, pal())


# --------------------------------------------------------------------------- Schilf

def reed_clump():
    img = S(16, 40)
    g = [R("Schilfgruen", i) for i in range(4)]
    stalks = [(2, 12, 1), (5, 3, 0), (8, 9, -1), (10, 1, 0), (13, 15, 1)]
    for (x, top, lean) in stalks:
        for y in range(top, 40):
            t = (40 - y) / (40 - top)
            xx = x + round(lean * t * t * 2)
            img.set(xx, y, g[2] if (y < top + 3 or (y + x) % 9 == 0) else g[1])
            img.set(xx + 1, y, g[0])
        img.set(x + round(lean * 2), top - 1, g[3])
    for (x, top) in ((5, 3), (10, 1)):          # Rohrkolben
        img.rect(x - 1, top + 3, x + 1, top + 9, R("Dunkelholz", 1))
        img.vline(x - 1, top + 3, top + 8, R("Stegholz", 1))
        img.vline(x + 1, top + 4, top + 9, R("Dunkelholz", 0))
    for (x, y0, d, ln) in ((8, 20, 1, 7), (2, 24, -1, 4), (13, 26, 1, 4), (5, 28, -1, 5)):  # Blätter
        for k in range(ln):
            img.set(x + d * k, y0 + (k * k) // 6, g[2] if k < 2 else g[1])
    return img


def sway_frames(base: Img, amps=(-1, 0, 1)):
    out = []
    h = base.h
    for a in amps:
        out.append(shift_rows(base, lambda y, a=a: a * ((h - y) / h) ** 2 * 2))
    return out


def elodea_clump():
    img = S(14, 50)
    cols = [R("Tiefgruen", 1), R("Schilfgruen", 1), R("Schilfgruen", 2), R("Schilfgruen", 3)]
    for (x, top, ph) in ((4, 6, 0.0), (8, 0, 1.3), (11, 12, 2.4), (6, 18, 3.1)):
        for k in range(50 - top):
            y = 49 - k
            dx = round(1.2 * math.sin(k / 8 + ph) * (k / 50))
            img.set(x + dx, y, cols[0])
            if k % 3 == 0 and k > 2:
                img.set(x + dx - 1, y, cols[2] if k % 6 == 0 else cols[1])
                img.set(x + dx - 2, y - 1, cols[1])
                img.set(x + dx + 1, y, cols[1])
                img.set(x + dx + 2, y - 1, cols[0])
        img.set(x + round(1.2 * math.sin((49 - top) / 8 + ph)), top, cols[3])
    return img


def wave_frames(base: Img, n=4, amp=1.5):
    out = []
    h = base.h
    for f in range(n):
        ph = 2 * math.pi * f / n
        out.append(shift_rows(base, lambda y, ph=ph: amp * math.sin(ph + y / 9) * ((h - y) / h)))
    return out


# --------------------------------------------------------------------------- Tiere

def dragonfly(frame):
    img = S(15, 8)
    body = [R("Himmelblau", 0), R("Himmelblau", 1), R("Himmelblau", 2)]
    for x in range(1, 10):
        img.set(x, 5, body[1] if x % 2 else body[0])
    img.set(0, 5, body[0])
    img.rect(10, 4, 11, 5, R("Seetuerkis", 2))
    img.set(10, 4, R("Seetuerkis", 3))
    img.rect(12, 4, 13, 5, R("Seetuerkis", 1))
    img.set(13, 4, R("Nachtblau", 0))
    wing, wing_e = R("Wolke", 3), R("Himmelblau", 3)
    if frame == 0:     # Flügel oben
        img.line(9, 3, 5, 0, wing)
        img.line(10, 3, 8, 0, wing_e)
        img.line(8, 3, 4, 1, wing_e)
        img.line(11, 3, 13, 0, wing)
    else:              # Flügel unten/ausgestreckt
        img.line(9, 6, 4, 7, wing)
        img.line(10, 6, 7, 7, wing_e)
        img.line(11, 3, 14, 2, wing)
        img.line(10, 3, 6, 2, wing_e)
    return img


def duck_swim(frame):
    """Stockente (Erpel), schwimmend. Wasserlinie = Zeile 11; darunter paddelnde Füße."""
    img = S(20, 16)
    grey = [R("Stein", 1), R("Stein", 2), R("Stein", 3)]
    wl = 11
    # Körper (Bootsform)
    for y in range(5, wl + 1):
        for x in range(2, 17):
            t = (y - 5) / 6
            left = 2 + int(3 * (1 - t) ** 2)
            right = 16 - int(4 * (1 - t))
            if left <= x <= right:
                lv = -0.5 * (x - 9) / 8 - 0.9 * (y - 8) / 4
                img.set(x, y, shade3(lv, grey))
    # Brust braun
    for y in range(6, wl):
        for x in range(13, 17):
            if img.opaque(x, y):
                img.set(x, y, R("Stegholz", 2 if y < 8 else 1))
    # Schwanz (schwarz-weiß mit Locke)
    img.set(1, 6, R("Nachtblau", 0))
    img.set(2, 5, R("Nachtblau", 0))
    img.set(3, 5, R("Nachtblau", 1))
    img.set(2, 4, R("Nachtblau", 1))
    img.set(1, 7, R("Wolke", 2))
    img.set(2, 7, R("Wolke", 3))
    # Flügel mit Spiegel
    img.hline(5, 11, 7, R("Stein", 0))
    img.hline(6, 9, 8, R("Himmelblau", 0))
    img.set(10, 8, R("Wolke", 3))
    # Hals + Kopf grün
    g = [R("Schilfgruen", 0), R("Seetuerkis", 1), R("Seetuerkis", 2)]
    img.rect(14, 3, 15, 5, g[0])
    lit_ellipse(img, 15.5, 2.6, 2.6, 2.2, g)
    img.hline(14, 16, 5, R("Wolke", 3))        # weißer Halsring
    img.set(16, 2, R("Nachtblau", 0))          # Auge
    img.hline(18, 19, 3, R("Sonnengelb", 2))   # Schnabel
    img.set(18, 2, R("Sonnengelb", 3))
    img.outline()
    if frame == 1:                              # Wippen: Körper 1 px tiefer
        img = translated(img, 0, 1)
    # unter der Wasserlinie: Körper abschneiden, paddelnde Füße
    for y in range(wl + 1, 16):
        for x in range(20):
            img.set(x, y, (0, 0, 0, 0))
    feet = R("Abendglut", 2)
    if frame == 0:
        img.line(8, 12, 6, 14, feet)
        img.hline(5, 7, 15, feet)
        img.line(11, 12, 12, 14, feet)
        img.hline(11, 13, 14, feet)
    else:
        img.line(8, 12, 9, 14, feet)
        img.hline(8, 10, 14, feet)
        img.line(11, 12, 10, 14, feet)
        img.hline(9, 11, 15, feet)
    return img


DABBLE = [
    "...k............",
    "..kWk...........",
    "..WWw...........",
    "..zSSs..........",
    ".zsSSSsz........",
    ".zsSSSSsz.......",
    "zssSSSSssz......",
    "zsssSbbsssz.....",
    ".zsssbWsssz.....",
    ".zzsssssssz.....",
    "..zzzsssBBz.....",
    ".......BBBB.....",
    "........BBgg....",
    ".........gGGg...",
    ".........gGeg...",
    "..........gg....",
    "..........yy....",
    "...........y....",
    "................",
    "................",
]


def duck_dabble(frame):
    """Gründeln: Popo nach oben, Kopf unter Wasser. Wasserlinie = Zeile 10."""
    lg = {"k": R("Nachtblau", 0), "W": R("Wolke", 3), "w": R("Wolke", 2), "S": R("Stein", 3),
          "s": R("Stein", 2), "z": R("Stein", 1), "b": R("Himmelblau", 0), "B": R("Stegholz", 1),
          "g": R("Seetuerkis", 1), "G": R("Schilfgruen", 0), "e": R("Nachtblau", 0), "y": R("Sonnengelb", 2)}
    img = from_map(DABBLE, lg, pal())
    feet = R("Abendglut", 2)
    if frame == 0:
        img.line(6, 3, 7, 1, feet)
        img.hline(7, 8, 0, feet)
        img.line(7, 4, 9, 2, feet)
        img.hline(9, 10, 1, feet)
    else:
        img.line(6, 3, 6, 1, feet)
        img.hline(5, 6, 0, feet)
        img.line(7, 4, 10, 3, feet)
        img.hline(10, 11, 2, feet)
    img.outline()
    img.set(13, 18 - frame, R("Himmelblau", 3))   # Blasen vom Gründeln
    img.set(11, 19, R("Himmelblau", 3))
    return img


def frog(kind):
    """Frosch auf Seerosenblatt, sitzend, Blick nach rechts. kind: idle | quak0 | quak1."""
    img = S(14, 11)
    g = [R("Schilfgruen", 0), R("Schilfgruen", 1), R("Schilfgruen", 2), R("Schilfgruen", 3)]
    # Körper
    for (px, py) in img.disc_pixels(6.5, 6.5, 5.2, 3.6):
        lv = -0.6 * (px - 6.5) / 5 - 0.8 * (py - 6.5) / 3.6
        img.set(px, py, g[2] if lv > 0.35 else (g[1] if lv > -0.3 else g[0]))
    # Kopf
    for (px, py) in img.disc_pixels(10, 5, 3.2, 2.6):
        lv = -0.6 * (px - 10) / 3 - 0.8 * (py - 5) / 2.6
        img.set(px, py, g[3] if lv > 0.5 else (g[2] if lv > -0.2 else g[1]))
    # Bauch / Kehle
    img.hline(8, 12, 8, R("Sonnengelb", 3))
    img.hline(5, 9, 9, R("Sand", 3))
    # Flecken
    for (x, y) in ((4, 5), (6, 4), (3, 7)):
        img.set(x, y, g[0])
    # Hinterbein
    img.hline(1, 6, 9, g[1])
    img.hline(0, 4, 10, g[0])
    img.set(2, 8, g[2])
    # Vorderbein
    img.vline(10, 8, 10, g[1])
    img.hline(10, 12, 10, g[0])
    # Auge 2×2 mit Highlight oben links
    img.rect(10, 2, 11, 3, R("Nachtblau", 0))
    img.set(10, 2, (255, 255, 255, 255))
    img.set(9, 2, g[3])
    img.hline(12, 13, 5, g[0])                 # Maul
    if kind != "idle":                          # Schallblase
        r = 1.6 if kind == "quak0" else 2.4
        for (px, py) in img.disc_pixels(12.2, 7.5, r, r * 0.9):
            img.set(px, py, R("Wolke", 3) if px + py < 19 else R("Wolke", 2))
    img.outline()
    return img


def tadpoles(frame):
    img = S(28, 16)
    rng = random.Random(14)
    body, body_l, tail = R("Dunkelholz", 0), R("Dunkelholz", 1), R("Dunkelholz", 2)
    spots = [(5, 4), (13, 3), (21, 5), (8, 10), (17, 9), (23, 12)]
    for i, (bx, by) in enumerate(spots):
        a = 2 * math.pi * frame / 4 + i * 1.3
        x, y = round(bx + 1.5 * math.cos(a)), round(by + 0.8 * math.sin(a))
        img.rect(x, y, x + 1, y + 1, body)
        img.set(x + 1, y, body_l)
        wig = (frame + i) % 2
        img.set(x - 1, y + (1 if wig else 0), tail)
        img.set(x - 2, y + (0 if wig else 1), tail)
        img.set(x - 3, y + (1 if wig else 0), tail)
    return img


def firefly(frame):
    img = S(7, 7)
    core = [R("Sonnengelb", 1), R("Sonnengelb", 3), R("Sonnengelb", 3), R("Sonnengelb", 3)][frame]
    img.set(3, 3, core)
    if frame >= 1:
        for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            img.set(3 + dx, 3 + dy, R("Sonnengelb", 2) if frame == 2 else R("Schilfgruen", 3))
    if frame == 2:
        for (dx, dy) in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            img.set(3 + dx, 3 + dy, R("Schilfgruen", 3))
    img.set(2, 2, R("Dunkelholz", 0))   # Körperchen
    return img


def bubble(frame, size="m"):
    r = {"s": 1.6, "m": 2.6, "l": 3.6}[size]
    w = int(r * 2) + 3
    img = S(w, w + 1)
    sq = [(1.0, 1.0), (1.12, 0.9), (1.0, 1.0), (0.9, 1.12)][frame]
    cx, cy = w / 2, (w + 1) / 2
    rim = R("Himmelblau", 3)
    for (px, py) in img.disc_pixels(cx, cy, r * sq[0], r * sq[1]):
        inner = ((px + .5 - cx) / (r * sq[0] - 1)) ** 2 + ((py + .5 - cy) / (r * sq[1] - 1)) ** 2 > 1.0 \
            if r > 1.7 else True
        if inner:
            img.set(px, py, rim if px + py > cx + cy - 1 else R("Seetuerkis", 3))
    img.set(int(cx - r * 0.45), int(cy - r * 0.45), R("Wolke", 3))
    return img


def light_spot(frame):
    img = S(20, 5)
    rng = random.Random(30 + frame)
    for i in range(14):
        a = 2 * math.pi * (i / 14) + frame * 0.8
        x = round(10 + 8 * math.cos(a) * (0.6 + 0.4 * math.sin(i * 1.7 + frame)))
        y = round(2 + 1.6 * math.sin(a))
        img.set(x, y, R("Sand", 3) if i % 3 else R("Wolke", 3))
        if rng.random() < 0.4:
            img.set(x + 1, y, R("Sand", 3))
    return img


def rain_drop():
    img = S(1, 5)
    img.vline(0, 0, 2, R("Himmelblau", 3))
    img.vline(0, 3, 4, R("Wolke", 3))
    return img


def rain_ring(frame):
    img = S(15, 6)
    c, c2 = R("Wolke", 3), R("Himmelblau", 3)
    if frame == 0:
        img.hline(6, 8, 5, c2)
        img.set(7, 3, c)
        img.set(7, 2, c)
        img.set(5, 4, c2)
        img.set(9, 4, c2)
    elif frame == 1:
        img.hline(4, 10, 5, c2)
        img.set(3, 4, c)
        img.set(11, 4, c)
        img.hline(5, 9, 3, c)
    else:
        for x in range(0, 15):
            if x % 3:
                img.set(x, 5, c2)
        img.set(1, 4, c2)
        img.set(13, 4, c2)
    return img


def crumb_cloud(frame):
    img = S(34, 26)
    rng = random.Random(77)
    for i in range(34):
        bx, by = rng.gauss(17, 6.5), rng.gauss(12, 5)
        ph = rng.uniform(0, 6.28)
        a = 2 * math.pi * frame / 4 + ph
        x, y = round(bx + math.cos(a)), round(by + 0.8 * math.sin(a) + frame * 0)
        if not (1 <= x < 33 and 1 <= y < 25):
            continue
        big = rng.random() < 0.35
        img.set(x, y, R("Sand", 3))
        if big:
            img.set(x + 1, y, R("Sand", 2))
            img.set(x, y + 1, R("Sand", 1))
    return img


def sun():
    img = S(22, 22)
    cx = cy = 11
    for (px, py) in img.disc_pixels(cx, cy, 6.2, 6.2):
        lv = -0.6 * (px - cx) / 6 - 0.8 * (py - cy) / 6
        img.set(px, py, R("Sonnengelb", 3) if lv > -0.2 else R("Sonnengelb", 2))
    for k in range(8):
        a = k * math.pi / 4
        for r in (8, 9, 10):
            if k % 2 and r == 10:
                continue
            img.set(round(cx + r * math.cos(a) - .5), round(cy + r * math.sin(a) - .5), R("Sonnengelb", 2))
    return img


def moon(full=True):
    img = S(15, 15)
    cx = cy = 7.5
    for (px, py) in img.disc_pixels(cx, cy, 6, 6):
        if not full and (px + .5 - cx - 3) ** 2 + (py + .5 - cy + 1) ** 2 < 25:
            continue
        lv = -0.6 * (px - cx) / 6 - 0.8 * (py - cy) / 6
        img.set(px, py, R("Wolke", 3) if lv > -0.3 else R("Wolke", 2))
    if full:
        for (x, y) in ((5, 6), (6, 6), (9, 9), (8, 4)):
            img.set(x, y, R("Wolke", 1))
    return img


def cloud(w, h, seed):
    import see_layers as SL
    img = Img(w + 4, h + 4, pal())
    SL.cumulus(img, (w + 4) / 2, h + 2, w, h, [hx(c) for c in SL.SKY["tag"]["cloud"]], seed)
    return img


def star(frame):
    img = S(5, 5)
    img.set(2, 2, R("Wolke", 3))
    if frame:
        for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            img.set(2 + dx, 2 + dy, R("Wolke", 1))
    return img


def swallow(frame):
    img = S(13, 7)
    blue, white = R("Nachtblau", 1), R("Wolke", 3)
    img.hline(3, 9, 3, blue)
    img.hline(4, 8, 4, white)
    img.set(10, 3, blue)
    img.set(10, 4, R("Signalrot", 1))
    img.set(11, 3, R("Nachtblau", 0))
    img.set(2, 2, blue)
    img.set(1, 1, blue)
    img.set(1, 4, blue)
    img.set(0, 5, blue)
    if frame == 0:
        img.line(5, 2, 3, 0, blue)
        img.line(7, 2, 8, 0, R("Nachtblau", 2))
    else:
        img.line(5, 4, 3, 6, blue)
        img.line(7, 4, 9, 6, R("Nachtblau", 2))
    return img


HERON = [
    ".......kkk......",
    "......kwWWw.....",
    "........wWewyyyy",
    "........wWWYYY..",
    ".........wW.....",
    "..........Ws....",
    "..........Ws....",
    ".........Wsk....",
    "........Wsk.....",
    "........Wsk.....",
    ".........Wsk....",
    "......zzsWWs....",
    "....zzsSSSWs....",
    "..zzsSSSSSSs....",
    ".zZsSSSssssz....",
    "zZzzssssszz.....",
    "Z..zZssszZ......",
    "....zZZZZ.......",
]


def heron():
    lg = {"k": R("Nachtblau", 0), "W": R("Wolke", 3), "w": R("Wolke", 2), "S": R("Stein", 3),
          "s": R("Stein", 2), "z": R("Stein", 1), "Z": R("Stein", 0), "e": R("Nachtblau", 0),
          "y": R("Sonnengelb", 2), "Y": R("Sonnengelb", 0)}
    body = from_map(HERON, lg, pal())
    img = S(18, 32)
    img.blit(body, 1, 1)
    img.outline()
    leg = R("Sand", 0)
    for lx in (7, 10):
        img.vline(lx, 19, 30, leg)
        img.set(lx, 24, R("Sand", 1))
    img.hline(5, 8, 31, leg)
    img.hline(9, 12, 31, leg)
    return img


def water_strider(frame):
    img = S(9, 4)
    leg = R("Dunkelholz", 1)
    img.hline(3, 5, 1, R("Dunkelholz", 0))
    if frame == 0:
        img.line(3, 1, 0, 3, leg)
        img.line(5, 1, 8, 3, leg)
        img.line(4, 1, 2, 3, leg)
    else:
        img.line(3, 1, 1, 3, leg)
        img.line(5, 1, 8, 2, leg)
        img.line(4, 1, 5, 3, leg)
    img.set(0, 3, R("Himmelblau", 3))
    img.set(8, 3, R("Himmelblau", 3))
    return img


def gnats(frame):
    img = S(14, 12)
    rng = random.Random(5)
    for i in range(14):
        bx, by = rng.uniform(2, 12), rng.uniform(2, 10)
        a = 2 * math.pi * frame / 4 + rng.uniform(0, 6.28)
        img.set(round(bx + 1.5 * math.cos(a)), round(by + 1.5 * math.sin(a * 1.5)), R("Dunkelholz", 0))
    return img


def moon_pillar(frame):
    """Mondlicht-Säule auf der fernen Wasserfläche (Zeilen 114..119)."""
    img = S(26, 6)
    rng = random.Random(40 + frame)
    for y in range(6):
        half = 3 + y * 2
        x = 13 - half + rng.randint(0, 2)
        while x < 13 + half:
            ln = rng.randint(2, 4)
            for k in range(ln):
                img.set(x + k, y, R("Wolke", 3) if y < 3 else R("Himmelblau", 3))
            x += ln + rng.randint(1, 3)
    return img


def lightning(var):
    rng = random.Random(9 + var)
    img = S(28, 88)
    x, y = 14, 0
    pts = [(x, y)]
    while y < 86:
        y += rng.randint(4, 9)
        x += rng.randint(-4, 4)
        x = max(3, min(24, x))
        pts.append((x, min(87, y)))
    for (a, b) in zip(pts, pts[1:]):
        img.line(a[0] + 1, a[1], b[0] + 1, b[1], R("Sonnengelb", 2))
        img.line(a[0], a[1], b[0], b[1], R("Wolke", 3))
    bx, by = pts[len(pts) // 2]
    for k in range(10):
        img.set(bx - k, by + k + k // 2, R("Sonnengelb", 3))
    return img


# --------------------------------------------------------------------------- Liste

def all_sprites() -> list[Sprite]:
    out = []
    for v in ("a", "b", "c"):
        im = lily_pad(v)
        out.append(Sprite(f"see_seerose_blatt_{v}_still", [im],
                          anchors={"wasserlinie": {"x": im.w // 2, "y": im.h - 2}}))
    fl = lily_flower()
    out.append(Sprite("see_seerose_bluete_still", [fl], anchors={"fuss": {"x": 6, "y": 9}}))
    reed = reed_clump()
    out.append(Sprite("see_schilf_sway", sway_frames(reed), fps=3, yoyo=True,
                      anchors={"fuss": {"x": 8, "y": 39}}, note="Wiegen ±2 px oben, yoyo"))
    out.append(Sprite("see_wasserpest_sway", wave_frames(elodea_clump()), fps=4,
                      anchors={"fuss": {"x": 7, "y": 49}}))
    out.append(Sprite("see_libelle_fly", [dragonfly(0), dragonfly(1)], fps=16))
    out.append(Sprite("see_ente_swim", [duck_swim(0), duck_swim(1)], fps=4,
                      anchors={"wasserlinie": {"x": 10, "y": 11}}))
    out.append(Sprite("see_ente_dabble", [duck_dabble(0), duck_dabble(1)], fps=5,
                      anchors={"wasserlinie": {"x": 8, "y": 10}}))
    out.append(Sprite("see_frosch_idle", [frog("idle")], eyes=1, anchors={"fuss": {"x": 6, "y": 10}}))
    out.append(Sprite("see_frosch_quak", [frog("quak0"), frog("quak1")], fps=6, yoyo=True, eyes=1,
                      anchors={"fuss": {"x": 6, "y": 10}}))
    out.append(Sprite("see_kaulquappen_swim", [tadpoles(f) for f in range(4)], fps=8))
    out.append(Sprite("see_gluehwuermchen_glow", [firefly(f) for f in range(4)], fps=6))
    for size in ("s", "m", "l"):
        out.append(Sprite(f"see_blase_{size}_wobble", [bubble(f, size) for f in range(4)], fps=8))
    out.append(Sprite("see_lichtfleck_shimmer", [light_spot(f) for f in range(4)], fps=5))
    out.append(Sprite("see_regentropfen_still", [rain_drop()]))
    out.append(Sprite("see_regenring_splash", [rain_ring(f) for f in range(3)], fps=12, loop=False,
                      anchors={"wasserlinie": {"x": 7, "y": 5}}))
    out.append(Sprite("see_kruemelwolke_drift", [crumb_cloud(f) for f in range(4)], fps=4))
    out.append(Sprite("see_sonne_still", [sun()]))
    out.append(Sprite("see_mond_voll_still", [moon(True)]))
    out.append(Sprite("see_mond_sichel_still", [moon(False)]))
    out.append(Sprite("see_wolke_a_still", [cloud(44, 15, 31)]))
    out.append(Sprite("see_wolke_b_still", [cloud(28, 10, 32)]))
    out.append(Sprite("see_stern_twinkle", [star(0), star(1)], fps=2, yoyo=True))
    out.append(Sprite("see_schwalbe_fly", [swallow(0), swallow(1)], fps=10))
    out.append(Sprite("see_reiher_still", [heron()], anchors={"fuss": {"x": 9, "y": 31}}))
    out.append(Sprite("see_wasserlaeufer_skate", [water_strider(0), water_strider(1)], fps=6,
                      anchors={"wasserlinie": {"x": 4, "y": 3}}))
    out.append(Sprite("see_muecken_swarm", [gnats(f) for f in range(4)], fps=10))
    out.append(Sprite("see_mondsaeule_shimmer", [moon_pillar(f) for f in range(4)], fps=4,
                      anchors={"oben": {"x": 13, "y": 0}}, note="liegt auf der fernen Wasserfläche y 114..119"))
    out.append(Sprite("see_blitz_a_still", [lightning(0)]))
    out.append(Sprite("see_blitz_b_still", [lightning(1)]))
    return out

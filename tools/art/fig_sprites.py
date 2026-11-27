"""Figuren & Ausrüstung (Atlas `atlas_figures`, Palette `figures`) – weltübergreifend.

Spieler-Angler (4 Farbvarianten per Rampentausch), Rute R01 in 4 Biegestufen (`rod_bend_0..3`, Spec 6.5
bendFrames), Pose rot-weiß, Wurm am Haken, Kescher, Ruderboot (Schaukeln), Opa Otto, Wetterfrosch
Fridolin und Wetter-Icons. Kleine Figuren als handgeschriebene Zeichenraster (F8.5).
"""
from __future__ import annotations

import math

from pixkit import Img, Pal, from_map, shift_cols, translated
from see_sprites import Sprite

PAL = None
WHITE = (255, 255, 255, 255)


def pal() -> Pal:
    global PAL
    if PAL is None:
        PAL = Pal("figures")
    return PAL


def R(name, i):
    return pal()(name, i)


def S(w, h) -> Img:
    return Img(w, h, pal())


def pad(rows, w):
    out = []
    for r in rows:
        if len(r) > w:
            raise ValueError(f"Zeile zu lang ({len(r)} > {w}): {r!r}")
        out.append(r + "." * (w - len(r)))
    return out


# --------------------------------------------------------------------------- Angler

ANGLER = [
    "......hHHHh",
    ".....hHHHHHh",
    "...hhbbbbbbbhh",
    "..hHHHHHHHHHHHh",
    "......rrFFFF",
    ".....rrFFFeFf",
    ".....rrfFFFFFq",
    "......rffFFFf",
    ".......qffff",
    "......jJJJJjj",
    ".....jJJJJJjjd",
    ".....JJJJjjjdd",
    ".....JJJjjjjJJJj",
    ".....JJjjjjdjjJJJFF",
    ".....JJjjjjdd..dqFf",
    ".....JJjjjjdd",
    ".....jJjjjjdd",
    ".....jjjjjjdd",
    ".....dddPPPPPPPPP",
    ".....dpppppppppPPp",
    "......nnnnnnnnnppn",
    "..............ppn",
    "..............ppn",
    "..............ppn",
    "..............ppn",
    ".............BBBD",
    ".............BBBBBD",
    ".............DDDDDD",
]
ANGLER_W = 20
ANGLER_HAND = (17, 13)
ANGLER_SEAT = (8, 20)

# Varianten: (Jacke, Hut, Hutband)
ANGLER_VARIANTS = {
    "a": ("Signalrot", "Stroh", "Signalrot"),
    "b": ("Jackenblau", "Friesengelb", "Jackenblau"),
    "c": ("Jackengruen", "Stroh", "Dunkelholz"),
    "d": ("Friesengelb", "Jackenblau", "Signalrot"),
}


def angler(var):
    jacket, hat, band = ANGLER_VARIANTS[var]
    lg = {
        "h": R(hat, 1), "H": R(hat, 2), "b": R(band, 1),
        "F": R("Haut", 2), "f": R("Haut", 1), "q": R("Haut", 0),
        "J": R(jacket, 2), "j": R(jacket, 1), "d": R(jacket, 0),
        "P": R("Jeans", 2), "p": R("Jeans", 1), "n": R("Jeans", 0),
        "B": R("Dunkelholz", 1), "D": R("Dunkelholz", 0), "e": R("Tinte", 0), "r": R("Dunkelholz", 1),
    }
    img = Img(ANGLER_W + 2, len(ANGLER) + 2, pal())
    img.blit(from_map(pad(ANGLER, ANGLER_W), lg, pal()), 1, 1)
    img.set(1 + 7, 1 + 3, R(hat, 3))      # Licht auf der Hutkrempe
    img.set(1 + 8, 1 + 0, R(hat, 3))
    img.outline()
    return img


# --------------------------------------------------------------------------- Rute

ROD_W, ROD_H = 64, 50
ROD_BUTT = (3, 47)
ROD_LEN = 58
ROD_GRIP_S = 9           # Abstand Griffende → Hand


def rod_points(bend):
    """Punkte der Rute entlang s (0..L): Winkel nimmt zur Spitze hin quadratisch ab."""
    th0 = math.radians(56)
    pts = []
    x, y = ROD_BUTT
    for i in range(ROD_LEN * 4 + 1):
        s = i / 4
        th = th0 - math.radians(80) * bend * (s / ROD_LEN) ** 2.2
        pts.append((x, y, th, s))
        x += math.cos(th) * 0.25
        y -= math.sin(th) * 0.25
    return pts


def rod(bend_level):
    bend = [0.0, 0.33, 0.66, 1.0][bend_level]
    img = S(ROD_W, ROD_H)
    pts = rod_points(bend)
    lit, base, node, dark = R("Stroh", 3), R("Stroh", 2), R("Stroh", 0), R("Stroh", 1)
    for (x, y, th, s) in pts:
        px, py = int(round(x)), int(round(y))
        nx, ny = -math.sin(th), -math.cos(th)    # Normale nach oben links
        if s < ROD_GRIP_S:                       # Korkgriff, 3 px
            img.set(px, py, R("Holz", 3))
            img.set(int(round(x - nx)), int(round(y - ny)), R("Holz", 1))
            img.set(int(round(x + nx)), int(round(y + ny)), R("Holz", 2))
        elif s < ROD_LEN * 0.45:                 # Handteil 2 px
            img.set(px, py, base)
            img.set(int(round(x - nx)), int(round(y - ny)), dark)
            if int(s) % 9 == 0:
                img.set(px, py, node)
                img.set(int(round(x - nx)), int(round(y - ny)), node)
        else:
            img.set(px, py, lit if s < ROD_LEN * 0.8 else base)
            if int(s) % 9 == 0:
                img.set(px, py, node)
    # Rolle unter dem Griff
    x, y, th, _ = pts[int(6 * 4)]
    rx, ry = int(round(x + math.sin(th) * 3)), int(round(y + math.cos(th) * 3))
    for (px, py) in img.disc_pixels(rx + .5, ry + .5, 2.4, 2.4):
        img.set(px, py, R("Metall", 2) if px + py < rx + ry + 1 else R("Metall", 1))
    img.set(rx, ry, R("Metall", 3))
    img.set(rx + 2, ry + 2, R("Tinte", 0))
    # Ringe (Unterseite) und Spitzenring
    for frac in (0.32, 0.52, 0.7, 0.86):
        x, y, th, _ = pts[int(frac * ROD_LEN * 4)]
        img.set(int(round(x + math.sin(th))), int(round(y + math.cos(th))), R("Metall", 3))
    tx, ty, _, _ = pts[-1]
    img.set(int(round(tx)), int(round(ty)), R("Metall", 2))
    img.outline()
    gx, gy, _, _ = pts[ROD_GRIP_S * 4]
    anchors = {"griff": {"x": int(round(gx)), "y": int(round(gy))},
               "spitze": {"x": int(round(tx)), "y": int(round(ty))},
               "ende": {"x": ROD_BUTT[0], "y": ROD_BUTT[1]}}
    return img, anchors


# --------------------------------------------------------------------------- Pose, Köder, Kescher

POSE = [
    "...r...",
    "...R...",
    "...R...",
    "..rRr..",
    ".rRRRr.",
    "rRRRRRr",
    "rRRRRrr",
    "wWWWWWw",
    "wWWWWww",
    ".wWWWw.",
    "..wWw..",
    "...m...",
    "...m...",
    "...M...",
]
POSE_WL = 10                  # Wasserlinie im Frame
POSE_TOP = 3                  # Oberkante der Pose im Ruhezustand


def pose(offset):
    """Pose um `offset` px gegenüber der Ruhelage verschoben (+ = tiefer)."""
    lg = {"r": R("Signalrot", 1), "R": R("Signalrot", 2), "w": R("Wolke", 2), "W": R("Wolke", 3),
          "m": R("Metall", 1), "M": R("Metall", 0)}
    body = from_map(POSE, lg, pal())
    body.outline()
    img = S(9, 28)
    img.blit(body, 0, POSE_TOP - 1 + offset)
    return img


def worm(frame):
    img = S(11, 14)
    hook = R("Metall", 2)
    img.set(3, 0, R("Metall", 3))
    img.set(4, 0, hook)
    img.set(3, 1, hook)
    img.vline(4, 1, 9, hook)
    img.line(4, 10, 6, 11, hook)
    img.line(7, 10, 8, 8, hook)
    img.set(8, 7, R("Metall", 3))
    w1, w2, w3 = R("Haut", 0), R("Haut", 1), R("Signalrot", 3)
    for (x, y) in ((3, 3), (5, 4), (3, 5), (5, 6), (3, 7), (5, 8)):
        img.set(x, y, w2)
        img.set(x + (1 if x < 4 else -1), y, w1 if y % 4 else w3)
    tail = [(2, 9), (1, 10), (1, 11), (2, 12)] if frame == 0 else [(3, 9), (2, 10), (2, 11), (3, 12)]
    tail += [(6, 3), (7, 2)] if frame == 0 else [(6, 3), (7, 4)]
    for (x, y) in tail:
        img.set(x, y, w2)
    img.outline()
    return img


def landing_net():
    img = S(30, 24)
    img.line(1, 22, 14, 9, R("Holz", 2))
    img.line(2, 22, 15, 9, R("Holz", 1))
    img.rect(0, 21, 2, 23, R("Dunkelholz", 1))
    cx, cy, rx, ry = 21.5, 7.5, 7.2, 5.6
    for a in range(0, 360, 3):
        r = math.radians(a)
        img.set(int(round(cx + rx * math.cos(r) - .5)), int(round(cy + ry * math.sin(r) - .5)),
                R("Metall", 3) if a > 180 else R("Metall", 1))
    for y in range(int(cy), 22):
        half = rx * max(0.0, 1 - ((y - cy) / 14.0) ** 2) - 0.5
        for x in range(int(cx - half), int(cx + half) + 1):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                if not img.opaque(x, y):
                    img.set(x, y, R("Wolke", 2) if (x + y) % 2 else R("Wolke", 1))
    return img


# --------------------------------------------------------------------------- Ruderboot

BOAT_W, BOAT_H, BOAT_WL = 56, 20, 12


def boat_base():
    img = S(BOAT_W, BOAT_H)
    wood = [R("Holz", i) for i in range(4)]
    for x in range(2, BOAT_W - 2):
        t = (x - 2) / (BOAT_W - 5)
        sheer = 5 - round(3 * (2 * t - 1) ** 6)              # Bug/Heck höher
        keel = 16 - round(5 * (2 * t - 1) ** 4)
        if t > 0.86:
            keel = min(keel, sheer + round((1 - t) * 60))
        if t < 0.08:
            keel = min(keel, sheer + round(t * 110) + 3)
        for y in range(sheer, keel + 1):
            k = y - sheer
            strake = k // 3
            c = wood[3] if k == 0 else (wood[2] if k % 3 == 1 else (wood[1] if k % 3 == 2 else wood[0]))
            if strake == 0 and k > 0:
                c = R("Jackenblau", 2) if k == 1 else R("Jackenblau", 1)
            img.set(x, y, c)
    # Nieten
    for x in range(6, BOAT_W - 6, 6):
        img.set(x, 9, R("Metall", 2))
    # Ruder (verstaut) + Dolle
    img.line(12, 3, 44, 2, wood[3])
    img.line(12, 4, 44, 3, wood[1])
    img.rect(42, 1, 47, 4, wood[2])
    img.hline(42, 47, 4, wood[0])
    img.vline(28, 2, 4, R("Metall", 1))
    img.outline()
    return img


def boat(frame):
    base = boat_base()
    sign = -1 if frame == 0 else 1
    return shift_cols(base, lambda x: sign * round((x - BOAT_W / 2) / (BOAT_W / 2)))


# --------------------------------------------------------------------------- Opa Otto

OTTO = [
    "........OoyyyO",
    ".......OyYYYyyO",
    "......OyYYYYYyyO",
    ".....OyYYYYYYyyoO",
    "...OOoyyyyyyyyyyoOO",
    "..OoooooFFFFFFoooooO",
    "..Ooo..wmmFFmmF..ooO",
    "..Oo...wFFeFFFFq..oO",
    ".......wwFFFFFnnq",
    ".......wwWFFFFnnq",
    ".......wWWWwWWWq.pp",
    ".......wWWWWWWWPPpP",
    "........wWWWWWWw",
    "........vwWWWWwv",
    ".........vwWWwv",
    ".......oyYYwwYYyo",
    "......oyYYYYYYYyyo",
    ".....oyYYYYcYYYyyoO",
    ".....oyYYYYYYYYyyoO",
    "....oyYYYYYcYYYyyooO",
    "....oyYYYYYYYYYyyoQqO",
    "....oyYYYYYcYYyyyoqqO",
    "....oyYYYYYYYYyyyoO",
    "....OoyYYYYYYYyyyoO",
    "....OoyyYYYcYYyyooO",
    "....OooyyyyyyyyyooO",
    ".....OoooooooooooO",
    "......tttttTtttttT",
    "......tttttTtttttT",
    "......ttttT.tttttT",
    "......ttttT.ttttTT",
    "......bbbbB.bbbbbB",
    "......bbbbB.bbbbbB",
    ".....bbbbbB.bbbbbbBB",
    ".....BBBBBB.BBBBBBBB",
]


def otto():
    lg = {"Y": R("Friesengelb", 3), "y": R("Friesengelb", 2), "o": R("Friesengelb", 1), "O": R("Friesengelb", 0),
          "F": R("Haut", 2), "f": R("Haut", 1), "q": R("Haut", 0), "Q": R("Haut", 1),
          "W": R("Wolke", 3), "w": R("Wolke", 2), "v": R("Wolke", 1), "m": R("Wolke", 2),
          "e": R("Tinte", 0), "n": R("Signalrot", 3), "p": R("Dunkelholz", 1), "P": R("Dunkelholz", 0),
          "c": R("Metall", 2), "t": R("Jeans", 1), "T": R("Jeans", 0), "b": R("Tinte", 1), "B": R("Tinte", 0)}
    body = from_map(pad(OTTO, 22), lg, pal())
    img = S(30, 42)
    img.blit(body, 1, 5)
    img.outline()
    # Seifenblasen aus der Pfeife (Ringe mit 1 Lichtpunkt)
    for (cx, cy, r) in ((22.5, 12.5, 1.6), (25.5, 7.5, 2.3), (23.5, 2.8, 1.8)):
        for (px, py) in img.disc_pixels(cx, cy, r, r):
            if (px + .5 - cx) ** 2 + (py + .5 - cy) ** 2 > (r - 1) ** 2:
                img.set(px, py, R("Himmel", 2) if px + py > cx + cy else R("Himmel", 3))
        img.set(int(cx - r * .5), int(cy - r * .5), R("Wolke", 3))
    return img


# --------------------------------------------------------------------------- Wetterfrosch Fridolin

FRIDOLIN = [
    "......DDD....DDD",
    ".....DgWWD..DgWWD",
    ".....DWXeD..DWXeD",
    ".....DWeeDDDDWeeD",
    "....DgGWWgGGGgWWgD",
    "...DgGGGGGGGGGGGGgD",
    "...DgGGGGGGGGGGGGgD",
    "...DgGddGGGGGGGddgD",
    "....DgdddddddddgdD",
    ".....DrRRRRRRRRrD",
    "....DgrrrrrRrrrrgD",
    "...DgGYYYYYYYYYYgdD",
    "..DgGYYYYYYYYYYYYgdD",
    "..DgGYYYYYYYYYYYYgdD",
    ".DgGgYYYYYYYYYYYYgddD",
    ".DgGgdYYYYYYYYYYdgddD",
    ".DggdDdddddddddDdgdD",
    "..DGGgD.......DgGGD",
]
LADDER_ROWS = 12


def fridolin():
    lg = {"G": R("Froschgruen", 3), "g": R("Froschgruen", 2), "d": R("Froschgruen", 1),
          "D": R("Froschgruen", 0), "Y": R("Friesengelb", 3), "W": R("Wolke", 3), "e": R("Tinte", 0),
          "X": WHITE, "r": R("Signalrot", 1), "R": R("Signalrot", 2)}
    body = from_map(pad(FRIDOLIN, 21), lg, pal())
    img = S(25, 34)
    # Leiter
    top = 1 + len(FRIDOLIN) - 1
    for y in range(top, top + LADDER_ROWS + 2):
        if y < img.h:
            img.set(3, y, R("Holz", 3))
            img.set(4, y, R("Holz", 1))
            img.set(19, y, R("Holz", 2))
            img.set(20, y, R("Holz", 0))
    for y in range(top, img.h, 5):
        img.hline(5, 18, y, R("Holz", 2))
        img.hline(5, 18, y + 1, R("Holz", 0))
    img.blit(body, 2, 1)
    img.outline()
    return img


# --------------------------------------------------------------------------- Wetter-Icons

def _cloud_icon(img, cx, cy, ramp):
    for (ox, oy, r) in ((-3, 1, 2.6), (0, -1, 3.4), (3.4, 1, 2.4)):
        for (px, py) in img.disc_pixels(cx + ox, cy + oy, r, r):
            lv = -0.6 * (px + .5 - cx - ox) / r - 0.8 * (py + .5 - cy - oy) / r
            img.set(px, py, ramp[2] if lv > 0.3 else (ramp[1] if lv > -0.4 else ramp[0]))
    img.hline(int(cx - 5), int(cx + 5), int(cy + 3), ramp[0])


def weather_icon(kind):
    img = S(16, 16)
    sun = [R("Friesengelb", 1), R("Friesengelb", 2), R("Friesengelb", 3)]
    if kind in ("sonnig", "bewoelkt"):
        cx, cy, r = (8, 8, 4.2) if kind == "sonnig" else (5.5, 5.5, 3.2)
        for (px, py) in img.disc_pixels(cx, cy, r, r):
            lv = -0.6 * (px + .5 - cx) / r - 0.8 * (py + .5 - cy) / r
            img.set(px, py, sun[2] if lv > 0.2 else sun[1])
        for k in range(8):
            a = k * math.pi / 4
            rr = r + 2
            img.set(int(round(cx + rr * math.cos(a) - .5)), int(round(cy + rr * math.sin(a) - .5)), sun[0])
    if kind == "bewoelkt":
        _cloud_icon(img, 9.5, 9.5, [R("Wolke", 1), R("Wolke", 2), R("Wolke", 3)])
    if kind == "regen":
        _cloud_icon(img, 8, 6, [R("Metall", 1), R("Metall", 2), R("Metall", 3)])
        for (x, y) in ((4, 11), (8, 12), (12, 11)):
            img.line(x, y, x - 1, y + 2, R("Himmel", 1))
    if kind == "gewitter":
        _cloud_icon(img, 8, 6, [R("Tinte", 1), R("Metall", 0), R("Metall", 1)])
        for (x, y) in ((8, 9), (7, 10), (6, 11), (7, 11), (8, 11), (7, 12), (6, 13), (5, 14)):
            img.set(x, y, sun[2])
    if kind == "nebel":
        for i, y in enumerate((3, 6, 9, 12)):
            for x in range(2 + (i % 2) * 2, 14 - ((i + 1) % 2) * 2):
                img.set(x, y + (1 if (x // 3) % 2 else 0), R("Wolke", 3) if i % 2 == 0 else R("Wolke", 2))
    img.outline()
    return img


# --------------------------------------------------------------------------- Liste

def all_sprites() -> list[Sprite]:
    out = []
    for v in ANGLER_VARIANTS:
        out.append(Sprite(f"angler_{v}_sit_still", [angler(v)],
                          anchors={"hand": {"x": ANGLER_HAND[0] + 1, "y": ANGLER_HAND[1] + 1},
                                   "sitz": {"x": ANGLER_SEAT[0] + 1, "y": ANGLER_SEAT[1] + 1}},
                          note=f"Jacke/Hut/Band = {ANGLER_VARIANTS[v]}"))
    rods = [rod(i) for i in range(4)]
    out.append(Sprite("rod_bend", [r[0] for r in rods], fps=None, anchors=[r[1] for r in rods],
                      note="R01 Opas Bambusrute; Frame = Biegestufe (kein Zeit-Clip)"))
    wl = {"wasserlinie": {"x": 4, "y": POSE_WL}}
    out.append(Sprite("pose_idle", [pose(0), pose(-1)], fps=2, yoyo=True, anchors=wl))
    out.append(Sprite("pose_nibble", [pose(2), pose(1)], fps=10, anchors=wl, note="Zupfer"))
    out.append(Sprite("pose_bite", [pose(8), pose(10)], fps=8, loop=False, anchors=wl, note="abgetaucht"))
    out.append(Sprite("bait_wurm_wiggle", [worm(0), worm(1)], fps=4, anchors={"schnur": {"x": 3, "y": 0}}))
    out.append(Sprite("kescher_still", [landing_net()], anchors={"griff": {"x": 1, "y": 22}}))
    out.append(Sprite("boat_ruderboot_rock", [boat(0), boat(1)], fps=2, yoyo=True,
                      anchors={"wasserlinie": {"x": BOAT_W // 2, "y": BOAT_WL},
                               "sitz": {"x": 24, "y": 8}}))
    out.append(Sprite("otto_still", [otto()]))
    out.append(Sprite("fridolin_still", [fridolin()], eyes=2))
    for k in ("sonnig", "bewoelkt", "regen", "gewitter", "nebel"):
        out.append(Sprite(f"wetter_{k}_still", [weather_icon(k)]))
    return out

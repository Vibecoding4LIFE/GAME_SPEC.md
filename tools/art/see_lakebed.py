"""Seegrund-Querschnitt von Welt 1 (Ebene `lakebed`, transparent über dem Grund).

Enthält: Grundprofil mit Uferbank (Sand), Krautfeld-Schlamm, Tiefes Loch (Trichter), Erd-Schichten,
Steg-Pfähle unter Wasser, Seerosenstiele mit Wurzelstock, Wasserpest, Einkaufswagen + Fahrrad
(Easter Egg), versunkenes Ruderboot, Wurzelstock mit alten Haken.
"""
from __future__ import annotations

import math
import random

import see_layout as L
from pixkit import Img, bayer, pnoise1, rotate_pixel
from see_layers import W, hx, pal

OY = L.SURFACE_Y            # Ebene beginnt bei Welt-y 120
H = L.WORLD_H - OY


def fy(x):
    """Grund-Oberkante in Ebenen-Koordinaten."""
    return L.floor_y(x) - OY


SAND = ["#B28245", "#C5A066", "#D8BE88", "#EEDCA5"]
GRUND = ["#12342F", "#2A4B42", "#426256", "#5C7B6A"]
DH = ["#331C13", "#4F2F1C", "#664730"]


def zone_of(x, y, d):
    """0 = Sand, 1 = Übergang, 2 = Schlamm (mit Bayer-Übergang)."""
    if d < 4.6:
        return 0
    if d < 6.4:
        return 0 if bayer(x, y, 1 - (d - 4.6) / 1.8) else 1
    if d < 11.5:
        return 1
    if d < 13.5:
        return 1 if bayer(x, y, 1 - (d - 11.5) / 2.0) else 2
    return 2


def ground_color(x, y, top, d, lit):
    k = y - top
    z = zone_of(x, y, d)
    strata = int(3 * pnoise1(x / 40, 24, 3))
    if z == 0:
        if k == 0:
            return hx(SAND[3] if lit >= 0 else SAND[2])
        if k <= 2:
            return hx(SAND[2])
        if k <= 9:
            return hx(SAND[1]) if not bayer(x, y, (k - 3) / 10) else hx(SAND[0])
        if k <= 16 + strata:
            return hx(SAND[0]) if bayer(x, y, 0.5 - (k - 10) / 16) else hx(DH[2])
    elif z == 1:
        if k == 0:
            return hx(GRUND[3] if lit >= 0 else GRUND[2])
        if k <= 3:
            return hx(GRUND[2])
        if k <= 12 + strata:
            return hx(GRUND[1]) if not bayer(x, y, (k - 4) / 14) else hx(DH[1])
    else:
        if k == 0:
            return hx(GRUND[2] if lit > 0 else GRUND[1])
        if k <= 3:
            return hx(GRUND[1])
        if k <= 10 + strata:
            return hx(GRUND[1]) if not bayer(x, y, (k - 3) / 10) else hx(GRUND[0])
    # tiefe Erdschichten: dunkel und ruhig; dünne, unterschiedlich dicke Bänder
    wob = int(5 * math.sin(2 * math.pi * x / 240) + 3 * math.sin(2 * math.pi * x / 96))
    yy = y + wob
    pos = yy % 29
    kind = (yy // 29) % 3
    if kind == 0 and pos < 2:
        return hx(DH[1]) if bayer(x, y, 0.5) else hx(DH[0])
    if kind == 1 and pos < 3:
        return hx(GRUND[1]) if bayer(x, y, 0.5) else hx(GRUND[0])
    if kind == 2 and pos < 1:
        return hx(DH[0])
    if k < 50:
        return hx(DH[0]) if bayer(x, y, 0.25) else hx(GRUND[0])
    return hx(GRUND[0])


def draw_ground(img: Img):
    rng = random.Random(404)
    for x in range(W):
        top = fy(x)
        d = L.floor_depth_m(x)
        lit = fy(x + 1) - fy(x - 1)        # >0: fällt nach rechts ab → Fläche schaut nach oben links
        for y in range(top, H):
            img.set(x, y, ground_color(x, y, top, d, lit))
        if lit > 1:                         # beleuchtete Hangkante zweite Zeile
            img.set(x, top + 1, hx(SAND[3] if d < 5 else GRUND[3]))
        if lit < -1:                        # Schattenhang: Kante dunkler
            img.set(x, top, hx(SAND[1] if d < 5 else GRUND[1]))
    # Kiesel, Muscheln
    for i in range(160):
        x = rng.randrange(W)
        d = L.floor_depth_m(x)
        top = fy(x)
        if d < 5:
            cols = ["#737C8A", "#8D96A0", "#A4B1BC"]
        else:
            cols = [GRUND[1], GRUND[2], GRUND[3]]
        w = rng.randint(2, 4)
        hgt = 1 if w < 3 else 2
        for dx in range(w):
            for dy in range(hgt):
                c = cols[2] if (dy == 0 and dx < w - 1) else (cols[1] if dy == 0 else cols[0])
                img.set(x + dx, top - hgt + dy + 1, hx(c))
        if d < 5 and rng.random() < 0.35:
            img.set(x + w + 2, top, hx("#F2EFE2"))
            img.set(x + w + 3, top, hx("#D3D3D0"))
    # vergrabene Steine in den Erdschichten
    for i in range(34):
        x = rng.randrange(W)
        y = fy(x) + rng.randint(20, 200)
        if y >= H - 2:
            continue
        rx, ry = rng.uniform(2, 5), rng.uniform(1.5, 3)
        for (px, py) in img.disc_pixels(x, y, rx, ry):
            nx, ny = (px + .5 - x) / rx, (py + .5 - y) / ry
            lv = -0.6 * nx - 0.8 * ny
            img.set(px, py, hx("#596375" if lv > 0.3 else ("#2A4B42" if lv > -0.4 else "#331C13")))


def draw_earth_details(img: Img):
    """Wurzeln unter der Uferbank, vergrabene Fundstücke im Querschnitt."""
    rng = random.Random(808)
    for i in range(26):
        x = rng.choice([rng.randrange(0, 280), rng.randrange(900, 960)])
        y = fy(x) + rng.randint(6, 12)
        ang = math.pi / 2 + rng.uniform(-0.6, 0.6)
        for k in range(rng.randint(10, 34)):
            x += math.cos(ang)
            y += math.sin(ang)
            ang += rng.uniform(-0.3, 0.3)
            img.set(round(x), round(y), hx(DH[2] if k < 6 else DH[1]))
            if k % 7 == 3:
                img.set(round(x) + 1, round(y) + 1, hx(DH[1]))
    # alter Anker (Stein-Rampe), halb vergraben unter dem Krautfeld
    ax, ay = 380, fy(380) + 46
    a = [hx("#596375"), hx("#737C8A"), hx("#8D96A0")]
    img.vline(ax, ay - 12, ay, a[1])
    img.vline(ax + 1, ay - 12, ay, a[0])
    img.hline(ax - 3, ax + 4, ay - 10, a[1])
    for (px, py) in img.disc_pixels(ax + 1, ay - 14, 2, 2):
        img.set(px, py, a[2] if px <= ax else a[0])
    for (px, py) in img.disc_pixels(ax + 1, ay - 14, 1, 1):
        img.set(px, py, hx(GRUND[0]))
    for d in (-1, 1):
        for k in range(6):
            img.set(ax + (k if d > 0 else -k + 1), ay - (k * k) // 8 + 1, a[1] if d < 0 else a[0])
    # Flaschenpost unter der Uferbank
    bx, by = 120, fy(120) + 70
    for k in range(9):
        img.set(bx + k, by, hx("#3FA7A3" if k < 7 else "#138C90"))
        img.set(bx + k, by + 1, hx("#138C90" if k < 7 else "#1A6F78"))
        img.set(bx + k, by + 2, hx("#1A6F78"))
    img.set(bx + 1, by, hx("#67C2B6"))
    img.vline(bx + 9, by, by + 2, hx("#A0754B"))
    img.hline(bx + 2, bx + 5, by + 1, hx("#EEDCA5"))
    # versteinerter Fisch (Gräten) tief unten
    fx, fy_ = 860, fy(860) + 120
    for k in range(12):
        img.set(fx + k, fy_, hx("#5C7B6A"))
        if k % 2 == 0 and 1 < k < 10:
            img.set(fx + k, fy_ - 2, hx("#426256"))
            img.set(fx + k, fy_ - 1, hx("#5C7B6A"))
            img.set(fx + k, fy_ + 1, hx("#5C7B6A"))
            img.set(fx + k, fy_ + 2, hx("#426256"))
    img.vline(fx - 1, fy_ - 2, fy_ + 2, hx("#5C7B6A"))
    img.vline(fx - 2, fy_ - 3, fy_ - 2, hx("#426256"))
    img.vline(fx - 2, fy_ + 2, fy_ + 3, hx("#426256"))
    for (px, py) in img.disc_pixels(fx + 13, fy_ + .5, 2, 2):
        img.set(px, py, hx("#426256"))
    img.set(fx + 13, fy_, hx("#12342F"))


def draw_piles(img: Img):
    rng = random.Random(9)
    for px in L.PILES:
        bottom = fy(px + 2) + 5
        for y in range(0, bottom):
            k = y / max(1, bottom)
            cols = [DH[2], DH[1], DH[1], DH[0]] if y > 10 else ["#8A5A33", "#763E16", "#763E16", DH[1]]
            for i in range(4):
                img.set(px + i, y, hx(cols[i]))
            if y % 9 == 4:                    # Jahresringe/Risse
                img.set(px + 1 + (y // 9) % 2, y, hx(DH[0]))
            if y > 18 and rng.random() < 0.18 + 0.4 * k:   # Algenbewuchs
                side = rng.choice((0, 3, -1, 4))
                img.set(px + side, y, hx(rng.choice(["#0C7332", "#3A8D34", "#3E786E"])))
        for i in range(3):                    # Muscheln
            y = bottom - rng.randint(6, 18)
            img.set(px + rng.choice((0, 3)), y, hx("#1F2B5C"))
            img.set(px + rng.choice((0, 3)), y + 1, hx("#2D4473"))


def draw_lily_stems(img: Img):
    rng = random.Random(17)
    g = ["#0C7332", "#3A8D34", "#6BA34A", "#94BA61"]
    for (lx, var) in L.LILIES:
        bx = lx + rng.randint(-7, 7)
        bottom = fy(bx)
        ph = rng.random() * 6
        prev = None
        for y in range(1, bottom + 1):
            t = y / bottom
            x = round(lx + (bx - lx) * t + 2 * math.sin(y / 9 + ph) * math.sin(math.pi * t))
            img.set(x, y, hx(g[1]))
            if prev is not None and abs(prev - x) > 1:
                img.set((x + prev) // 2, y, hx(g[1]))
            if y % 7 == 3:
                img.set(x - 1, y, hx(g[2]))
            prev = x
            if y == int(bottom * 0.45) and var != "b":   # eingerolltes Jungblatt
                img.rect(x + 1, y - 1, x + 3, y, hx(g[2]))
                img.set(x + 1, y - 1, hx(g[3]))
                img.set(x + 3, y, hx(g[0]))
        # Wurzelstock im Sand
        for dx in range(-5, 6):
            img.set(bx + dx, bottom + 1, hx("#A0754B" if dx < 2 else "#8A5A33"))
            img.set(bx + dx, bottom + 2, hx("#8A5A33" if dx < 2 else "#763E16"))
        for i in range(5):
            rx = bx + rng.randint(-5, 5)
            for k in range(rng.randint(2, 5)):
                img.set(rx + (k // 2) * rng.choice((-1, 1)), bottom + 3 + k, hx("#763E16"))


def _elodea(img: Img, x, base, top, ph, cols, rng, lean=3.0):
    stalk, leaf, leaf_l, tip = cols
    h = base - top
    pts = []
    for k in range(h):
        y = base - k
        t = k / max(1, h)
        dx = round(lean * t * t * math.sin(ph) + 1.6 * math.sin(k / 11 + ph) * t)
        pts.append((x + dx, y))
        img.set(x + dx, y, stalk)
    for i, (sx, sy) in enumerate(pts):
        if i < 3 or i % 3:
            continue
        side = 1 if (i // 3) % 2 else -1
        img.set(sx - 1, sy, leaf_l if i % 6 == 0 else leaf)
        img.set(sx - 2, sy - 1, leaf_l if i % 6 == 0 else leaf)
        img.set(sx + 1, sy, leaf)
        img.set(sx + 2, sy - 1, stalk)
        if side > 0 and i % 2 == 0:
            img.set(sx + 2, sy + 1, leaf)
    if pts:
        tx, ty = pts[-1]
        img.set(tx, ty - 1, tip)
        img.set(tx - 1, ty, tip)
        img.set(tx + 1, ty, leaf_l)


def draw_kraut(img: Img, layer: str):
    rng = random.Random(23 if layer == "back" else 29)
    if layer == "back":
        cols = [hx("#084647"), hx("#1E5F5B"), hx("#3E786E"), hx("#3E786E")]
        step = 2
    else:
        cols = [hx("#1E5F5B"), hx("#3A8D34"), hx("#6BA34A"), hx("#94BA61")]
        step = 5
    for (a, b) in L.KRAUT_ZONES:
        x = a + rng.randint(0, 2)
        while x < b:
            base = fy(x) + 1
            edge = min(x - a, b - x) / 30.0
            top_m = 8.0 + rng.uniform(0, 3.5) + (1 - min(1.0, edge)) * 4
            if layer == "back":
                top_m -= 0.8
            top = L.y_of(top_m) - OY
            if layer == "front" and (abs(x - L.CART_X) < 26 or abs(x - L.BIKE_X) < 22) and rng.random() < 0.75:
                x += step
                continue
            if top < base - 8:
                _elodea(img, x, base, top, rng.random() * 6.28, cols, rng, lean=rng.uniform(-3, 4))
            x += step + rng.randint(0, 2)
    # vereinzelt Kraut am Trichterrand
    if layer == "front":
        for x in (462, 470, 712, 726, 300, 310):
            base = fy(x) + 1
            _elodea(img, x, base, base - rng.randint(18, 36), rng.random() * 6, cols, rng)


def cart_sprite() -> Img:
    s = Img(46, 32, pal())
    wire, wire_l, wire_d = hx("#A4B1BC"), hx("#D3D3D0"), hx("#8D96A0")
    # Korb (Trapez), Gitter
    for y in range(2, 20):
        t = (y - 2) / 17
        x0 = round(4 + 6 * t)
        x1 = round(42 - 2 * t)
        for x in range(x0, x1 + 1):
            border = y in (2, 19) or x in (x0, x1)
            grid = (x - x0) % 4 == 0 or (y - 2) % 4 == 0
            if border:
                s.set(x, y, wire_l if y == 2 else (wire if x == x0 else wire_d))
            elif grid:
                s.set(x, y, wire_d)
    # Griff (rotes Kunststoffband) und Stange
    s.line(4, 2, 1, -1 + 2, wire)
    s.vline(1, 0, 4, hx("#C8382F"))
    s.vline(0, 1, 3, hx("#DF5F40"))
    # Fahrgestell
    s.hline(10, 40, 23, wire)
    s.line(10, 19, 8, 23, wire_d)
    s.line(40, 19, 40, 23, wire_d)
    for wx in (11, 37):
        for (px, py) in s.disc_pixels(wx + .5, 27.5, 3, 3):
            s.set(px, py, hx("#331C13"))
        s.set(wx, 27, hx("#8D96A0"))
    # Rost & Algen
    rng = random.Random(3)
    for i in range(40):
        x, y = rng.randrange(46), rng.randrange(32)
        if s.opaque(x, y):
            s.set(x, y, hx(rng.choice(["#763E16", "#0C7332", "#3A8D34", "#8A5A33"])))
    return s


def bike_sprite() -> Img:
    s = Img(42, 26, pal())
    tire, rim, spoke = hx("#331C13"), hx("#8D96A0"), hx("#737C8A")
    for (cx, cy) in ((9, 17), (33, 17)):
        for a in range(0, 360, 4):
            r = math.radians(a)
            s.set(round(cx + 7.6 * math.cos(r)), round(cy + 7.6 * math.sin(r)), tire)
            s.set(round(cx + 6.4 * math.cos(r)), round(cy + 6.4 * math.sin(r)), rim)
        for a in range(0, 360, 45):
            r = math.radians(a)
            s.line(cx, cy, cx + round(5.5 * math.cos(r)), cy + round(5.5 * math.sin(r)), spoke)
        s.set(cx, cy, hx("#A4B1BC"))
    fr, fr_l = hx("#C8382F"), hx("#DF5F40")
    s.line(9, 17, 20, 18, fr)        # Kettenstrebe
    s.line(9, 17, 16, 7, fr)         # Sitzstrebe
    s.line(16, 7, 20, 18, fr)        # Sitzrohr
    s.line(16, 7, 30, 7, fr_l)       # Oberrohr
    s.line(20, 18, 30, 8, fr)        # Unterrohr
    s.line(30, 6, 33, 17, fr)        # Gabel
    s.hline(13, 18, 4, hx("#4F2F1C"))  # Sattel
    s.vline(16, 5, 6, spoke)
    s.line(29, 5, 31, 2, spoke)      # Lenker
    s.hline(31, 35, 2, spoke)
    s.set(35, 3, hx("#331C13"))
    s.set(20, 18, hx("#A4B1BC"))    # Tretlager
    s.line(20, 18, 23, 21, spoke)
    rng = random.Random(5)
    for i in range(18):
        x, y = rng.randrange(42), rng.randrange(26)
        if s.opaque(x, y):
            s.set(x, y, hx(rng.choice(["#763E16", "#0C7332", "#3E786E"])))
    return s


def rowboat_wreck() -> Img:
    s = Img(78, 26, pal())
    # gekentertes Boot, Kiel oben: Rumpf als Halbellipse
    cx, cy, rx, ry = 38, 22, 35, 17
    for y in range(4, 23):
        for x in range(2, 76):
            dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry
            if dx * dx + dy * dy <= 1.0 and y <= cy:
                plank = (y - 4) // 3
                lv = -0.6 * dx - 0.8 * dy
                c = DH[2] if lv > 0.75 else (DH[1] if lv > 0.2 else DH[0])
                if (y - 4) % 3 == 0:
                    c = DH[0]
                if plank % 2 and lv > 0.4 and (x // 7) % 3 == 0:
                    c = "#8A5A33"
                s.set(x, y, hx(c))
    s.hline(6, 70, 22, hx(DH[0]))
    s.hline(6, 70, 21, hx(GRUND[2]))     # Dollbord, bewachsen
    # Loch im Rumpf
    for (px, py) in s.disc_pixels(50, 12, 4, 3):
        s.set(px, py, hx(GRUND[0]))
    s.set(47, 10, hx("#8A5A33"))
    s.set(53, 14, hx(DH[2]))
    # Kiel + Moos
    s.hline(18, 58, 7, hx(DH[0]))
    rng = random.Random(8)
    for i in range(70):
        x, y = rng.randrange(78), rng.randrange(4, 12)
        if s.opaque(x, y) and not s.opaque(x, y - 2):
            s.set(x, y, hx(rng.choice([GRUND[2], GRUND[3], "#3E786E"])))
    return s


def rootstock_sprite() -> Img:
    """Umgestürzter Baumstumpf: großer Wurzelteller links, kurzer Stamm nach rechts unten."""
    rng = random.Random(61)
    s = Img(72, 56, pal())
    cx, cy = 22, 22
    # Wurzeln (hinter dem Teller), dick an der Basis
    for j in range(19):
        ang = math.pi * (0.35 + 1.5 * j / 18) + rng.uniform(-0.1, 0.1)
        ln = rng.randint(10, 19)
        x, y = cx + math.cos(ang) * 8, cy + math.sin(ang) * 8
        for k in range(ln):
            x += math.cos(ang)
            y += math.sin(ang) + 0.18
            ang += rng.uniform(-0.28, 0.28)
            thick = 2 if k < ln * 0.4 else 1
            for t in range(thick):
                s.set(round(x) + (t if abs(math.sin(ang)) > 0.7 else 0),
                      round(y) + (t if abs(math.sin(ang)) <= 0.7 else 0), hx(DH[1] if k % 4 else DH[2]))
            if k == ln // 2 and rng.random() < 0.6:
                bx_, by_ = x, y
                a2 = ang + rng.choice((-0.9, 0.9))
                for m in range(rng.randint(3, 7)):
                    bx_ += math.cos(a2)
                    by_ += math.sin(a2) + 0.2
                    s.set(round(bx_), round(by_), hx(DH[1]))
    # Stamm
    sx, sy, ex, ey = cx + 4, cy + 4, 64, 46
    length = math.hypot(ex - sx, ey - sy)
    nx_, ny_ = -(ey - sy) / length, (ex - sx) / length
    for i in range(int(length) + 1):
        t = i / length
        px0, py0 = sx + (ex - sx) * t, sy + (ey - sy) * t
        r = 8.0 - 1.5 * t
        for k10 in range(-int(r * 2), int(r * 2) + 1):
            k = k10 / 2
            px, py = round(px0 + nx_ * k), round(py0 + ny_ * k)
            c = DH[2] if k <= -r + 2.5 else (DH[1] if k < r - 2 else DH[0])
            if (i % 8 == 0 and -r + 3 < k < r - 2) or (abs(k - 1) < .3 and i % 3 == 0):
                c = DH[0]
            s.set(px, py, hx(c))
    # Bruchkante am Stammende
    for k in range(-6, 7):
        s.set(round(ex + nx_ * k), round(ey + ny_ * k), hx("#8A5A33" if k < 0 else DH[2]))
    # Wurzelteller (Erdklumpen mit Wurzeln)
    for (px, py) in s.disc_pixels(cx, cy, 11, 10):
        lv = -0.6 * (px + .5 - cx) / 11 - 0.8 * (py + .5 - cy) / 10
        c = DH[2] if lv > 0.4 else (DH[1] if lv > -0.35 else DH[0])
        if rng.random() < 0.12:
            c = GRUND[1]
        s.set(px, py, hx(c))
    for k in range(6):                       # Wurzelansätze auf dem Teller
        ang = rng.uniform(0, 6.28)
        s.line(cx, cy, cx + round(math.cos(ang) * 9), cy + round(math.sin(ang) * 8), hx(DH[0]))
    # Moos auf Oberseiten
    for x in range(s.w):
        for y in range(1, s.h):
            if s.opaque(x, y) and not s.opaque(x, y - 1) and rng.random() < 0.45:
                s.set(x, y, hx(rng.choice(["#3E786E", "#5C7B6A", "#426256"])))
    s.outline(ink=hx("#12342F"))
    # alte Haken im Holz mit Schnurresten (nur auf Holz)
    spots = [(41, 27), (55, 38), (29, 15)]
    for (hx_, hy_) in spots:
        for (dx, dy) in ((0, 0), (0, 1), (0, 2), (1, 3), (2, 2), (2, 1)):
            s.set(hx_ + dx, hy_ + dy, hx("#D3D3D0" if dy < 2 else "#A4B1BC"))
        for k in range(1, rng.randint(3, 5)):
            s.set(hx_ - (k // 3), hy_ - k, hx("#B4B8BE"))
    # verlorene Pose im Wurzelwerk
    px_, py_ = 6, 8
    s.rect(px_, py_, px_ + 1, py_ + 1, hx("#DF5F40"))
    s.rect(px_, py_ + 2, px_ + 1, py_ + 3, hx("#F2EFE2"))
    s.set(px_ + 1, py_ + 1, hx("#C8382F"))
    s.set(px_ + 1, py_ + 3, hx("#D3D3D0"))
    s.vline(px_, py_ - 3, py_ - 1, hx("#B4B8BE"))
    return s


def draw_rootstock(img: Img):
    spr = rootstock_sprite()
    x0 = L.ROOTSTOCK_X
    top = fy(x0 + 10)
    img.blit(spr, x0 - 22, top - 30)


def _oar(img: Img, x, y):
    img.line(x - 4, y - 1, x + 18, y - 9, hx(DH[1]))
    img.line(x - 4, y - 2, x + 18, y - 10, hx(DH[2]))
    for k in range(5):
        img.vline(x + 16 + k, y - 13 + (k // 2), y - 8 + k // 3, hx(DH[1] if k < 4 else DH[0]))


def place_on_floor(img: Img, spr: Img, cx, sink=3, rot=0.0):
    if rot:
        spr = rotate_pixel(spr, rot)
    bottom = fy(cx)
    x0 = cx - spr.w // 2
    y0 = bottom - spr.h + sink
    img.blit(spr, x0, y0)
    # Schlamm über den eingesunkenen Teil
    for x in range(x0 - 2, x0 + spr.w + 2):
        top = fy(x)
        for y in range(top, top + sink + 1):
            d = L.floor_depth_m(x)
            img.set(x, y, ground_color(x, y, top, d, 0))


def lakebed() -> Img:
    img = Img(W, H, pal(), wrap=True)
    draw_kraut(img, "back")
    draw_piles(img)
    draw_lily_stems(img)
    draw_ground(img)
    draw_earth_details(img)
    place_on_floor(img, cart_sprite(), L.CART_X, sink=4, rot=-9)
    place_on_floor(img, bike_sprite(), L.BIKE_X, sink=5, rot=14)
    place_on_floor(img, rowboat_wreck(), L.ROWBOAT_X, sink=3, rot=4)
    _oar(img, L.ROWBOAT_X + 46, fy(L.ROWBOAT_X + 46))
    draw_rootstock(img)
    draw_kraut(img, "front")
    return img

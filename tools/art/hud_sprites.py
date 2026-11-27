"""HUD-Grafiken (Atlas `atlas_hud`, Palette `hud`) in Holz-Messing-Optik (B5) + 9-Slice-Rahmen fürs HTML-UI.

Alle Balkenrahmen sind deckend mit dunkler Rinne; das Spiel zeichnet die Füllung (Sprite mit setCrop
oder Kachel-Sprites) in das dokumentierte Fenster `fenster` (Anker in der Atlas-JSON).
"""
from __future__ import annotations

import math

from pixkit import Img, Pal, bayer
from see_sprites import Sprite

PAL = None


def pal() -> Pal:
    global PAL
    if PAL is None:
        PAL = Pal("hud")
    return PAL


def R(name, i):
    return pal()(name, i)


def S(w, h) -> Img:
    return Img(w, h, pal())


# --------------------------------------------------------------------------- Bausteine

def brass_frame(img: Img, x0, y0, x1, y1, inner=None, rivets=True):
    """Messingrahmen 2 px: außen dunkel, innen Glanz oben/links, Schatten unten/rechts."""
    m = [R("Messing", i) for i in range(5)]
    for x in range(x0, x1 + 1):
        img.set(x, y0, m[1])
        img.set(x, y0 + 1, m[4] if x0 < x < x1 else m[2])
        img.set(x, y1 - 1, m[1])
        img.set(x, y1, m[0])
    for y in range(y0, y1 + 1):
        img.set(x0, y, m[1])
        img.set(x0 + 1, y, m[3] if y0 < y < y1 else m[2])
        img.set(x1 - 1, y, m[1] if y0 + 1 < y < y1 - 1 else img.get(x1 - 1, y))
        img.set(x1, y, m[0])
    img.set(x0 + 1, y0 + 1, m[4])
    if inner is not None:
        img.rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2, inner)
    if rivets:
        for (x, y) in ((x0 + 1, y0 + 1), (x1 - 1, y0 + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)):
            img.set(x, y, m[4] if (x, y) == (x0 + 1, y0 + 1) else m[2])


def wood_fill(img: Img, x0, y0, x1, y1, horizontal=True):
    h = [R("Holz", i) for i in range(5)]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            k = (y - y0) if horizontal else (x - x0)
            band = k % 5
            c = h[3] if band == 0 else (h[2] if band < 4 else h[1])
            if band == 2 and ((x if horizontal else y) * 7 + k * 3) % 23 == 0:
                c = h[1]            # Astlöcher/Maserung
            img.set(x, y, c)


def trough(img: Img, x0, y0, x1, y1):
    """Dunkle Rinne mit Schatten oben/links (vertieft)."""
    img.rect(x0, y0, x1, y1, R("Tinte", 1))
    img.hline(x0, x1, y0, R("Tinte", 0))
    img.vline(x0, y0, y1, R("Tinte", 0))


# --------------------------------------------------------------------------- Elemente

def panel_wood():
    img = S(24, 24)
    wood_fill(img, 0, 0, 23, 23)
    brass_frame(img, 0, 0, 23, 23)
    return img


def power_frame():
    img = S(14, 74)
    wood_fill(img, 0, 0, 13, 73, horizontal=False)
    brass_frame(img, 0, 0, 13, 73)
    trough(img, 3, 4, 10, 69)
    for y in range(4 + 8, 69, 8):                   # Skalenstriche rechts
        img.set(12, y, R("Messing", 4))
    return img, {"fenster": {"x": 3, "y": 5, "w": 8, "h": 64}}


def power_fill():
    img = S(8, 64)
    stops = [R("Messing", 4), R("Messing", 3), R("Orange", 2), R("Warngelb", 1), R("Gruen", 2),
             R("Gruen", 1), R("Gruen", 0)]
    n = len(stops) - 1
    for y in range(64):
        pos = y / 63 * n
        seg = min(n - 1, int(pos))
        f = pos - seg
        for x in range(8):
            c = stops[seg + 1] if bayer(x, y, f) else stops[seg]
            if x == 0:
                c = pal().step(c, 1)
            if x == 7:
                c = pal().step(c, -1)
            img.set(x, y, c)
    return img


def power_marker():
    img = S(16, 5)
    m = [R("Messing", i) for i in range(5)]
    img.hline(0, 15, 2, m[3])
    img.hline(1, 14, 1, m[4])
    img.hline(1, 14, 3, m[1])
    for (x, y) in ((0, 1), (0, 3), (15, 1), (15, 3)):
        img.set(x, y, m[0])
    img.set(0, 2, m[2])
    img.set(15, 2, m[0])
    img.outline()
    return img


def tension_frame():
    img = S(168, 16)
    wood_fill(img, 0, 0, 167, 15)
    brass_frame(img, 0, 0, 167, 15)
    trough(img, 3, 3, 164, 12)
    return img, {"fenster": {"x": 4, "y": 4, "w": 160, "h": 8}}


def zone_tile(ramp):
    img = S(4, 8)
    for y in range(8):
        for x in range(4):
            c = R(ramp, 2) if y < 2 else (R(ramp, 1) if y < 6 else R(ramp, 0))
            if y == 0:
                c = R(ramp, 3) if ramp != "Tinte" else R("Holz", 0)
            img.set(x, y, c)
    return img


def needle():
    img = S(7, 16)
    m = [R("Messing", i) for i in range(5)]
    img.vline(3, 2, 13, m[3])
    img.vline(2, 3, 12, m[4])
    img.vline(4, 3, 12, m[1])
    img.hline(1, 5, 0, m[2])
    img.hline(2, 4, 1, m[3])
    img.hline(1, 5, 15, m[2])
    img.hline(2, 4, 14, m[3])
    img.outline()
    return img


def distance_frame():
    img = S(104, 10)
    wood_fill(img, 0, 0, 103, 9)
    brass_frame(img, 0, 0, 103, 9, rivets=False)
    trough(img, 3, 3, 100, 6)
    return img, {"fenster": {"x": 4, "y": 4, "w": 96, "h": 2}}


def distance_fill():
    img = S(4, 2)
    img.hline(0, 3, 0, R("Wasser", 3))
    img.hline(0, 3, 1, R("Wasser", 2))
    return img


def icon_fish():
    img = S(11, 8)
    w = [R("Wasser", i) for i in range(4)]
    for (px, py) in img.disc_pixels(5, 4, 3.6, 2.4):
        img.set(px, py, w[3] if py < 4 else w[2])
    img.vline(1, 2, 5, w[1])
    img.vline(0, 1, 6, w[1])
    img.set(7, 3, R("Tinte", 0))
    img.outline()
    return img


def icon_boat():
    img = S(12, 8)
    h = [R("Holz", i) for i in range(5)]
    for y in range(4, 7):
        img.hline(1 + (y - 4), 10 - (y - 4), y, h[3] if y == 4 else h[2])
    img.vline(5, 0, 3, h[4])
    img.hline(6, 8, 1, R("Wolke", 2))
    img.hline(6, 7, 2, R("Wolke", 1))
    img.outline()
    return img


def depth_scale():
    img = S(20, 132)
    wood_fill(img, 0, 0, 19, 131, horizontal=False)
    brass_frame(img, 0, 0, 19, 131)
    trough(img, 3, 4, 12, 127)
    for i in range(11):                             # 10 Abschnitte, jeder 5. lang
        y = 5 + i * 12
        ln = 4 if i % 5 == 0 else 2
        img.hline(14, 14 + ln - 1 if i % 5 else 17, min(y, 126), R("Messing", 4))
    return img, {"fenster": {"x": 4, "y": 5, "w": 8, "h": 120}}


def depth_fill_see(layers):
    """Farbige Tiefenschichten von W1 für das Fenster der Tiefenanzeige (8×120, 25 m)."""
    img = S(8, 120)
    cols = {"Uferzone": R("Wasser", 3), "Freiwasser": R("Wasser", 1), "Krautfeld": R("Gruen", 0),
            "Tiefes Loch": R("Wasser", 0)}
    total = layers[-1][2]
    for (name, a, b, _) in layers:
        y0, y1 = round(a / total * 120), round(b / total * 120) - 1
        for y in range(y0, y1 + 1):
            for x in range(8):
                c = cols[name]
                if name == "Tiefes Loch" and bayer(x, y, (y - y0) / max(1, y1 - y0) * 0.75):
                    c = R("Tinte", 1)
                img.set(x, y, c if x else pal().step(c, 1))
        img.hline(0, 7, y1, pal().step(cols[name], -1))
    return img


def depth_marker():
    img = S(9, 7)
    m = [R("Messing", i) for i in range(5)]
    for i in range(4):
        img.vline(i, 3 - i, 3 + i, m[3] if i < 2 else m[2])
    img.rect(4, 2, 7, 4, m[2])
    img.hline(4, 7, 2, m[4])
    img.set(6, 3, R("Signalrot", 1))
    img.set(7, 3, R("Signalrot", 0))
    img.outline()
    return img


def arrow(direction, hi):
    img = S(17, 17)
    body = [R("Orange", 0), R("Orange", 1), R("Orange", 2)] if not hi else \
        [R("Warngelb", 0), R("Warngelb", 1), R("Warngelb", 2)]
    s = 1 if hi else 0
    pts = []
    # Pfeil nach rechts als Grundform, danach drehen
    for y in range(17):
        for x in range(17):
            dy = abs(y - 8)
            head = 8 - s <= x <= 15 and dy <= (15 - x) * 0.9 + s * 0.5
            shaft = 1 + (1 - s) <= x < 9 and dy <= 2 + s
            if head or shaft:
                pts.append((x, y))
    for (x, y) in pts:
        lv = -(y - 8) / 8
        c = body[2] if lv > 0.25 else (body[1] if lv > -0.35 else body[0])
        if direction == "right":
            img.set(x, y, c)
        elif direction == "left":
            img.set(16 - x, y, c)
        else:  # down
            img.set(16 - y, x, c if True else c)
    img.outline()
    return img


FIN = [
    ".......rr",
    "......rrr",
    ".....rrr.",
    "rrrrrrr..",
    "rrrrrr...",
    "rrrrrrr..",
    ".....rrr.",
    "......rrr",
    ".......rr",
]


def fin_icon(state):
    """Schwanzflosse (Ausdauer): voll, halb (linke Hälfte), leer."""
    img = S(11, 11)
    w = [R("Wasser", i) for i in range(4)]
    for y, row in enumerate(FIN):
        for x, ch in enumerate(row):
            if ch != "r":
                continue
            filled = state == "full" or (state == "half" and x <= 4)
            if filled:
                c = w[3] if y < 4 else w[2]
                if (x == 6 and y in (1, 7)) or (x in (2, 4) and y == 4):
                    c = w[1]                        # Flossenstrahlen
            else:
                c = R("Tinte", 1)
            img.set(x + 1, y + 1, c)
    img.outline()
    return img


def item_slot(active):
    img = S(30, 30)
    wood_fill(img, 0, 0, 29, 29)
    brass_frame(img, 0, 0, 29, 29)
    if active:
        g = [R("Warngelb", 1), R("Warngelb", 2)]
        for i in range(30):
            for (x, y) in ((i, 1), (i, 28), (1, i), (28, i)):
                if 1 <= x <= 28 and 1 <= y <= 28:
                    img.set(x, y, g[1] if (x + y) % 2 else g[0])
    trough(img, 4, 4, 25, 25)
    return img, {"fenster": {"x": 5, "y": 5, "w": 20, "h": 20}}


BANG = [
    "..ooo..",
    ".oHHmo.",
    ".oHmmo.",
    ".oHmmo.",
    ".oHmmo.",
    ".oHmmo.",
    "..omo..",
    "..omo..",
    "..omo..",
    "...o...",
    ".......",
    "..ooo..",
    ".oHmmo.",
    ".ommdo.",
    "..ooo..",
]


BANG_S = [
    ".ooo.",
    "oHmmo",
    "oHmmo",
    "oHmmo",
    ".omo.",
    ".omo.",
    "..o..",
    ".....",
    ".ooo.",
    "oHmdo",
    ".ooo.",
]


def bang(ramp, frame):
    """Biss-„!“: Frame 0 klein, 1 groß (2 px höher), 2 normal – ohne Skalierung (gleiche Pixelgröße)."""
    from pixkit import from_map
    lg = {"o": R("Tinte", 0), "H": R(ramp, 3), "m": R(ramp, 1), "d": R(ramp, 0)}
    img = S(9, 20)
    if frame == 0:
        base = from_map(BANG_S, lg, pal())
        img.blit(base, 2, 20 - 11 - 1)
    else:
        base = from_map(BANG, lg, pal())
        img.blit(base, 1, 20 - 15 - (3 if frame == 1 else 1))
    return img


def nibble_dots(frame):
    img = S(15, 5)
    for i in range(frame + 1):
        x = 1 + i * 5
        img.rect(x, 1, x + 2, 3, R("Wolke", 2))
        img.set(x, 1, R("Wolke", 2))
        img.hline(x, x + 1, 1, R("Pergament", 3))
    img.outline(ink=R("Tinte", 0))
    return img


def sparkle(frame):
    img = S(17, 17)
    g = [R("Messing", 4), R("Warngelb", 2), R("Messing", 3)]
    r = [3, 7, 8, 5][frame]
    c = 8
    for k in range(r):
        col = g[0] if k < r // 2 else g[2]
        for (dx, dy) in ((k, 0), (-k, 0), (0, k), (0, -k)):
            img.set(c + dx, c + dy, col)
    d = [1, 3, 4, 2][frame]
    for k in range(1, d + 1):
        for (dx, dy) in ((k, k), (-k, k), (k, -k), (-k, -k)):
            img.set(c + dx, c + dy, g[1])
    if frame in (1, 2):
        for (x, y) in ((2, 3), (14, 12), (13, 2), (3, 14))[:frame + 1]:
            img.set(x, y, g[0])
    img.set(c, c, R("Pergament", 3))
    return img


RARITY_SHAPES = ["kreis", "dreieck", "raute", "stern", "krone"]
RARITY_RAMPS = ["Gewoehnlich", "Ungewoehnlich", "Selten", "Episch", "Legendaer"]
RARITY_KEYS = ["gewoehnlich", "ungewoehnlich", "selten", "episch", "legendaer"]


def rarity_icon(i):
    img = S(13, 13)
    ramp = RARITY_RAMPS[i]
    shape = RARITY_SHAPES[i]
    c0, c1, c2 = R(ramp, 0), R(ramp, 1), R(ramp, 2)
    pts = []
    cx = cy = 6
    for y in range(13):
        for x in range(13):
            dx, dy = x - cx, y - cy
            if shape == "kreis":
                ok = dx * dx + dy * dy <= 20
            elif shape == "dreieck":
                ok = 1 <= y <= 11 and abs(dx) <= (y - 1) * 0.55
            elif shape == "raute":
                ok = abs(dx) + abs(dy) <= 5
            elif shape == "stern":
                a = math.atan2(dy, dx) + math.pi / 2
                rr = math.hypot(dx, dy)
                lim = 2.4 + 3.4 * (0.5 + 0.5 * math.cos(5 * a))
                ok = rr <= lim
            else:  # krone
                ok = (6 <= y <= 10 and 1 <= x <= 11) or (y >= 2 and y < 6 and x in (1, 2, 5, 6, 7, 10, 11)
                                                       and (y >= 4 or x in (1, 6, 11)))
            if ok:
                pts.append((x, y))
    for (x, y) in pts:
        lv = -0.6 * (x - cx) / 6 - 0.8 * (y - cy) / 6
        img.set(x, y, c2 if lv > 0.3 else (c1 if lv > -0.4 else c0))
    if shape == "krone":
        img.set(4, 8, R("Signalrot", 1))
        img.set(8, 8, R("Selten", 1))
    img.outline(ink=R("Tinte", 0))
    return img


def wind_arrow(direction, frame):
    img = S(18, 9)
    w = [R("Wolke", 0), R("Wolke", 1), R("Wolke", 2)]
    for x in range(1, 12):
        wav = 1 if ((x + frame * 3) // 3) % 2 else 0
        img.set(x, 3 + wav, w[2])
        img.set(x, 4 + wav, w[1])
    for k in range(5):                              # Spitze
        img.vline(11 + k, 4 - (4 - k), 4 + (4 - k), w[2] if k < 2 else w[1])
    img.outline(ink=R("Tinte", 0))
    if direction == "left":
        o = S(18, 9)
        o.blit(img, 0, 0, flip=True)
        return o
    return img


def clock_icon():
    img = S(13, 13)
    for (px, py) in img.disc_pixels(6.5, 6.5, 5.6, 5.6):
        img.set(px, py, R("Messing", 3) if px + py < 11 else R("Messing", 2))
    for (px, py) in img.disc_pixels(6.5, 6.5, 4.2, 4.2):
        img.set(px, py, R("Pergament", 3) if px + py < 12 else R("Pergament", 2))
    img.vline(6, 3, 6, R("Tinte", 0))
    img.hline(6, 9, 6, R("Tinte", 0))
    img.outline()
    return img


# --------------------------------------------------------------------------- 9-Slice fürs HTML-UI

def frame_wood_9slice():
    """24×24, Slice 8 px (Ecken 8×8 mit Messingbeschlag). Randstücke und Mitte kacheln mit 8 px Periode."""
    img = S(24, 24)
    h = [R("Holz", i) for i in range(5)]
    for y in range(24):
        for x in range(24):
            edge = min(x, y, 23 - x, 23 - y)
            if edge == 0:
                c = R("Tinte", 0)
            elif edge == 1:
                c = h[4] if (x < 12 and y < 12) else h[3]
            elif edge < 6:
                vertical = min(x, 23 - x) < min(y, 23 - y)
                k = x if vertical else y
                c = h[3] if k % 4 == 2 else (h[2] if k % 4 != 1 else h[1])
            elif edge == 6:
                c = h[0]
            elif edge == 7:
                c = R("Tinte", 1)
            else:                                  # Mitte: Bohlen, Periode 4 (passt in 8)
                c = h[2] if y % 4 == 0 else (h[1] if y % 4 < 3 else h[0])
            img.set(x, y, c)
    for (x, y) in ((1, 1), (17, 1), (1, 17), (17, 17)):   # Messingbeschläge 6×6
        brass_frame(img, x, y, x + 5, y + 5, inner=R("Messing", 2), rivets=False)
        img.set(x + 2, y + 2, R("Messing", 4))
        img.set(x + 3, y + 3, R("Messing", 0))
    return img


def frame_parchment_9slice():
    """24×24, Slice 8 px. Pergament mit Tinten-/Holzrand und Eckornament; Mitte kachelt (Bayer, Periode 2)."""
    img = S(24, 24)
    p = [R("Pergament", i) for i in range(4)]
    for y in range(24):
        for x in range(24):
            edge = min(x, y, 23 - x, 23 - y)
            if edge == 0:
                c = R("Tinte", 0)
            elif edge == 1:
                c = p[0]
            elif edge < 4:
                c = p[1] if bayer(x, y, 0.5) else p[2]
            elif edge == 4:
                c = R("Holz", 2)
            else:
                c = p[3] if bayer(x, y, 0.75) else p[2]
            img.set(x, y, c)
    for (cx, cy, sx, sy) in ((5, 5, 1, 1), (18, 5, -1, 1), (5, 18, 1, -1), (18, 18, -1, -1)):
        img.set(cx + sx, cy + sy, R("Holz", 1))
        img.set(cx + 2 * sx, cy + sy, R("Holz", 1))
        img.set(cx + sx, cy + 2 * sy, R("Holz", 1))
        img.set(cx + 2 * sx, cy + 2 * sy, R("Holz", 0))
    return img


FRAMES_9SLICE = {
    "frame_wood": {"datei": "frame_wood.png", "groesse": [24, 24], "slice": 8,
                   "css": "border: 8px solid transparent; border-image: url(frame_wood.png) 8 fill / 8px round; "
                          "image-rendering: pixelated",
                   "hinweis": "Ecken 8×8; Randbreite in CSS = 8 px × ganzzahliger Zoom; Mitte kachelt (Periode 4)"},
    "frame_parchment": {"datei": "frame_parchment.png", "groesse": [24, 24], "slice": 8,
                        "css": "border: 8px solid transparent; border-image: url(frame_parchment.png) 8 fill / 8px "
                               "round; image-rendering: pixelated",
                        "hinweis": "Lexikon/Pergament; Ecken 8×8; Mitte kachelt (Bayer, Periode 2)"},
}


# --------------------------------------------------------------------------- Liste

def all_sprites(depth_layers) -> list[Sprite]:
    out = []
    out.append(Sprite("hud_panel_wood_still", [panel_wood()], anchors={"slice": {"x": 8, "y": 8}},
                      note="Phaser NineSlice: left/right/top/bottom = 8"))
    f, a = power_frame()
    out.append(Sprite("hud_power_frame_still", [f], anchors=a, note="Wurfkraft-Balken (senkrecht)"))
    out.append(Sprite("hud_power_fill_still", [power_fill()], note="Füllung von unten per setCrop"))
    out.append(Sprite("hud_power_marker_still", [power_marker()], note="Perfekt-Fenster-Marke (Rute)"))
    f, a = tension_frame()
    out.append(Sprite("hud_tension_frame_still", [f], anchors=a, note="Spannungsbalken-Rahmen"))
    for key, ramp in (("gruen", "Gruen"), ("gelb", "Warngelb"), ("rot", "Signalrot"), ("leer", "Tinte")):
        out.append(Sprite(f"hud_tension_zone_{key}_still", [zone_tile(ramp)], note="4×8-Kachel, waagerecht ganzzahlig wiederholen"))
    out.append(Sprite("hud_tension_needle_still", [needle()], anchors={"spitze": {"x": 3, "y": 8}}))
    f, a = distance_frame()
    out.append(Sprite("hud_distance_frame_still", [f], anchors=a))
    out.append(Sprite("hud_distance_fill_still", [distance_fill()]))
    out.append(Sprite("hud_icon_fisch_still", [icon_fish()]))
    out.append(Sprite("hud_icon_boot_still", [icon_boat()]))
    out.append(Sprite("hud_icon_uhr_still", [clock_icon()]))
    f, a = depth_scale()
    out.append(Sprite("hud_depth_scale_still", [f], anchors=a, note="10 Abschnitte, Weltwerte aus world_<k>.json"))
    out.append(Sprite("hud_depth_fill_see_still", [depth_fill_see(depth_layers)], note="Tiefenschichten W1 (0–25 m)"))
    out.append(Sprite("hud_depth_marker_still", [depth_marker()], anchors={"spitze": {"x": 0, "y": 3}}))
    for d in ("left", "right", "down"):
        out.append(Sprite(f"hud_arrow_{d}_pulse", [arrow(d, False), arrow(d, True)], fps=6, yoyo=True))
    for st in ("full", "half", "empty"):
        out.append(Sprite(f"hud_stamina_{st}_still", [fin_icon(st)]))
    f, a = item_slot(False)
    out.append(Sprite("hud_itemslot_still", [f], anchors=a))
    f, a = item_slot(True)
    out.append(Sprite("hud_itemslot_active_still", [f], anchors=a))
    out.append(Sprite("hud_bite_pop", [bang("Signalrot", i) for i in range(3)], fps=12, loop=False))
    out.append(Sprite("hud_fake_pop", [bang("Orange", i) for i in range(3)], fps=12, loop=False))
    out.append(Sprite("hud_nibble_dots", [nibble_dots(i) for i in range(3)], fps=4))
    out.append(Sprite("hud_sparkle_perfect", [sparkle(i) for i in range(4)], fps=12, loop=False))
    for i, k in enumerate(RARITY_KEYS):
        out.append(Sprite(f"hud_rarity_{k}_still", [rarity_icon(i)], note=f"Form: {RARITY_SHAPES[i]}"))
    for d in ("right", "left"):
        out.append(Sprite(f"hud_wind_{d}_flutter", [wind_arrow(d, 0), wind_arrow(d, 1)], fps=4))
    return out

"""Layout von Welt 1 „Sonnenspiegelsee“ (Querschnitt) – eine Quelle für Ebenen, Deko und world_see.json.

Koordinaten in Spielpixeln (interne Auflösung 640×360 / 360×640, B3). Die Welt ist 960×640:
  y 0..119   Himmel, Ferne, Ufer, Bootshaus/Steg, Boote
  y 120      Wasseroberfläche (0 m)
  y 120..620 Wasser bis 25 m  (PIXELS_PER_METER = 20)
  y 620..639 Grund unter dem tiefsten Punkt
Im Querformat zeigt die Kamera bei 0 m y 0..359 (Oberfläche bei y = 120), beim Sinken scrollt sie
bis scrollY = 280 (25 m im Bild). Im Hochformat (360×640) ist die ganze Höhe sichtbar.
"""
from __future__ import annotations

import math

WORLD_W = 960
WORLD_H = 640
SURFACE_Y = 120
PPM = 20                      # Spielpixel pro Meter (senkrecht und waagerecht)
MAX_DEPTH_M = 25

DEPTH_LAYERS = [
    # Name, min m, max m, HUD-Farbe (aus see.json)
    ("Uferzone", 0, 3, "#67C2B6"),
    ("Freiwasser", 3, 8, "#138C90"),
    ("Krautfeld", 8, 15, "#3A8D34"),
    ("Tiefes Loch", 15, 25, "#2A4B42"),
]

# Seeboden-Profil: (x, Tiefe in m), periodisch über 960 px (x = 960 ≙ x = 0)
FLOOR_POINTS = [
    (0, 3.3), (40, 3.5), (80, 3.2), (120, 3.6), (160, 3.4), (200, 3.6), (240, 3.3), (268, 3.9),
    (290, 5.4), (308, 8.6), (326, 12.4), (344, 14.6), (370, 15.2), (410, 14.9), (445, 15.2),
    (468, 17.0), (490, 20.2), (512, 23.4), (536, 24.8), (570, 25.0), (620, 25.0), (655, 24.6),
    (684, 22.6), (708, 19.2), (730, 16.0), (752, 14.8), (800, 15.0), (850, 14.7), (880, 13.2),
    (905, 9.6), (925, 6.2), (942, 4.2),
]

# Spielerplätze (x = Mitte der Figur, y = Sitzfläche bzw. Wasserlinie)
PLAYER_SPOTS = [
    {"id": "steg_1", "typ": "steg", "x": 124, "y": 104, "blick": "rechts"},
    {"id": "steg_2", "typ": "steg", "x": 176, "y": 104, "blick": "rechts"},
    {"id": "boot_1", "typ": "boot", "x": 330, "y": 120, "blick": "rechts"},
    {"id": "boot_2", "typ": "boot", "x": 412, "y": 120, "blick": "rechts"},
]

# Steg-Pfähle (Weltkoordinate x der linken Kante, Breite 4); die ersten vier tragen das Bootshaus
PILES = [10, 34, 58, 84, 100, 126, 152, 178, 202]
STEG_X0, STEG_X1, STEG_DECK_Y = 92, 208, 104

# Seerosen an der Oberfläche (x-Mitte, Variante) – Stiele sind im Seegrund gebacken
LILIES = [(214, "a"), (232, "c"), (251, "b"), (270, "a"), (287, "c")]
LILY_FLOWERS = [232, 270]

KRAUT_ZONES = [(330, 466), (742, 886)]          # x-Bereiche des Krautfelds
CART_X, BIKE_X = 392, 806
ROWBOAT_X, ROOTSTOCK_X = 596, 492


def y_of(m: float) -> int:
    return SURFACE_Y + int(round(m * PPM))


def _catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def floor_depth_m(x: float) -> float:
    """Seeboden-Tiefe in Metern an x (periodisch, Catmull-Rom)."""
    pts = FLOOR_POINTS
    n = len(pts)
    x = x % WORLD_W
    for i in range(n):
        xa = pts[i][0]
        xb = pts[(i + 1) % n][0] + (WORLD_W if i + 1 >= n else 0)
        if xa <= x < xb or (i == n - 1 and x >= xa):
            t = (x - xa) / (xb - xa)
            d = _catmull(pts[(i - 1) % n][1], pts[i][1], pts[(i + 1) % n][1], pts[(i + 2) % n][1], t)
            return max(0.5, min(MAX_DEPTH_M, d))
    return pts[0][1]


def floor_y(x: float) -> int:
    return y_of(floor_depth_m(x))


def floor_polyline(step: int = 8) -> list[list[int]]:
    return [[x, floor_y(x)] for x in range(0, WORLD_W + 1, step)]


def lily_zone():
    return {"id": "seerosen", "typ": "seerosen", "x": 200, "y": SURFACE_Y, "w": 100, "h": 3 * PPM,
            "tiefeM": [0, 3]}


def cover_zones():
    zones = [lily_zone()]
    for i, (a, b) in enumerate(KRAUT_ZONES):
        zones.append({"id": f"kraut_{i + 1}", "typ": "kraut", "x": a, "y": y_of(8), "w": b - a,
                      "h": y_of(15.4) - y_of(8), "tiefeM": [8, 15]})
    zones.append({"id": "wurzelstock", "typ": "kraut", "x": ROOTSTOCK_X - 34, "y": y_of(16.5), "w": 72,
                  "h": y_of(23) - y_of(16.5), "tiefeM": [16.5, 23]})
    return zones


def wave(x, period, amp, phase=0.0):
    return amp * math.sin(2 * math.pi * x / period + phase)

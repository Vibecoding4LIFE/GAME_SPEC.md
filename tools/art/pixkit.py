"""Pixel-Werkzeugkasten für Welt-, Figuren- und HUD-Grafiken (Style Guide F1, prozedural F7/F8.6).

Harte Regeln, die hier erzwungen werden (Verstoß = Ausnahme beim Speichern):
- jede Farbe stammt aus den erlaubten Paletten (art_src/palettes/*.json)
- Alpha ist binär (0 oder 255)
- kein #000000; #FFFFFF nur als Augenlicht (Anzahl muss zu `eyes` passen)
- 2×2-Bayer nur über `bayer()` (geordnet, nie Fehlerdiffusion)

Licht kommt immer von oben links: `outline()` setzt die selektive Outline (oben/links eine Stufe
heller, unten/rechts in der dunkelsten Stufe der angrenzenden Rampe).
"""
from __future__ import annotations

import json
import math
import os
import random

from PIL import Image, ImageDraw

import common as C

WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)
BAYER2 = ((0, 2), (3, 1))


def bayer(x: int, y: int, t: float) -> bool:
    """True, wenn an (x, y) die hellere/nächste Farbe gesetzt wird (t = Anteil 0..1)."""
    return t > (BAYER2[y & 1][x & 1] + 0.5) / 4.0


# --------------------------------------------------------------------------- Paletten

class Pal:
    """Rampen aus einer oder mehreren Paletten-Dateien; Zugriff pal('Holz', 2) → RGBA."""

    def __init__(self, *names: str):
        self.names = names
        self.ramps: dict[str, list[tuple]] = {}
        for n in names:
            with open(os.path.join(C.PAL_DIR, f"{n}.json"), encoding="utf-8") as f:
                data = json.load(f)
            for r in data["ramps"]:
                self.ramps[r["name"]] = [C.hex_to_rgb(c) + (255,) for c in r["colors"]]
        self.allowed = {c[:3] for r in self.ramps.values() for c in r}
        self.where: dict[tuple, tuple[str, int]] = {}
        for name, cols in self.ramps.items():
            for i, c in enumerate(cols):
                self.where.setdefault(c[:3], (name, i))

    def __call__(self, ramp: str, idx: int) -> tuple:
        r = self.ramps[ramp]
        return r[max(0, min(len(r) - 1, idx))]

    def ramp(self, name: str) -> list[tuple]:
        return self.ramps[name]

    def step(self, c: tuple, d: int) -> tuple:
        """Farbe c in ihrer Rampe um d Stufen verschieben."""
        if c[3] == 0 or c[:3] not in self.where:
            return c
        n, i = self.where[c[:3]]
        return self(n, i + d)


# --------------------------------------------------------------------------- Rauschen

def pnoise1(x: float, period: int, seed: int) -> float:
    """Periodisches 1D-Wertrauschen (0..1), Periode in Gitterzellen → nahtlos kachelbar."""
    rng_vals = _lattice(seed, period)
    i = math.floor(x)
    f = x - i
    a = rng_vals[i % period]
    b = rng_vals[(i + 1) % period]
    t = f * f * (3 - 2 * f)
    return a + (b - a) * t


_LAT: dict = {}


def _lattice(seed: int, period: int) -> list[float]:
    k = (seed, period)
    if k not in _LAT:
        r = random.Random(seed * 7919 + period)
        _LAT[k] = [r.random() for _ in range(period)]
    return _LAT[k]


def fbm1(x: float, width: int, base_cells: int, seed: int, octaves: int = 3) -> float:
    """Kachelbares fBm über `width` Pixel: Oktave k hat base_cells·2^k Zellen auf die Breite."""
    tot, amp, norm = 0.0, 1.0, 0.0
    for k in range(octaves):
        cells = base_cells * (2 ** k)
        tot += amp * pnoise1(x / width * cells, cells, seed + k * 101)
        norm += amp
        amp *= 0.5
    return tot / norm


# --------------------------------------------------------------------------- Bild

class Img:
    def __init__(self, w: int, h: int, pal: Pal, wrap: bool = False, fill=None):
        self.w, self.h, self.pal, self.wrap = w, h, pal, wrap
        self.im = Image.new("RGBA", (w, h), fill if fill else CLEAR)
        self.px = self.im.load()

    # Grundoperationen -------------------------------------------------------
    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def set(self, x, y, c):
        x, y = int(x), int(y)
        if self.wrap:
            x %= self.w
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = c

    def get(self, x, y):
        x, y = int(x), int(y)
        if self.wrap:
            x %= self.w
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return CLEAR

    def opaque(self, x, y) -> bool:
        return self.get(x, y)[3] == 255

    def rect(self, x0, y0, x1, y1, c):
        """Gefülltes Rechteck inkl. x1/y1."""
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.set(x, y, c)

    def hline(self, x0, x1, y, c):
        for x in range(int(min(x0, x1)), int(max(x0, x1)) + 1):
            self.set(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(int(min(y0, y1)), int(max(y0, y1)) + 1):
            self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def polyline(self, pts, c):
        for (a, b) in zip(pts, pts[1:]):
            self.line(a[0], a[1], b[0], b[1], c)

    def mask_of(self, draw_fn) -> list[tuple[int, int]]:
        """Pixel einer Pillow-Form (aliasfrei) als Liste; draw_fn(ImageDraw) zeichnet mit fill=1."""
        m = Image.new("1", (self.w, self.h), 0)
        draw_fn(ImageDraw.Draw(m))
        mp = m.load()
        return [(x, y) for y in range(self.h) for x in range(self.w) if mp[x, y]]

    def poly(self, pts, c):
        pts = [(round(x), round(y)) for x, y in pts]
        if self.wrap:
            for off in (-self.w, 0, self.w):
                self._poly(pts, c, off)
        else:
            self._poly(pts, c, 0)

    def _poly(self, pts, c, off):
        xs = [p[0] + off for p in pts]
        if max(xs) < 0 or min(xs) >= self.w:
            return
        d = ImageDraw.Draw(self.im)
        d.polygon([(x + off, y) for x, y in pts], fill=c)

    def ellipse(self, cx, cy, rx, ry, c):
        """Gefüllte Ellipse über Pixelmitten-Regel (symmetrisch, ohne Pillow-Eigenheiten)."""
        for y in range(int(math.floor(cy - ry)) - 1, int(math.ceil(cy + ry)) + 2):
            for x in range(int(math.floor(cx - rx)) - 1, int(math.ceil(cx + rx)) + 2):
                dx = (x + 0.5 - cx) / max(rx, 0.01)
                dy = (y + 0.5 - cy) / max(ry, 0.01)
                if dx * dx + dy * dy <= 1.0:
                    self.set(x, y, c)

    def disc_pixels(self, cx, cy, rx, ry):
        out = []
        for y in range(int(math.floor(cy - ry)) - 1, int(math.ceil(cy + ry)) + 2):
            for x in range(int(math.floor(cx - rx)) - 1, int(math.ceil(cx + rx)) + 2):
                dx = (x + 0.5 - cx) / max(rx, 0.01)
                dy = (y + 0.5 - cy) / max(ry, 0.01)
                if dx * dx + dy * dy <= 1.0:
                    out.append((x, y))
        return out

    def vgrad(self, x0, x1, y0, y1, stops, xoff=0, only_opaque=False):
        """Senkrechter Verlauf (Bayer 2×2) über die Farben `stops` (dunkel/hell beliebig)."""
        n = len(stops)
        hgt = max(1, y1 - y0)
        for y in range(y0, y1 + 1):
            pos = (y - y0) / hgt * (n - 1)
            seg = min(n - 2, int(pos)) if n > 1 else 0
            f = pos - seg
            for x in range(x0, x1 + 1):
                if only_opaque and not self.opaque(x, y):
                    continue
                c = stops[seg + 1] if n > 1 and bayer(x + xoff, y, f) else stops[seg]
                self.set(x, y, c)

    def blit(self, other: "Img | Image.Image", x, y, flip=False):
        src = other.im if isinstance(other, Img) else other
        sp = src.load()
        for sy in range(src.size[1]):
            for sx in range(src.size[0]):
                c = sp[sx, sy]
                if c[3] == 255:
                    tx = x + (src.size[0] - 1 - sx if flip else sx)
                    self.set(tx, y + sy, c)

    def copy(self) -> "Img":
        o = Img(self.w, self.h, self.pal, self.wrap)
        o.im = self.im.copy()
        o.px = o.im.load()
        return o

    def flipped(self) -> "Img":
        o = self.copy()
        o.im = self.im.transpose(Image.FLIP_LEFT_RIGHT)
        o.px = o.im.load()
        return o

    # Outline ---------------------------------------------------------------
    def outline(self, selective=True, ink=None, diag=False):
        """1-px-Outline außen um alle deckenden Pixel. Farbe = dunkelste Stufe der angrenzenden
        Rampe; liegt die Outline oben/links der Form, eine Stufe heller (selektiv, Licht oben links)."""
        src = self.im.copy()
        sp = src.load()
        W, H = self.w, self.h

        def op(x, y):
            if self.wrap:
                x %= W
            return 0 <= x < W and 0 <= y < H and sp[x, y][3] == 255

        out = []
        for y in range(H):
            for x in range(W):
                if op(x, y):
                    continue
                nb = []
                for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
                    if op(x + dx, y + dy):
                        nb.append((dx, dy))
                if not nb and diag:
                    for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
                        if op(x + dx, y + dy):
                            nb.append((dx, dy))
                if not nb:
                    continue
                # bevorzugt den Nachbarn unten/rechts (bestimmt den Farbton), sonst irgendeinen
                dx, dy = nb[0]
                c = sp[(x + dx) % W if self.wrap else x + dx, y + dy]
                if ink is not None:
                    col = ink
                else:
                    name, _ = self.pal.where.get(c[:3], (None, 0))
                    if name is None:
                        col = c
                    else:
                        lighter = selective and all(d in ((1, 0), (0, 1)) for d in nb)
                        col = self.pal(name, 1 if lighter else 0)
                out.append((x, y, col))
        for x, y, c in out:
            self.set(x, y, c)
        return self

    # Prüfen & Speichern ------------------------------------------------------
    def colors(self) -> set:
        return {c[:3] for c in self.im.getdata() if c[3] == 255}

    def validate(self, eyes: int = 0, name: str = "?"):
        alphas = {c[3] for c in self.im.getdata()}
        if not alphas <= {0, 255}:
            raise ValueError(f"{name}: Alpha nicht binär {alphas}")
        cols = self.colors()
        whites = sum(1 for c in self.im.getdata() if c == WHITE)
        bad = {c for c in cols if c not in self.pal.allowed and c != (255, 255, 255)}
        if bad:
            raise ValueError(f"{name}: Farben außerhalb der Palette {sorted(map(C.rgb_to_hex, bad))[:6]}")
        if (0, 0, 0) in cols:
            raise ValueError(f"{name}: reines Schwarz")
        if whites != eyes:
            raise ValueError(f"{name}: {whites} Weiß-Pixel, erwartet {eyes} (nur Augenlicht)")
        return True

    def save(self, path: str, gen: dict | None = None, eyes: int = 0, gen_dir: str | None = None):
        """PNG speichern (nach Prüfung) und `<name>.gen.json` daneben bzw. in `gen_dir`."""
        name = os.path.basename(path)
        self.validate(eyes, name)
        C.ensure_dir(os.path.dirname(path))
        self.im.save(path, optimize=True)
        if gen is not None:
            g = {"generator": "tools/art", "version": C.GENERATOR_VERSION, "palettes": list(self.pal.names),
                 "size": [self.w, self.h], "eyes": eyes, **gen}
            gd = gen_dir or os.path.dirname(path)
            C.ensure_dir(gd)
            with open(os.path.join(gd, os.path.splitext(name)[0] + ".gen.json"), "w", encoding="utf-8") as fh:
                json.dump(g, fh, indent=1, ensure_ascii=False)


# --------------------------------------------------------------------------- Ableitungen (F5)

def shift_rows(src: Img, fn) -> Img:
    """Zeilenversatz: Zeile y wird um fn(y) px horizontal verschoben (ganzzahlig)."""
    o = Img(src.w, src.h, src.pal, src.wrap)
    for y in range(src.h):
        d = int(round(fn(y)))
        for x in range(src.w):
            c = src.px[x, y]
            if c[3] == 255:
                o.set(x + d, y, c)
    return o


def shift_cols(src: Img, fn) -> Img:
    """Spaltenversatz: Spalte x wird um fn(x) px vertikal verschoben (ganzzahlig)."""
    o = Img(src.w, src.h, src.pal, src.wrap)
    for x in range(src.w):
        d = int(round(fn(x)))
        for y in range(src.h):
            c = src.px[x, y]
            if c[3] == 255:
                o.set(x, y + d, c)
    return o


def translated(src: Img, dx: int, dy: int) -> Img:
    o = Img(src.w, src.h, src.pal, src.wrap)
    o.blit(src, dx, dy)
    return o


def rotate_pixel(src: Img, deg: float, pivot=None) -> Img:
    """Pixel-Rotation (8× Nearest hoch → drehen → Nearest runter, Mehrheitsfarbe je Zelle)."""
    k = 8
    big = src.im.resize((src.w * k, src.h * k), Image.NEAREST)
    cx, cy = pivot if pivot else (src.w / 2, src.h / 2)
    big = big.rotate(deg, resample=Image.NEAREST, center=(cx * k, cy * k))
    o = Img(src.w, src.h, src.pal, src.wrap)
    bp = big.load()
    for y in range(src.h):
        for x in range(src.w):
            cnt: dict = {}
            for sy in range(2, k, 4):
                for sx in range(2, k, 4):
                    c = bp[x * k + sx, y * k + sy]
                    cnt[c] = cnt.get(c, 0) + 1
            c = max(cnt.items(), key=lambda kv: (kv[1], kv[0][3]))[0]
            if c[3] == 255 and cnt[c] >= 2:
                o.set(x, y, c)
    return o


def from_map(rows: list[str], legend: dict, pal: Pal) -> Img:
    """Handgezeichnetes Zeichenraster → Img (F8.5): ein Zeichen = eine Palettenfarbe, '.' = leer.
    legend: Zeichen → RGBA-Tupel. Alle Zeilen müssen gleich lang sein."""
    w = len(rows[0])
    for i, r in enumerate(rows):
        if len(r) != w:
            raise ValueError(f"Zeile {i} hat {len(r)} statt {w} Zeichen: {r!r}")
    img = Img(w, len(rows), pal)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == "." or ch == " ":
                continue
            if ch not in legend:
                raise ValueError(f"Zeichen {ch!r} fehlt in der Legende")
            img.set(x, y, legend[ch])
    return img

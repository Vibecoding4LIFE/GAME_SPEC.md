#!/usr/bin/env python3
"""Prozeduraler Fisch-Generator (GAME_SPEC Teil F8) – Platzhalter-Sprites für alle Fische.

Aufruf:  python3 tools/art/fishgen.py [pfad/zu/fish_db.json] [--only=F014,F020] [--jobs=4]

Pro Fisch:
  art_src/fish/<kuerzel>/<assetKey>.png        Standbild (Canvas der Größenklasse, Blick nach rechts)
  art_src/fish/<kuerzel>/<assetKey>.gen.json   Generator-Version, Seed, Parameter
  art_src/fish/<kuerzel>/frames/*.png          alle Clip-Frames (animate.py) für pack.py
Außerdem die Weltpaletten unter art_src/palettes/.

Ablauf je Fisch: Geometrie in Fisch-Einheiten (Körperlänge = 1) → Rasterung auf den Canvas
(Pixelmitten-Regel, Alpha binär) → Schattierung über Distanzfeld/Pseudo-Normale (Licht oben links)
→ Muster-Masken → Details (Kiemen, Auge, Maul, Merkmale) → Farbanzahl-Limit → selektive Outline.
"""
from __future__ import annotations

import json
import math
import os
import random
import sys
import time
from concurrent.futures import ProcessPoolExecutor

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import palette as P  # noqa: E402

# Pixel-Labels
EMPTY, BODY, FIN, TAIL, PECT, FEAT, LINE = 0, 1, 2, 3, 4, 5, 6
# Pixel-Flags
F_PROTECT, F_GLOW, F_WHITE, F_GILL, F_SHINE, F_PUPIL = 1, 2, 4, 8, 16, 32

EYE_SIZE = {"S": 2, "M": 4, "L": 6, "XL": 7, "Boss": 9}

# --------------------------------------------------------------------------- Formen

BASE = dict(ht=.19, hb=.15, p=.38, sn_t=.75, sn_b=.85, ped_t=.045, ped_b=.040, tl_t=1.2, tl_b=1.1,
            snout_dy=0.0, tail_len=.25, tail_span=.20, vb=.56, eye_u=.12, eye_v=.36, gill_u=.24,
            dorsal=[(.36, .62, .12, .35, "soft")], anal=(.66, .82, .08, .30), pelvic=(.42, .07),
            pect=(.27, .10, .05), mouth=1.0, mouth_dy=.15)

SHAPES = {
    "normal": {},
    "schlank": dict(ht=.13, hb=.115, p=.40, sn_t=.80, sn_b=.85, ped_t=.034, ped_b=.032, tail_len=.27,
                    tail_span=.165, vb=.52, dorsal=[(.40, .58, .105, .40, "soft")], anal=(.66, .80, .065, .3),
                    eye_v=.34),
    "hochrueckig": dict(ht=.29, hb=.21, p=.42, sn_t=.62, sn_b=.80, ped_t=.05, ped_b=.045, tl_t=1.1,
                        tail_len=.23, tail_span=.24, dorsal=[(.40, .66, .11, .35, "soft")],
                        anal=(.55, .86, .075, .25), eye_u=.12, eye_v=.38, gill_u=.22, snout_dy=.03,
                        mouth_dy=.3),
    "rund": dict(ht=.25, hb=.23, p=.45, sn_t=.58, sn_b=.62, ped_t=.055, ped_b=.05, tl_t=.9, tl_b=.9,
                 tail_len=.22, tail_span=.22, dorsal=[(.30, .68, .11, .30, "soft")], anal=(.60, .82, .08, .3),
                 eye_u=.14, gill_u=.27),
    "torpedo": dict(ht=.115, hb=.10, p=.48, sn_t=1.05, sn_b=1.0, ped_t=.03, ped_b=.028, tl_t=1.3, tl_b=1.25,
                    tail_len=.24, tail_span=.18, dorsal=[(.62, .76, .095, .35, "soft")], anal=(.64, .78, .07, .3),
                    eye_u=.11, eye_v=.33, gill_u=.21, mouth=1.4, mouth_dy=.05),
    "scheibe": dict(ht=.38, hb=.34, p=.50, sn_t=.55, sn_b=.60, ped_t=.05, ped_b=.05, tl_t=.85, tl_b=.85,
                    tail_len=.17, tail_span=.17, dorsal=[(.25, .86, .10, .25, "soft")], anal=(.45, .86, .09, .25),
                    eye_u=.17, eye_v=.40, gill_u=.28, pelvic=(.38, .10)),
    "kopflastig": dict(ht=.20, hb=.19, p=.20, sn_t=.42, sn_b=.50, ped_t=.03, ped_b=.028, tl_t=.85, tl_b=.80,
                       tail_len=.20, tail_span=.15, dorsal=[(.36, .46, .07, .30, "soft")], anal=(.45, .93, .05, .2),
                       eye_u=.11, eye_v=.28, gill_u=.30, mouth=2.0, mouth_dy=.1),
    "kugel": dict(ht=.33, hb=.33, p=.50, sn_t=.50, sn_b=.50, ped_t=.07, ped_b=.07, tl_t=.55, tl_b=.55,
                  tail_len=.2, tail_span=.2, dorsal=[(.62, .78, .09, .30, "soft")], anal=(.68, .80, .06, .3),
                  eye_u=.20, eye_v=.35, gill_u=.33, pect=(.35, .13, .07), mouth=.8),
    # Sonderformen (eigene Geometrie)
    "aal": dict(vb=.62, eye_u=.045, eye_v=.30, gill_u=.10, pect=(.12, .05, .03), mouth=1.0),
    "band": dict(vb=.62, eye_u=.04, eye_v=.32, gill_u=.08, pect=(.10, .05, .03), mouth=.8),
    "rochen": dict(vb=.86, eye_u=.20, eye_v=.30, gill_u=.0),
    "plattfisch": dict(vb=.90, eye_u=.12, eye_v=.25, gill_u=.0),
    "seepferdchen": dict(vb=.0, eye_u=0, eye_v=0, gill_u=0),
}

TAILS = {
    "gegabelt": [(0, "T"), (.45, -.55), (.85, -.92), (1.0, -1.0), (.78, -.55), (.55, -.12), (.52, 0),
                 (.55, .12), (.78, .55), (1.0, 1.0), (.85, .92), (.45, .55), (0, "B")],
    "rund": [(0, "T"), (.3, -.62), (.65, -.85), (.9, -.7), (1.0, -.35), (1.03, 0), (1.0, .35), (.9, .7),
             (.65, .85), (.3, .62), (0, "B")],
    "sichel": [(0, "T"), (.35, -.40), (.70, -.85), (1.0, -1.12), (.82, -.62), (.60, -.20), (.55, 0),
               (.60, .20), (.82, .62), (1.0, 1.12), (.70, .85), (.35, .40), (0, "B")],
    "gerade": [(0, "T"), (.5, -.65), (.92, -.95), (1.0, -.9), (.96, -.3), (.94, 0), (.96, .3), (1.0, .9),
               (.92, .95), (.5, .65), (0, "B")],
    "hai": [(0, "T"), (.45, -.55), (.85, -1.0), (1.05, -1.2), (.90, -.80), (.55, -.25), (.48, .05),
            (.62, .42), (.60, .62), (.40, .45), (0, "B")],
    "spitz": [(0, "T"), (.5, "T6"), (1.05, 0), (.5, "B6"), (0, "B")],
    "dreiteilig": [(0, "T"), (.45, -.6), (.9, -1.0), (.95, -.85), (.62, -.38), (.8, -.2), (1.0, 0), (.8, .2),
                   (.62, .38), (.95, .85), (.9, 1.0), (.45, .6), (0, "B")],
    "saum": [(0, "T"), (.6, -.5), (1.0, 0), (.6, .5), (0, "B")],
}


def smoothstep(a, b, x):
    if a == b:
        return 1.0 if x >= b else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def catmull_closed(pts, n=10):
    out = []
    m = len(pts)
    for i in range(m):
        p0, p1, p2, p3 = pts[(i - 1) % m], pts[i], pts[(i + 1) % m], pts[(i + 2) % m]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(2)))
    return out


class Part:
    __slots__ = ("kind", "label", "data", "name", "info")

    def __init__(self, kind, label, data, name="", info=None):
        self.kind, self.label, self.data, self.name, self.info = kind, label, data, name, info or {}


class Geo:
    """Geometrie eines Fisches in Fisch-Einheiten (Körper von X=0 Schwanzstiel bis X=1 Schnauze)."""

    def __init__(self):
        self.parts: list[Part] = []
        self.top = None       # f(X) -> Y Oberkante
        self.bot = None       # f(X) -> Y Unterkante
        self.yc = lambda X: 0.0
        self.eye = (0.88, 0.0)
        self.eye2 = None
        self.mouth = (1.0, 0.0)
        self.belly_mode = "col"
        self.vertical = False
        self.lures = []        # (X, Y, rel_size, ramp)
        self.px_extra = 0      # Reserve in Pixeln (Moos/Stacheln)
        self.peduncle_X = 0.0
        self.max_stretch = 1.25

    def add(self, *a, **k):
        self.parts.append(Part(*a, **k))


# --------------------------------------------------------------------------- Geometrie-Aufbau

def profile_funcs(q):
    def half(u, hmax, ped, sn, tl):
        p = q["p"]
        if u <= 0:
            return 0.0
        if u < p:
            f = u / p
            return hmax * (1 - (1 - f) ** 2) ** sn
        g = min(1.0, (u - p) / (1 - p))
        return ped + (hmax - ped) * max(0.0, math.cos(math.pi / 2 * g)) ** tl

    def yc(X):
        return q["snout_dy"] * q["ht"] * smoothstep(1 - q["p"], 1.0, X)

    def top(X):
        return yc(X) - half(1 - X, q["ht"], q["ped_t"], q["sn_t"], q["tl_t"])

    def bot(X):
        return yc(X) + half(1 - X, q["hb"], q["ped_b"], q["sn_b"], q["tl_b"])

    return top, bot, yc


def fin_poly(geo, u0, u1, height, sweep, side, kind="soft", n=16, spikes=0, rng=None):
    """Flosse entlang Ober- (side=-1) oder Unterkontur (side=+1)."""
    edge = geo.top if side < 0 else geo.bot
    ta = 0.18 if kind == "sail" else 0.28
    outer, base = [], []
    for i in range(n + 1):
        t = i / n
        uu = u0 + (u1 - u0) * t
        X = 1 - uu
        if kind == "sail":
            prof = (t / .15) ** .6 if t < .15 else (1.0 if t < .55 else ((1 - t) / .45) ** .7)
        elif t < ta:
            prof = (t / ta) ** 0.55
        else:
            prof = ((1 - t) / (1 - ta)) ** 0.8
        fh = height * prof
        Y0 = edge(X)
        outer.append((X - sweep * fh, Y0 + side * fh))
        base.append((X, Y0 - side * 0.012))
    if spikes:
        # gezackte Stachel-Kante: zwischen den Spitzen einkerben
        new = []
        m = spikes * 2
        for i in range(m + 1):
            t = i / m
            uu = u0 + (u1 - u0) * t
            X = 1 - uu
            if t < ta:
                prof = (t / ta) ** 0.55
            else:
                prof = ((1 - t) / (1 - ta)) ** 0.8
            if kind == "sail":
                prof = (t / .15) ** .6 if t < .15 else (1.0 if t < .55 else ((1 - t) / .45) ** .7)
            fh = height * prof * (1.0 if i % 2 == 1 else 0.55)
            Y0 = edge(X)
            new.append((X - sweep * fh, Y0 + side * fh))
        outer = new
    pts = outer + base[::-1]
    X0, X1 = 1 - u0, 1 - u1
    Pa = (X0, edge(X0))
    Pb = (X1, edge(X1))
    dl = math.hypot(sweep, 1.0)
    D = (-sweep / dl * height, side * 1.0 / dl * height)
    geo.add("poly", FIN, pts, "fin", {"Pa": Pa, "Pb": Pb, "D": D, "kind": kind})


def tail_poly(geo, q, schwanz, X0=0.0, Yc=None, ped_t=None, ped_b=None, length=None, span=None):
    Yc = geo.yc(X0) if Yc is None else Yc
    ped_t = q["ped_t"] if ped_t is None else ped_t
    ped_b = q["ped_b"] if ped_b is None else ped_b
    lt = q["tail_len"] if length is None else length
    sp = max(q["tail_span"] if span is None else span, ped_t * 1.3)
    tmpl = TAILS.get(schwanz, TAILS["gegabelt"])
    pts = []
    for tx, ty in tmpl:
        if ty == "T":
            y = -ped_t
        elif ty == "B":
            y = ped_b
        elif ty == "T6":
            y = -ped_t * 0.6
        elif ty == "B6":
            y = ped_b * 0.6
        else:
            y = ty * sp
        pts.append((X0 + 0.02 - tx * lt, Yc + y))
    geo.add("poly", TAIL, pts, "tail", {"origin": (X0 + 0.03, Yc), "len": lt})


def build_profile_fish(geo, q, art, merk, rng, W):
    top, bot, yc = profile_funcs(q)
    geo.top, geo.bot, geo.yc = top, bot, yc
    n = 72
    pts = [(1 - i / n, top(1 - i / n)) for i in range(n + 1)]
    pts += [(i / n, bot(i / n)) for i in range(n + 1)]
    geo.add("poly", BODY, pts, "body")
    schwanz = art.get("schwanz", "gegabelt")
    px_per_u = 0.66 * W
    # Rückenflossen
    dorsals = list(q["dorsal"])
    if "segel" in merk:
        dorsals = [(.16, .80, .40, .12, "sail")]
    elif "stacheln" in merk and q["shape"] not in ("kugel",):
        u0, u1, hh, sw, _ = dorsals[0]
        mid = (u0 + u1) / 2
        dorsals = [(u0 - .06, mid + .02, hh * 1.15, sw * .6, "spiny"), (mid + .04, u1 + .06, hh * .8, sw, "soft")]
    if schwanz == "saum":
        u0, u1, hh, sw, kind = dorsals[-1]
        dorsals[-1] = (u0, 1.0, hh * .7, .15, kind)
    for (u0, u1, hh, sw, kind) in dorsals:
        spikes = 0
        if kind == "spiny" or "flammen" in merk:
            spikes = max(2, int((u1 - u0) * px_per_u / 3.2))
        fin_poly(geo, u0, u1, hh, sw, -1, kind, spikes=spikes, rng=rng)
    a0, a1, ah, asw = q["anal"]
    if schwanz == "saum":
        a1, ah, asw = 1.0, ah * .8, .15
    fin_poly(geo, a0, a1, ah, asw, +1, "soft")
    if "fettflosse" in merk:
        fin_poly(geo, .83, .90, .035, .2, -1, "soft", n=8)
    if "froschbeine" not in merk and q["shape"] not in ("kugel",):
        pu, pl = q["pelvic"]
        X = 1 - pu
        Y = bot(X)
        geo.add("poly", FIN, [(X + .01, Y - .01), (X - pl * .25, Y - .01), (X - pl * .95, Y + pl * .55),
                              (X - pl * .55, Y + pl * .62)], "fin",
                {"Pa": (X, Y), "Pb": (X - pl * .25, Y), "D": (-pl * .7, pl * .6), "kind": "soft"})
    if "froschbeine" in merk:
        X = 1 - .5
        Y = bot(X)
        for dx in (0.0, -.1):
            geo.add("tube", FIN, [(X + dx, Y - .01, .028), (X + dx - .03, Y + .08, .022),
                                  (X + dx + .04, Y + .12, .018), (X + dx + .08, Y + .13, .02)], "leg")
    tail_poly(geo, q, schwanz)
    geo.peduncle_X = 0.0
    eu, ev = q["eye_u"], q["eye_v"]
    Xe = 1 - eu
    geo.eye = (Xe, top(Xe) + ev * (bot(Xe) - top(Xe)))
    geo.mouth = (1.0, yc(1.0) + q["mouth_dy"] * q["hb"] * 0.3)


def build_tube_fish(geo, q, art, merk, rng, shape):
    amp = .065 if shape == "aal" else .045
    rmax = .052 if shape == "aal" else .075
    waves = 1.0 if shape == "aal" else 1.15
    phase = rng.uniform(0.2, 0.9)

    def yc(X):
        env = 0.35 + 0.65 * (1 - X)
        return amp * env * math.sin(2 * math.pi * ((1 - X) * waves) + phase) - amp * 0.35 * math.sin(phase)

    def slope(X):
        e = 1e-3
        return (yc(X + e) - yc(X - e)) / (2 * e)

    def r(X):
        u = 1 - X
        head = min(1.0, (u / 0.07)) ** 0.5 if u < 0.07 else 1.0
        body = 0.22 + 0.78 * min(1.0, X / 0.65) ** 0.75
        if shape == "band":
            body = 0.35 + 0.65 * min(1.0, X / 0.4) ** 0.6
        return rmax * head * body

    def top(X):
        return yc(X) - r(X) * math.sqrt(1 + slope(X) ** 2)

    def bot(X):
        return yc(X) + r(X) * math.sqrt(1 + slope(X) ** 2)

    geo.top, geo.bot, geo.yc = top, bot, yc
    samples = []
    N = 220
    for i in range(N + 1):
        X = 1 - i / N * 1.0
        samples.append((X, yc(X), r(X)))
    geo.add("tube", BODY, samples, "body")
    schwanz = art.get("schwanz", "saum")
    fw = .028 if shape == "aal" else .02
    if shape == "aal" or schwanz == "saum":
        fins = []
        for i in range(N + 1):
            X = 0.62 - i / N * 0.68
            w = fw * smoothstep(0.62, 0.30, X)
            if X < 0:
                w = fw * max(0.0, 1 + X / 0.06)
                rr = r(0.0) * max(0.0, 1 + X / 0.06)
                fins.append((X, yc(0.0), rr + w))
            else:
                fins.append((X, yc(X), r(X) + w))
        geo.add("tube", FIN, fins, "saum", {"saum": True})
    if shape == "band":
        # durchgehende Rückenflosse
        fin_poly(geo, .06, .98, .06, .05, -1, "soft", n=40)
        if schwanz not in ("saum",):
            pass
    if schwanz not in ("saum",) and shape != "aal":
        tail_poly(geo, {**q, "ped_t": r(0) * .9, "ped_b": r(0) * .9, "tail_len": .1, "tail_span": rmax * 1.1},
                  schwanz, X0=0.0, Yc=yc(0.0))
    geo.eye = (1 - q["eye_u"], top(1 - q["eye_u"]) + q["eye_v"] * (bot(1 - q["eye_u"]) - top(1 - q["eye_u"])))
    geo.mouth = (1.0, yc(1.0) + rmax * 0.25)
    geo.peduncle_X = 0.12


def build_ray(geo, q, art, merk, rng, boss):
    manta = boss or "krone" in merk
    if manta:
        ctrl = [(1.0, 0.0), (.82, -.16), (.50, -.44), (.40, -.22), (.27, 0.0), (.40, .26), (.48, .52), (.82, .19)]
    else:
        ctrl = [(1.0, 0.0), (.86, -.13), (.56, -.27), (.38, -.17), (.25, 0.0), (.38, .20), (.55, .33), (.86, .15)]
    pts = catmull_closed(ctrl, 10)
    geo.add("poly", BODY, pts, "body")
    # Funktionen für Ober-/Unterkante aus dem Polygon
    xs = sorted(set(round(p[0], 3) for p in pts))

    def span_at(X):
        ys = []
        n = len(pts)
        for i in range(n):
            (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % n]
            if (x1 <= X < x2) or (x2 <= X < x1):
                t = (X - x1) / (x2 - x1)
                ys.append(y1 + t * (y2 - y1))
        if not ys:
            return 0.0, 0.0
        return min(ys), max(ys)

    geo.top = lambda X: span_at(X)[0]
    geo.bot = lambda X: span_at(X)[1]
    geo.yc = lambda X: 0.0
    # Schwanz: Peitsche mit Stachel
    whip = []
    for i in range(41):
        t = i / 40
        X = .30 - t * .62
        whip.append((X, .02 + .03 * math.sin(t * 3.0), .022 * (1 - t) + .005))
    geo.add("tube", TAIL, whip, "whip")
    geo.add("poly", TAIL, [(.12, .0), (.02, -.035), (.06, .005)], "spine")
    if manta:
        # Kopflappen (Krone)
        geo.add("poly", FEAT, [(.95, -.06), (1.08, -.10), (1.12, -.05), (1.0, -.01)], "lobe")
        geo.add("poly", FEAT, [(.95, .05), (1.08, .11), (1.12, .07), (1.0, .02)], "lobe")
    geo.eye = (.84, -.06)
    geo.eye2 = (.84, .07)
    geo.mouth = (1.0, .02)
    geo.belly_mode = "rim"
    geo.peduncle_X = .27


def build_flatfish(geo, q, art, merk, rng):
    cx, rx, ry = .55, .46, .24
    body = [(cx + rx * math.cos(a), ry * math.sin(a) * (1.0 + .08 * math.cos(a))) for a in
            [i / 64 * 2 * math.pi for i in range(64)]]
    geo.add("poly", BODY, body, "body")
    fringe = []
    for i in range(64):
        a = i / 64 * 2 * math.pi
        c = math.cos(a)
        # vorne (Kopf) kein Saum
        w = .055 * smoothstep(.75, .35, c)
        fringe.append((cx + (rx + w) * c, (ry + w) * math.sin(a) * (1.0 + .08 * c)))
    geo.add("poly", FIN, fringe, "saum", {"saum": True})

    def span(X):
        t = max(-1.0, min(1.0, (X - cx) / rx))
        h = ry * math.sqrt(max(0.0, 1 - t * t))
        return -h, h

    geo.top = lambda X: span(X)[0]
    geo.bot = lambda X: span(X)[1]
    q2 = dict(q, ped_t=.035, ped_b=.035, tail_len=.18, tail_span=.12)
    tail_poly(geo, q2, art.get("schwanz", "rund"), X0=cx - rx + .03, Yc=0.0)
    geo.eye = (.88, -.10)
    geo.eye2 = (.80, -.15)
    geo.mouth = (1.0, .03)
    geo.belly_mode = "rim"
    geo.peduncle_X = cx - rx + .03


def build_seahorse(geo, q, art, merk, rng):
    """Aufrecht: Kopf oben mit Röhrenschnauze nach rechts, Bauch vorn gewölbt, Schwanz nach vorn eingerollt."""
    geo.vertical = True
    k = 1.2   # Dicke
    spine = [(.02, -.40, .085), (.00, -.33, .066), (-.03, -.27, .07), (-.01, -.19, .095), (.04, -.08, .125),
             (.05, .02, .125), (.02, .11, .10), (-.03, .18, .075), (-.06, .25, .058), (-.06, .32, .045),
             (-.03, .38, .036), (.02, .41, .03), (.065, .39, .027), (.08, .345, .024), (.06, .31, .021),
             (.03, .32, .019), (.025, .35, .017)]
    dense = []
    for i in range(len(spine) - 1):
        a, b = spine[i], spine[i + 1]
        for j in range(8):
            t = j / 8
            dense.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (a[2] + (b[2] - a[2]) * t) * k))
    dense.append(spine[-1][:2] + (spine[-1][2] * k,))
    geo.add("tube", BODY, dense, "body")
    # Röhrenschnauze, leicht nach unten
    geo.add("poly", BODY, [(.06, -.44), (.25, -.40), (.26, -.355), (.06, -.335)], "snout")
    # Rückenflosse (links am Rücken, fächerförmig)
    geo.add("poly", FIN, [(-.07, -.10), (-.17, -.12), (-.21, -.04), (-.19, .04), (-.08, .05)], "fin",
            {"Pa": (-.07, -.10), "Pb": (-.08, .05), "D": (-.12, 0.0), "kind": "soft"})
    geo.top = lambda X: -.48
    geo.bot = lambda X: .45
    geo.yc = lambda X: 0.0
    geo.eye = (.035, -.405)
    geo.mouth = (.26, -.375)
    geo.belly_mode = "row"
    geo.peduncle_X = -1


def add_features(geo, q, merk, boss, rng, shape):
    top, bot = geo.top, geo.bot
    head_X = 1 - max(0.06, q.get("eye_u", .1))
    if shape in ("rochen", "seepferdchen", "plattfisch"):
        if shape == "seepferdchen" and "krone" in merk:
            for i, (x, h) in enumerate([(-.06, .07), (-.01, .10), (.05, .07)]):
                geo.add("poly", FEAT, [(x - .025, -.47), (x, -.47 - h), (x + .025, -.47)], "crown")
        return
    if "krone" in merk:
        n = 5 if boss else 3
        u0, u1 = .05, .26
        for i in range(n):
            t = (i + .5) / n
            X = 1 - (u0 + (u1 - u0) * t)
            Y = top(X)
            h = (.028 + .03 * math.sin(math.pi * t)) * (1.25 if boss else 1.0)
            w = (u1 - u0) / n * .55
            geo.add("poly", FEAT, [(X + w, Y + .015), (X + w * .2, Y - h), (X - w, Y + .015)], "crown")
    if "horn" in merk:
        X = 1 - .17
        Y = top(X)
        hh = min(.11, max(.04, (bot(X) - top(X)) * .7))   # Hornhöhe relativ zur Kopfhöhe
        ww = hh * .45
        for k, dx in enumerate((0.0, -hh * .6)):
            # nach hinten geschwungenes Horn
            geo.add("poly", FEAT, [(X + dx + ww * .6, Y + .01), (X + dx - ww * .3, Y - hh * .7),
                                   (X + dx - ww * 1.4, Y - hh * (1 - .15 * k)), (X + dx - ww * .4, Y - hh * .45),
                                   (X + dx - ww * .5, Y + .01)], "horn")
    if "kristalle" in merk:
        n = 4 if not boss else 6
        for i in range(n):
            t = (i + .5) / n
            X = 1 - (.30 + .40 * t)
            Y = top(X)
            h = .06 + .05 * rng.random()
            geo.add("poly", FEAT, [(X + .035, Y + .02), (X + .005, Y - h * .6), (X - .03, Y - h),
                                   (X - .03, Y + .02)], "crystal")
    if "schnauze_lang" in merk:
        X, Y = geo.mouth
        th = max(.025, (bot(.9) - top(.9)) * .3)
        ln = .11 if shape in ("torpedo", "normal", "kopflastig", "hochrueckig", "rund") else .16
        geo.add("poly", BODY, [(X - .06, Y - th), (X + ln * .6, Y - th * .55), (X + ln, Y - th * .2), (X + ln + .005, Y + th * .1),
                               (X + ln * .7, Y + th * .5), (X - .06, Y + th * .8)], "snout")
        geo.mouth = (X + ln * .9, Y)
    if "leuchtangel" in merk:
        X0 = 1 - .10
        Y0 = top(X0)
        bulbs = [(1.10, Y0 - .02, 1.0, "acc")]
        stalks = [[(X0, Y0 + .01), (X0 + .02, Y0 - .14), (1.06, Y0 - .16), (1.10, Y0 - .06)]]
        if boss:
            bulbs += [(1.02, Y0 - .26, .7, "iris"), (.80, Y0 - .22, .7, "fin")]
            stalks += [[(X0 - .03, Y0 + .01), (X0 - .02, Y0 - .20), (1.0, Y0 - .27)],
                       [(X0 - .08, Y0 + .01), (X0 - .10, Y0 - .16), (.82, Y0 - .21)]]
        for s in stalks:
            geo.add("line", LINE, s, "stalk")
        for b in bulbs:
            geo.lures.append(b)
    if "barteln" in merk or "tentakel" in merk:
        X, Y = geo.mouth
        long = shape == "kopflastig" or boss
        L1 = .30 if long else .14
        Xc = X - .035 * q.get("mouth", 1.0)
        Xe = Xc - L1 * .6
        geo.add("line", LINE, [(Xc, Y), (Xc + .015, Y + L1 * .3), (Xc - L1 * .2, bot(Xc - L1 * .2) + L1 * .25),
                               (Xe, bot(Xe) + L1 * .3)], "barbel")
        Xs = Xc - .02
        geo.add("line", LINE, [(Xs, bot(Xs) - .01), (Xs - .005, bot(Xs) + .05), (Xs - .03, bot(Xs) + .08)], "barbel")
        if "tentakel" in merk:
            for k in range(3):
                Xs = X - .15 - .05 * k
                geo.add("line", LINE, [(Xs, bot(Xs) - .005), (Xs - .03, bot(Xs) + .08), (Xs - .01, bot(Xs) + .16)],
                        "barbel")


def build_geometry(fish, rng):
    art = fish["art"]
    merk = [m.lower() for m in art.get("merkmale", [])]
    shape = art.get("koerperform", "normal")
    if shape not in SHAPES:
        shape = "normal"
    q = dict(BASE)
    q.update(SHAPES[shape])
    q["shape"] = shape
    # deterministische Variation je Fisch
    if shape not in ("aal", "band", "rochen", "plattfisch", "seepferdchen"):
        for k, lo, hi in (("ht", .92, 1.08), ("hb", .92, 1.08), ("tail_span", .9, 1.1), ("tail_len", .92, 1.08)):
            q[k] *= rng.uniform(lo, hi)
        q["p"] += rng.uniform(-.03, .03)
        q["dorsal"] = [(u0 + rng.uniform(-.02, .02), u1 + rng.uniform(-.02, .02), hh * rng.uniform(.9, 1.12), sw, kd)
                       for (u0, u1, hh, sw, kd) in q["dorsal"]]
    W, H = fish["canvas"]
    klasse = fish["klasse"]
    profile = shape not in ("aal", "band", "rochen", "plattfisch", "seepferdchen")
    if profile and klasse in ("S", "M"):
        # kleine Sprites brauchen kräftigere Proportionen, sonst bleibt nur Outline übrig
        f = 1.38 if klasse == "S" else 1.12
        for k in ("ht", "hb", "ped_t", "ped_b"):
            q[k] *= f
        q["tail_span"] *= 1.25 if klasse == "S" else 1.08
        q["dorsal"] = [(u0, u1, hh * (1.25 if klasse == "S" else 1.1), sw, kd) for (u0, u1, hh, sw, kd) in q["dorsal"]]
        a0, a1, ah, asw = q["anal"]
        q["anal"] = (a0, a1, ah * (1.25 if klasse == "S" else 1.1), asw)
        pu, pl, ph = q["pect"]
        q["pect"] = (pu, pl * 1.2, ph * 1.3)
    if profile:
        body_px = (W - 4) / (1 + q["tail_len"])
        q["eye_u"] = max(q["eye_u"], (EYE_SIZE[klasse] / 2 + (2.4 if klasse == "S" else 2.0)) / body_px)
    if "glupschaugen" in merk:
        q["eye_v"] = .16
    if "maul_gross" in merk:
        q["mouth"] = max(q["mouth"], 1.0) * 1.8
    geo = Geo()
    if shape in ("aal", "band"):
        build_tube_fish(geo, q, art, merk, rng, shape)
    elif shape == "rochen":
        build_ray(geo, q, art, merk, rng, fish["boss"])
    elif shape == "plattfisch":
        build_flatfish(geo, q, art, merk, rng)
    elif shape == "seepferdchen":
        build_seahorse(geo, q, art, merk, rng)
    else:
        build_profile_fish(geo, q, art, merk, rng, W)
    add_features(geo, q, merk, fish["boss"], rng, shape)
    if "moos" in merk:
        geo.px_extra = max(geo.px_extra, 2)
    if "stacheln" in merk and shape == "kugel":
        geo.px_extra = max(geo.px_extra, 2)
    return geo, q, merk, shape


# --------------------------------------------------------------------------- Rasterung

def part_points(part):
    if part.kind == "poly" or part.kind == "line":
        return [(x, y, 0.0) for x, y in part.data]
    if part.kind == "tube":
        return part.data
    return []


def fit_transform(geo, W, H, klasse):
    xs0, xs1, ys0, ys1 = 1e9, -1e9, 1e9, -1e9
    for part in geo.parts:
        for x, y, r in part_points(part):
            xs0, xs1 = min(xs0, x - r), max(xs1, x + r)
            ys0, ys1 = min(ys0, y - r), max(ys1, y + r)
    for (x, y, rs, _) in geo.lures:
        xs0, xs1 = min(xs0, x - .03), max(xs1, x + .03)
        ys0, ys1 = min(ys0, y - .03), max(ys1, y + .03)
    bw, bh = xs1 - xs0, ys1 - ys0
    extra = geo.px_extra
    avail_w = W - 4 - 0.6 - 2 * extra
    avail_h = H - 4 - 0.6 - 2 * extra
    s = min(avail_w / bw, avail_h / bh)
    sx = s
    if not geo.vertical and avail_w / bw > s:
        # hochrückige Fische dürfen etwas in die Länge gezogen werden (max. 25 %), damit sie den Canvas nutzen
        sx = min(avail_w / bw, s * geo.max_stretch)
    ox = 2 + extra + (avail_w - bw * sx) / 2 + 0.3 - xs0 * sx
    oy = 2 + extra + (avail_h - bh * s) / 2 + 0.3 - ys0 * s
    return s, sx, ox, oy


def raster_poly(pts, W, H):
    out = []
    n = len(pts)
    ymin = max(0, int(math.floor(min(p[1] for p in pts))))
    ymax = min(H - 1, int(math.ceil(max(p[1] for p in pts))))
    for py in range(ymin, ymax + 1):
        yc = py + 0.5
        xs = []
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            if (y1 <= yc < y2) or (y2 <= yc < y1):
                xs.append(x1 + (yc - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            a = int(math.ceil(xs[k] - 0.5))
            b = int(math.floor(xs[k + 1] - 0.5))
            for px in range(max(0, a), min(W - 1, b) + 1):
                out.append((px, py))
    return out


def raster_tube(samples, W, H):
    seen = set()
    # dicht genug abtasten (≤ 0,5 px)
    dense = []
    for i in range(len(samples) - 1):
        a, b = samples[i], samples[i + 1]
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        k = max(1, int(d / 0.4))
        for j in range(k):
            t = j / k
            dense.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t))
    dense.append(samples[-1])
    for x, y, r in dense:
        if r <= 0:
            continue
        r2 = r * r
        for py in range(max(0, int(y - r - 1)), min(H, int(y + r + 2))):
            dy = py + 0.5 - y
            for px in range(max(0, int(x - r - 1)), min(W, int(x + r + 2))):
                dx = px + 0.5 - x
                if dx * dx + dy * dy <= r2:
                    seen.add((px, py))
    return list(seen)


def raster_line(pts, W, H):
    out = []
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for k in range(n + 1):
            t = k / n
            px = int(math.floor(x0 + (x1 - x0) * t))
            py = int(math.floor(y0 + (y1 - y0) * t))
            if 0 <= px < W and 0 <= py < H and (not out or out[-1] != (px, py)):
                out.append((px, py))
    # Treppenlinie säubern: Ecken-Doppelpixel (L-Form) entfernen
    clean = []
    for i, p in enumerate(out):
        if clean and i < len(out) - 1:
            a, b = clean[-1], out[i + 1]
            if abs(a[0] - b[0]) == 1 and abs(a[1] - b[1]) == 1:
                continue
        clean.append(p)
    return clean


# --------------------------------------------------------------------------- Sprite

class Sprite:
    def __init__(self, fish, W, H):
        self.fish = fish
        self.w, self.h = W, H
        self.klasse = fish["klasse"]
        self.pix = [None] * (W * H)        # [key, flags]
        self.pect = {}                     # idx -> [key, flags]  (Brustflosse, über dem Körper)
        self.ramps = {}
        self.colors = {}
        self.snout_x = 0
        self.tail_x = 0
        self.ped_x = 0
        self.vertical = False
        self.pupil_key = ("main", 0)
        self.white_xy = None
        self.gill_alt = None
        self.shine_alt = None
        self.params = {}

    def key_rgb(self, key):
        return self.colors.get(key) or self.ramps[key[0]][key[1]]


def clamp_level(ramps, ramp, lvl):
    return max(0, min(len(ramps[ramp]) - 1, lvl))


def build_sprite(fish) -> Sprite:
    seed = C.seed_for(fish["id"])
    rng = random.Random(seed)
    W, H = fish["canvas"]
    klasse = fish["klasse"]
    big = klasse in ("L", "XL", "Boss")
    geo, q, merk, shape = build_geometry(fish, rng)
    s, sxx, ox, oy = fit_transform(geo, W, H, klasse)

    def T(X, Y):
        return (ox + X * sxx, oy + Y * s)

    N = W * H
    lab = [EMPTY] * N
    fininfo = {}
    sp = Sprite(fish, W, H)
    sp.vertical = geo.vertical
    pal = P.fish_ramps(fish["art"], klasse, fish["boss"], merk)
    ramps = pal["ramps"]
    sp.ramps = ramps

    def put(pixels, label, cond=None, part=None):
        for (px, py) in pixels:
            i = py * W + px
            if cond is None or cond(lab[i]):
                lab[i] = label
                if part is not None:
                    fininfo[i] = part

    order = {TAIL: 0, FIN: 1, BODY: 2, FEAT: 3, LINE: 4}
    parts = sorted(geo.parts, key=lambda p: order.get(p.label, 5))
    feat_kind = {}
    for part in parts:
        if part.kind == "poly":
            px = raster_poly([T(x, y) for x, y in part.data], W, H)
        elif part.kind == "tube":
            px = raster_tube([T(x, y) + (r * s,) for x, y, r in part.data], W, H)
        elif part.kind == "line":
            px = raster_line([T(x, y) for x, y in part.data], W, H)
            if klasse in ("XL", "Boss") and part.name in ("barbel", "stalk"):
                px = px + [(x, y + 1) for (x, y) in px if y + 1 < H]
        else:
            continue
        if part.label in (FIN, TAIL):
            put(px, part.label, lambda l: l in (EMPTY, FIN, TAIL), part)
        elif part.label == BODY:
            put(px, BODY, lambda l: l != FEAT)
        elif part.label == FEAT:
            put(px, FEAT)
            for (x, y) in px:
                feat_kind[y * W + x] = part.name
        elif part.label == LINE:
            for (x, y) in px:
                i = y * W + x
                if lab[i] == BODY:
                    if part.name == "barbel":
                        feat_kind[i] = "barbel_in"
                elif lab[i] in (EMPTY, FIN, TAIL):
                    lab[i] = LINE
                    feat_kind[i] = part.name

    # Glupschaugen: Augenhügel über die Kontur
    ex_f, ey_f = T(*geo.eye)
    esz = EYE_SIZE[klasse] + (2 if "glupschaugen" in merk and klasse != "S" else 0)
    if shape == "seepferdchen":
        esz = max(2, esz - 2)
    if "glupschaugen" in merk:
        rr = esz / 2 + 1.0
        for py in range(int(ey_f - rr - 1), int(ey_f + rr + 2)):
            for px in range(int(ex_f - rr - 1), int(ex_f + rr + 2)):
                if 0 <= px < W and 0 <= py < H and (px + .5 - ex_f) ** 2 + (py + .5 - ey_f) ** 2 <= rr * rr:
                    if lab[py * W + px] in (EMPTY, FIN, TAIL):
                        lab[py * W + px] = BODY

    # Rand freihalten (≥ 2 px)
    for y in range(H):
        for x in range(W):
            if (x < 2 or y < 2 or x >= W - 2 or y >= H - 2) and lab[y * W + x]:
                lab[y * W + x] = EMPTY

    cleanup(lab, W, H)

    # Stacheln rund um Kugelfische / Moosbüschel (Pixelraum)
    if "stacheln" in merk and shape == "kugel":
        add_spikes(lab, W, H, feat_kind, step=3 if klasse in ("S", "M") else 4)
    if "moos" in merk:
        add_moss(lab, W, H, feat_kind, rng)

    body_idx = [i for i in range(N) if lab[i] == BODY]
    if not body_idx:
        raise RuntimeError(f"{fish['id']}: leerer Körper")
    bx = [i % W for i in body_idx]
    sp.snout_x = max(bx)
    opaque_x = [i % W for i in range(N) if lab[i]]
    sp.tail_x = min(opaque_x)
    sp.ped_x = int(round(T(geo.peduncle_X, 0)[0])) if geo.peduncle_X > -1 else sp.tail_x
    body_len = max(1, sp.snout_x - min(bx))

    # Brustflosse (über dem Körper)
    pect_set = set()
    if shape not in ("rochen", "plattfisch") and "froschbeine" not in merk:
        pu, pl, ph = q["pect"]
        if shape == "seepferdchen":
            Xr, Yr = .03, -.30
            pl, ph = .08, .07
        else:
            Xr = 1 - (q["gill_u"] + .025)
            Yr = geo.top(Xr) + .54 * (geo.bot(Xr) - geo.top(Xr))
        pts = [(Xr, Yr - ph * .35), (Xr - pl * .45, Yr - ph * .2), (Xr - pl, Yr + ph * .45),
               (Xr - pl * .75, Yr + ph * .7), (Xr - pl * .25, Yr + ph * .45), (Xr, Yr + ph * .25)]
        for (x, y) in raster_poly([T(a, b) for a, b in pts], W, H):
            i = y * W + x
            if lab[i] == BODY:
                pect_set.add(i)

    # --------------------------------------------------------------- Distanzfeld & Schattierung
    bodyish = [lab[i] == BODY for i in range(N)]
    dist = distance_field(bodyish, W, H)
    dmax = max(dist) or 1
    col_top = [H] * W
    col_bot = [-1] * W
    row_l = [W] * H
    row_r = [-1] * H
    for i in body_idx:
        x, y = i % W, i // W
        col_top[x] = min(col_top[x], y)
        col_bot[x] = max(col_bot[x], y)
        row_l[y] = min(row_l[y], x)
        row_r[y] = max(row_r[y], x)

    vb = q["vb"]
    nb = len(ramps["belly"])
    L2 = (-0.6, -0.8)
    rim_front = sp.snout_x - int(body_len * 0.04)
    rim_back = sp.snout_x - int(body_len * 0.9)
    pix = sp.pix
    for i in body_idx:
        x, y = i % W, i // W
        d = dist[i]
        gx = _d(dist, W, H, x + 1, y) - _d(dist, W, H, x - 1, y)
        gy = _d(dist, W, H, x, y + 1) - _d(dist, W, H, x, y - 1)
        gl = math.hypot(gx, gy)
        nx, ny = (-gx / gl, -gy / gl) if gl > 0 else (0.0, 0.0)
        edge = max(0.0, 1.0 - (d - 1) / max(1.5, dmax * 0.55))
        lit = (nx * L2[0] + ny * L2[1]) * edge
        if geo.belly_mode == "row":
            t, b = row_l[y], row_r[y]
            v = 1 - (x - t) / max(1, b - t)       # rechts (vorn) = Bauch
            v = 1 - v
            vb_ = 0.62
        else:
            t, b = col_top[x], col_bot[x]
            v = (y - t) / max(1, b - t)
            vb_ = vb
        if v < vb_ or geo.belly_mode == "rim" and v < vb_:
            vv = v / max(0.01, vb_)
            S = 0.5 + 0.5 * ((1 - 2 * vv) * 0.55 + lit * 0.75)
            if geo.belly_mode == "rim":
                S = 0.5 + 0.5 * ((1 - 2 * vv) * 0.35 + lit * 0.9)
            lvl = 3 if S > 0.62 else (2 if S > 0.40 else 1)
            # Glanzkante: erste Reihe unter der Oberkante
            if not geo.vertical and y == col_top[x] + 1 and ny < -0.3 and rim_back <= x <= rim_front:
                lvl = 4
            if geo.vertical and x == row_l[y] + 1 and nx < -0.3:
                lvl = 4
            pix[i] = [("main", lvl), 0]
        else:
            vv = (v - vb_) / max(0.01, 1 - vb_)
            S = 0.5 + 0.5 * ((1 - 2 * vv) * 0.75 + lit * 0.5)
            lvl = max(0, min(nb - 1, int(S * nb)))
            pix[i] = [("belly", lvl), 0]

    bodyinfo = dict(col_top=col_top, col_bot=col_bot, dist=dist, body_len=body_len, vb=vb,
                    snout_x=sp.snout_x, ped_x=sp.ped_x, rng=rng, big=big, klasse=klasse, shape=shape,
                    row_l=row_l, row_r=row_r, vertical=geo.vertical)

    # --------------------------------------------------------------- Muster
    muster = fish["art"].get("muster", "keins")
    leuchtet = bool(fish["art"].get("leuchtet"))
    apply_pattern(pix, body_idx, W, H, muster, ramps, bodyinfo, leuchtet)

    # Schuppen-Halbmondraster ab L, Seitenlinie, Rückenreflex
    no_scales = shape in ("aal", "band", "kugel", "rochen", "plattfisch", "seepferdchen") or \
        muster in ("marmor", "hexagon", "platten", "risse", "netz", "schuppen")
    if big and not no_scales:
        scale_arcs(pix, W, H, bodyinfo, ramps, q["gill_u"], bright_edge=False)
    if big and shape not in ("rochen", "plattfisch", "seepferdchen", "kugel"):
        lateral_line(pix, W, H, bodyinfo, ramps, q["gill_u"])
        back_reflex(pix, W, H, bodyinfo, ramps)

    # Kiemenbogen
    gill_idx = None
    if shape not in ("rochen", "plattfisch", "seepferdchen"):
        gill_idx = gill_arc(pix, lab, W, H, bodyinfo, ramps, q["gill_u"])

    # --------------------------------------------------------------- Brustflosse
    for i in pect_set:
        sp.pect[i] = None
    if pect_set:
        xs = [i % W for i in pect_set]
        ys = [i // W for i in pect_set]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        nf = len(ramps["fin"])
        for i in pect_set:
            x, y = i % W, i // W
            top_edge = (i - W) not in pect_set
            right_edge = (i + 1) not in pect_set
            if top_edge or (right_edge and y < (y0 + y1) / 2):
                lvl = 0                                   # Innenlinie zum Körper (eine Stufe dunkler)
            elif x - x0 < (x1 - x0) * 0.3 or (i + W) not in pect_set:
                lvl = nf - 1                              # helle Flossenspitze/-saum
            elif big and (y - y0) % 2 == 0 and nf > 2:
                lvl = max(0, nf - 3)                      # Flossenstrahlen ab L
            else:
                lvl = max(0, nf - 2)
            sp.pect[i] = [("fin", lvl), 0]

    # --------------------------------------------------------------- Flossen
    color_fins(pix, lab, fininfo, W, H, ramps, klasse, merk, (sxx, s), T, leuchtet)

    # --------------------------------------------------------------- Merkmale
    color_features(pix, lab, feat_kind, W, H, ramps, rng)

    # Leuchtköder
    for (X, Y, rel, rname) in geo.lures:
        cx, cy = T(X, Y)
        rad = {"S": .9, "M": 1.6, "L": 2.0, "XL": 2.6, "Boss": 4.0}[klasse] * rel
        rn = rname if rname in ramps else "acc"
        n = len(ramps[rn])
        for py in range(int(cy - rad - 1), int(cy + rad + 2)):
            for px in range(int(cx - rad - 1), int(cx + rad + 2)):
                if not (2 <= px < W - 2 and 2 <= py < H - 2):
                    continue
                dd = math.hypot(px + .5 - cx, py + .5 - cy)
                if dd <= rad + 0.15:
                    i = py * W + px
                    lab[i] = FEAT
                    lvl = n - 1 if dd < rad * 0.55 else max(0, n - 2)
                    if dd > rad - 0.7 and px + py > cx + cy:
                        lvl = max(0, n - 3)
                    pix[i] = [(rn, lvl), F_PROTECT | F_GLOW]

    # --------------------------------------------------------------- Maul, Zähne, Haken
    draw_mouth(pix, lab, W, H, T(*geo.mouth), q, merk, ramps, klasse, fish["boss"], bodyinfo, sp)

    # Narben für Bosse
    if fish["boss"] and shape not in ("rochen",):
        scars(pix, lab, W, H, bodyinfo, ramps, rng, T(*geo.eye))

    # --------------------------------------------------------------- Auge
    if "augenlos" not in merk:
        draw_eye(sp, pix, lab, W, H, (ex_f, ey_f), esz, ramps, pal["has_iris"], klasse, main=True)
        if geo.eye2 is not None:
            e2 = T(*geo.eye2)
            draw_eye(sp, pix, lab, W, H, e2, max(2, esz - 1), ramps, pal["has_iris"], klasse, main=False)

    # Kiemenpixel (blinkt im Idle)
    if gill_idx is not None and pix[gill_idx] is not None:
        pix[gill_idx][1] |= F_GILL
        k = pix[gill_idx][0]
        sp.gill_alt = (k[0], clamp_level(ramps, k[0], k[1] + 2))
    # Glanzpixel (blinkt beim Fang)
    shine = find_shine(pix, W, H, bodyinfo)
    if shine is not None:
        pix[shine][1] |= F_SHINE
        sp.shine_alt = ("main", 4)

    # Leuchten: Glow-Flags sammeln
    if leuchtet and not any(p and p[1] & F_GLOW for p in pix):
        # Fallback: hellste Akzentpixel leuchten
        for i, p in enumerate(pix):
            if p and p[0][0] == "acc" and p[0][1] >= len(ramps["acc"]) - 2:
                p[1] |= F_GLOW

    # Pixel ohne Farbe (z. B. LINE über leerem Grund) auffüllen
    for i in range(N):
        if lab[i] and pix[i] is None:
            pix[i] = [("main", 1), 0]
        if not lab[i]:
            pix[i] = None

    # Unter der Brustflosse liegt der Körper (pix), darüber das Overlay sp.pect
    finalize_colors(sp)
    sp.params = dict(shape=shape, schwanz=fish["art"].get("schwanz"), muster=muster, merkmale=merk,
                     scale_px_per_unit=round(s, 3), eye_size=esz, vb=vb, leuchtet=leuchtet,
                     palette_base=pal["base"])
    return sp


def _d(dist, W, H, x, y):
    if 0 <= x < W and 0 <= y < H:
        return dist[y * W + x]
    return 0


def distance_field(mask, W, H):
    """Chamfer-Distanz (3-4) zur nächsten Nicht-Maske, in Pixeln (Rand = 1)."""
    INF = 10 ** 6
    d = [INF if m else 0 for m in mask]
    for y in range(H):
        for x in range(W):
            i = y * W + x
            if not d[i]:
                continue
            best = d[i]
            for dx, dy, c in ((-1, 0, 3), (0, -1, 3), (-1, -1, 4), (1, -1, 4)):
                xx, yy = x + dx, y + dy
                v = d[yy * W + xx] if 0 <= xx < W and 0 <= yy < H else 0
                best = min(best, v + c)
            d[i] = best
    for y in range(H - 1, -1, -1):
        for x in range(W - 1, -1, -1):
            i = y * W + x
            if not d[i]:
                continue
            best = d[i]
            for dx, dy, c in ((1, 0, 3), (0, 1, 3), (1, 1, 4), (-1, 1, 4)):
                xx, yy = x + dx, y + dy
                v = d[yy * W + xx] if 0 <= xx < W and 0 <= yy < H else 0
                best = min(best, v + c)
            d[i] = best
    return [v / 3.0 for v in d]


def neighbors4(lab, W, H, x, y):
    n = 0
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        xx, yy = x + dx, y + dy
        if 0 <= xx < W and 0 <= yy < H and lab[yy * W + xx]:
            n += 1
    return n


def cleanup(lab, W, H):
    """Waisenpixel und 1-px-Sporne entfernen, 1-px-Löcher füllen (Linien ausgenommen)."""
    for _ in range(2):
        rem = []
        for y in range(H):
            for x in range(W):
                i = y * W + x
                if lab[i] and lab[i] != LINE:
                    n8 = sum(1 for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                             if (dx or dy) and 0 <= x + dx < W and 0 <= y + dy < H and lab[(y + dy) * W + x + dx])
                    if n8 == 0:
                        rem.append(i)
        for i in rem:
            lab[i] = EMPTY
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            i = y * W + x
            if not lab[i] and neighbors4(lab, W, H, x, y) >= 3:
                cand = [lab[(y + dy) * W + x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                lab[i] = BODY if BODY in cand else max(cand, key=cand.count)


def add_spikes(lab, W, H, feat_kind, step=3):
    pts = []
    body = [i for i in range(W * H) if lab[i] == BODY]
    cx = sum(i % W for i in body) / len(body)
    cy = sum(i // W for i in body) / len(body)
    k = 0
    for i in body:
        x, y = i % W, i // W
        if neighbors4(lab, W, H, x, y) < 4:
            k += 1
            if (x * 7 + y * 3) % step:
                continue
            dx, dy = x - cx, y - cy
            dl = math.hypot(dx, dy) or 1
            for t in (1, 2):
                px, py = int(round(x + dx / dl * t)), int(round(y + dy / dl * t))
                if 2 <= px < W - 2 and 2 <= py < H - 2 and not lab[py * W + px]:
                    pts.append(py * W + px)
    for i in pts:
        lab[i] = LINE
        feat_kind[i] = "spike"


def add_moss(lab, W, H, feat_kind, rng):
    cols = {}
    for i in range(W * H):
        if lab[i] == BODY:
            x, y = i % W, i // W
            cols[x] = min(cols.get(x, H), y)
    xs = sorted(cols)
    if not xs:
        return
    x0, x1 = xs[0], xs[-1]
    L = x1 - x0
    for x in xs:
        t = (x1 - x) / max(1, L)
        if 0.22 < t < 0.75:
            h = rng.choice((0, 1, 1, 2)) if rng.random() < 0.7 else 0
            for k in range(1, h + 1):
                y = cols[x] - k
                if y >= 2:
                    lab[y * W + x] = LINE
                    feat_kind[y * W + x] = "moss"
            # Moosfläche auf dem Rücken
            for k in range(0, 2):
                j = (cols[x] + k) * W + x
                if lab[j] == BODY and rng.random() < 0.8:
                    feat_kind[j] = "moss_patch"


# --------------------------------------------------------------------------- Muster

def vnoise(rng_seed):
    r = random.Random(rng_seed)
    grid = {}

    def g(ix, iy):
        k = (ix, iy)
        if k not in grid:
            grid[k] = r.random()
        return grid[k]

    def f(x, y):
        ix, iy = int(math.floor(x)), int(math.floor(y))
        fx, fy = x - ix, y - iy
        sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * sx
        b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * sx
        return a + (b - a) * sy

    return f


def acc_key(ramps, cur, leucht=False):
    """Musterpixel in der Akzentrampe, Stufe aus der aktuellen Schattierung."""
    na = len(ramps["acc"])
    r, l = cur
    n = len(ramps[r])
    frac = l / max(1, n - 1)
    if leucht:
        return ("acc", na - 1 if frac > 0.3 else max(0, na - 2))
    return ("acc", max(0, min(na - 1, int(round(frac * (na - 1) + 0.15)))))


def shift_key(ramps, key, d):
    r, l = key
    lo = 1 if r == "main" and d < 0 and l >= 2 else 0
    return (r, max(lo, min(len(ramps[r]) - 1, l + d)))


def apply_pattern(pix, body_idx, W, H, muster, ramps, bi, leuchtet):
    if muster in (None, "", "keins"):
        return
    rng = bi["rng"]
    ct, cb, dist = bi["col_top"], bi["col_bot"], bi["dist"]
    sx, L = bi["snout_x"], bi["body_len"]
    klasse = bi["klasse"]
    unit = {"S": 1, "M": 2, "L": 3, "XL": 4, "Boss": 7}[klasse]
    vertical = bi["vertical"]

    def coords(i):
        x, y = i % W, i // W
        if vertical:
            rl, rr = bi["row_l"][y], bi["row_r"][y]
            v = (x - rl) / max(1, rr - rl)
            u = y / H
            return x, y, u, v
        u = (sx - x) / max(1, L)
        v = (y - ct[x]) / max(1, cb[x] - ct[x])
        return x, y, u, v

    hit = set()
    shift = set()
    glow = leuchtet
    if muster == "querstreifen":
        n = 4 + rng.randint(0, 2) if klasse in ("S", "M") else 5 + rng.randint(0, 2)
        w = max(1.0, L * 0.05)
        cents = [0.24 + (0.88 - 0.24) * (k + 0.5) / n for k in range(n)]
        slant = rng.uniform(-0.25, 0.1)
        for i in body_idx:
            x, y, u, v = coords(i)
            if v > 0.85:
                continue
            for c in cents:
                xc = sx - c * L + slant * (y - (ct[x] + cb[x]) / 2)
                if abs(x - xc) < w * (1.0 - 0.35 * v) / 1.0 * 0.5 + 0.25:
                    hit.add(i)
    elif muster == "laengsband":
        for i in body_idx:
            x, y, u, v = coords(i)
            if 0.12 < u < 0.97 and 0.36 < v < 0.54:
                hit.add(i)
    elif muster in ("punkte", "leuchtpunkte"):
        spc = max(3, int(round((max(cb) - min(t for t in ct if t < H)) * 0.25)))
        if muster == "leuchtpunkte":
            # Reihen entlang Seitenlinie und Bauch
            for i in body_idx:
                x, y, u, v = coords(i)
                if dist[i] < 2 or u < 0.18 or u > 0.95:
                    continue
                row1 = abs(v - 0.5) < 0.5 / max(3, cb[x] - ct[x])
                row2 = abs(v - 0.8) < 0.5 / max(3, cb[x] - ct[x])
                if (row1 or row2) and (x % max(3, spc - 1) == 0):
                    hit.add(i)
            glow = True
        else:
            sz = 1 if klasse in ("S", "M", "L") else 2
            pts = []
            y0 = min(t for t in ct if t < H)
            for gy in range(y0, H, spc):
                for gx in range(0, W, spc):
                    jx = gx + rng.randint(0, spc - 1) + ((gy // spc) % 2) * spc // 2
                    jy = gy + rng.randint(0, max(0, spc - 2))
                    pts.append((jx, jy))
            bset = set(body_idx)
            for (px_, py_) in pts:
                for dx in range(sz):
                    for dy in range(sz):
                        i = (py_ + dy) * W + px_ + dx
                        if 0 <= px_ + dx < W and 0 <= py_ + dy < H and i in bset and dist[i] >= 2:
                            x, y, u, v = coords(i)
                            if 0.1 < u < 0.98 and (v < 0.8 or vertical):
                                hit.add(i)
    elif muster == "flecken":
        hmax = max(cb[x] - ct[x] for x in range(W) if ct[x] < H)
        r = max(1.0, hmax * 0.085)
        blobs = []
        rows = 2 if klasse in ("S", "M") else 3
        for row in range(rows):
            vrow = 0.2 + 0.42 * row / max(1, rows - 1) if rows > 1 else 0.4
            n = max(2, int(L / (r * 4.4)))
            for k in range(n):
                u = 0.2 + 0.72 * (k + 0.5 + (row % 2) * 0.5) / n
                blobs.append((u + rng.uniform(-0.03, 0.03), vrow + rng.uniform(-0.06, 0.06),
                              r * rng.uniform(0.8, 1.25)))
        for i in body_idx:
            x, y, u, v = coords(i)
            hgt = max(1, cb[x] - ct[x])
            for (bu, bv, br) in blobs:
                dx = (u - bu) * L / (br * 1.3)
                dy = (v - bv) * hgt / br
                if dx * dx + dy * dy <= 1.0 and dist[i] >= 2:
                    hit.add(i)
                    break
    elif muster == "netz":
        spc = max(3.0, unit * 2.2)
        seeds = []
        for gy in range(-1, int(H / spc) + 2):
            for gx in range(-1, int(W / spc) + 2):
                seeds.append(((gx + rng.random()) * spc, (gy + rng.random()) * spc))
        for i in body_idx:
            x, y = i % W, i // W
            ds = sorted((x - a) ** 2 + (y - b) ** 2 for a, b in seeds)[:2]
            if math.sqrt(ds[1]) - math.sqrt(ds[0]) < 0.9 and dist[i] >= 2:
                hit.add(i)
    elif muster == "sattel":
        n = 3 + rng.randint(0, 1)
        cents = [0.25 + 0.6 * (k + 0.5) / n for k in range(n)]
        for i in body_idx:
            x, y, u, v = coords(i)
            for c in cents:
                du = abs(u - c) * L
                if du < L * 0.055 * (1.2 - v) and v < 0.6:
                    hit.add(i)
    elif muster == "marmor":
        nz = vnoise(rng.randint(0, 10 ** 6))
        f = 1.0 / max(2.0, unit * 2.2)
        for i in body_idx:
            x, y = i % W, i // W
            val = nz(x * f, y * f * 1.4) * 0.7 + nz(x * f * 2.3 + 7, y * f * 2.3) * 0.3
            if val > 0.62:
                hit.add(i)
            elif val < 0.30:
                shift.add(i)
    elif muster == "ringe":
        spc = max(3, unit + 2)
        for i in body_idx:
            x, y, u, v = coords(i)
            if 0.14 < u < 0.97:
                wob = math.sin(v * 3.0 + x * 0.3) * 0.8
                if vertical:
                    if int(y + wob) % spc == 0:
                        hit.add(i)
                elif int(x + wob) % spc == 0:
                    hit.add(i)
    elif muster == "schuppen":
        scale_arcs(pix, W, H, bi, ramps, 0.18, bright_edge=True, accent=True)
        return
    elif muster == "platten":
        rows = (0.14, 0.48, 0.82) if klasse not in ("S",) else (0.2, 0.6)
        spc = max(3, unit * 2 + 1)
        rr = max(1, unit // 2 + (1 if klasse in ("L", "XL", "Boss") else 0))
        for i in body_idx:
            x, y, u, v = coords(i)
            if u < 0.18 or u > 0.95:
                continue
            hgt = max(1, cb[x] - ct[x])
            for k, rv in enumerate(rows):
                cy = ct[x] + rv * hgt
                cxm = (x + (k % 2) * spc // 2) % spc
                dx = min(cxm, spc - cxm)
                if dx + abs(y - cy) <= rr:
                    hit.add(i)
                    break
    elif muster == "risse":
        cracks = set()
        n = 3 + (2 if bi["big"] else 0)
        bset = set(body_idx)
        bl = list(body_idx)
        for k in range(n):
            i = bl[rng.randrange(len(bl))]
            x, y = i % W, i // W
            dx, dy = rng.choice(((1, 0), (-1, 0))), 0
            steps = int(L * rng.uniform(0.25, 0.5))
            for _ in range(steps):
                if rng.random() < 0.35:
                    dy = rng.choice((-1, 0, 1))
                x += dx[0] if isinstance(dx, tuple) else dx
                y += dy
                j = y * W + x
                if j in bset:
                    cracks.add(j)
                    if rng.random() < 0.08:
                        # Abzweig
                        yy, xx = y, x
                        for _ in range(rng.randint(2, 5)):
                            yy += rng.choice((-1, 1))
                            xx += rng.choice((-1, 0, 1))
                            jj = yy * W + xx
                            if jj in bset:
                                cracks.add(jj)
        hit |= {i for i in cracks if dist[i] >= 2}
    elif muster == "hexagon":
        size = max(2.5, unit * 1.6)
        for i in body_idx:
            x, y = i % W, i // W
            qx = (x * 2 / 3) / size
            ry = (-x / 3 + math.sqrt(3) / 3 * y) / size
            # Achsial → Würfel, Abstand zur Zellmitte
            cx, cz = qx, ry
            cy_ = -cx - cz
            rx, rz, ryy = round(cx), round(cz), round(cy_)
            dxx, dzz, dyy = abs(rx - cx), abs(rz - cz), abs(ryy - cy_)
            m = max(dxx, dzz, dyy)
            if m > 0.38 and dist[i] >= 1.5:
                hit.add(i)
    elif muster == "wellen":
        rows = 3 if klasse in ("S", "M") else 4
        per = max(4.0, unit * 3.5)
        for i in body_idx:
            x, y, u, v = coords(i)
            hgt = max(1, cb[x] - ct[x])
            for k in range(rows):
                vy = 0.18 + 0.62 * k / max(1, rows - 1)
                yy = ct[x] + vy * hgt + math.sin(x / per * 2 * math.pi + k) * (unit * 0.8 + 0.5)
                if abs(y - yy) < 0.5 and 0.1 < u < 0.97:
                    hit.add(i)
    for i in hit:
        if pix[i] is None:
            continue
        cur = pix[i][0]
        if muster == "hexagon" and not leuchtet:
            pix[i][0] = shift_key(ramps, cur, -2)
            continue
        pix[i][0] = acc_key(ramps, cur, leucht=glow and muster in ("leuchtpunkte", "risse", "hexagon", "punkte",
                                                                    "flecken", "wellen", "laengsband", "ringe",
                                                                    "querstreifen", "netz", "sattel", "marmor",
                                                                    "platten"))
        if glow:
            pix[i][1] |= F_GLOW
    for i in shift:
        if pix[i] is not None and i not in hit:
            pix[i][0] = shift_key(ramps, pix[i][0], -1)


SCALE_TILES = {
    # (Bogen-Pixel relativ zur Schuppenmitte, helle Kante, dx, dy) – Bögen „(“ zeigen zum Schwanz
    "S": ([(0, 0)], [], 3, 2),
    "M": ([(-1, -1), (-2, 0), (-1, 1)], [(-1, 0)], 4, 2),
    "L": ([(-1, -1), (-2, 0), (-1, 1)], [(-1, 0)], 4, 2),
    "XL": ([(-1, -2), (-2, -1), (-2, 0), (-2, 1), (-1, 2)], [(-1, -1), (-1, 0)], 5, 3),
    "Boss": ([(0, -2), (-1, -2), (-2, -1), (-2, 0), (-2, 1), (-1, 2), (0, 2)], [(-1, -1), (-1, 0)], 6, 3),
}


def scale_arcs(pix, W, H, bi, ramps, gill_u, bright_edge=False, accent=False):
    """Versetztes Halbmond-Raster: Bogenpixel eine Stufe dunkler, optional helle Kante."""
    ct, cb, dist = bi["col_top"], bi["col_bot"], bi["dist"]
    sx, L = bi["snout_x"], bi["body_len"]
    kl = bi["klasse"]
    if accent:   # Muster "schuppen": große, klar abgesetzte Schuppen
        kl = {"S": "M", "M": "L", "L": "XL", "XL": "Boss", "Boss": "Boss"}[kl]
    arc, edge, dx, dy = SCALE_TILES[kl]
    arcs, edges = set(), set()
    y0 = min(t for t in ct if t < H)
    y1 = max(cb)

    def ok(px, py):
        if not (0 <= px < W and 0 <= py < H):
            return False
        i = py * W + px
        if pix[i] is None or dist[i] < 2.4 or ct[px] >= H:
            return False
        u = (sx - px) / max(1, L)
        v = (py - ct[px]) / max(1, cb[px] - ct[px])
        return gill_u + 0.04 < u < 0.94 and 0.1 < v < 0.88

    row = 0
    for cy in range(y0, y1 + dy, dy):
        off = (row % 2) * (dx // 2)
        for cx in range(off, W + dx, dx):
            for (ax, ay) in arc:
                if ok(cx + ax, cy + ay):
                    arcs.add((cy + ay) * W + cx + ax)
            if bright_edge:
                for (ax, ay) in edge:
                    if ok(cx + ax, cy + ay):
                        edges.add((cy + ay) * W + cx + ax)
        row += 1
    for i in arcs:
        if pix[i] and pix[i][0][0] in ("main", "belly", "acc"):
            pix[i][0] = shift_key(ramps, pix[i][0], -1)
    for i in edges - arcs:
        if pix[i] and pix[i][0][0] in ("main", "belly", "acc"):
            if accent:
                pix[i][0] = acc_key(ramps, pix[i][0])
            else:
                pix[i][0] = shift_key(ramps, pix[i][0], +1)


def lateral_line(pix, W, H, bi, ramps, gill_u):
    ct, cb = bi["col_top"], bi["col_bot"]
    sx, L = bi["snout_x"], bi["body_len"]
    for x in range(W):
        if ct[x] >= H:
            continue
        u = (sx - x) / max(1, L)
        if gill_u + 0.04 < u < 0.95 and x % 2 == 0:
            y = int(round(ct[x] + 0.42 * (cb[x] - ct[x])))
            i = y * W + x
            if pix[i] and bi["dist"][i] >= 2:
                pix[i][0] = shift_key(ramps, pix[i][0], +1)


def back_reflex(pix, W, H, bi, ramps):
    ct = bi["col_top"]
    sx, L = bi["snout_x"], bi["body_len"]
    for x in range(W):
        if ct[x] >= H:
            continue
        u = (sx - x) / max(1, L)
        if 0.22 < u < 0.38:
            i = (ct[x] + 2) * W + x
            if pix[i] and pix[i][0][0] == "main" and bi["dist"][i] >= 2:
                pix[i][0] = ("main", 4)


def gill_arc(pix, lab, W, H, bi, ramps, gill_u):
    ct, cb = bi["col_top"], bi["col_bot"]
    sx, L = bi["snout_x"], bi["body_len"]
    xg = int(round(sx - gill_u * L))
    if not (0 <= xg < W) or ct[xg] >= H:
        return None
    t, b = ct[xg], cb[xg]
    hgt = b - t
    c = max(0.0, hgt * 0.1)
    mid = None
    prev = None
    for y in range(t + 1, b):
        v = (y - t) / max(1, hgt)
        if not (0.16 <= v <= 0.74):
            continue
        k = (v - 0.45) / 0.29
        x = int(round(xg - c * (1 - k * k)))
        i = y * W + x
        if 0 <= x < W and pix[i] and lab[i] == BODY:
            pix[i][0] = shift_key(ramps, pix[i][0], -1)
            # Lücken in der Treppenlinie schließen
            if prev is not None and abs(prev - x) > 1:
                j = y * W + (x + prev) // 2
                if pix[j] and lab[j] == BODY:
                    pix[j][0] = shift_key(ramps, pix[j][0], -1)
            prev = x
            if mid is None and v >= 0.42:
                mid = i
    return mid


def find_shine(pix, W, H, bi):
    ct = bi["col_top"]
    sx, L = bi["snout_x"], bi["body_len"]
    x = int(sx - 0.3 * L)
    if 0 <= x < W and ct[x] < H:
        for y in range(ct[x] + 1, ct[x] + 5):
            i = y * W + x
            if pix[i] and pix[i][0][0] == "main" and pix[i][0][1] <= 3:
                return i
    return None


# --------------------------------------------------------------------------- Flossen / Merkmale

def color_fins(pix, lab, fininfo, W, H, ramps, klasse, merk, scl, T, leuchtet):
    sx_, s = scl
    nf = len(ramps["fin"])
    big = klasse in ("L", "XL", "Boss")
    ray_sp = {"L": 3, "XL": 4, "Boss": 5}.get(klasse, 0)
    flame = "flammen" in merk
    na = len(ramps["acc"])
    for i, part in fininfo.items():
        if lab[i] not in (FIN, TAIL):
            continue
        x, y = i % W, i // W
        px, py = x + .5, y + .5
        info = part.info
        t_px, hf = 0.0, 0.5
        if "Pa" in info:
            Pa = T(*info["Pa"])
            Pb = T(*info["Pb"])
            D = (info["D"][0] * sx_, info["D"][1] * s)
            bx, by = Pb[0] - Pa[0], Pb[1] - Pa[1]
            det = bx * D[1] - by * D[0]
            if abs(det) > 1e-6:
                rx, ry = px - Pa[0], py - Pa[1]
                tt = (rx * D[1] - ry * D[0]) / det
                hh = (bx * ry - by * rx) / det
                t_px = tt * math.hypot(bx, by)
                hf = hh
        elif "origin" in info:
            o = T(*info["origin"])
            ang = math.atan2(py - o[1], o[0] - px)
            r = math.hypot(px - o[0], py - o[1])
            t_px = ang * max(4.0, info["len"] * sx_)
            hf = r / max(1.0, info["len"] * sx_ * 1.05)
        elif info.get("saum"):
            hf = 0.7
            t_px = x * 0.7
        if hf > 0.72:
            lvl = nf - 1
        else:
            lvl = max(0, nf - 2)
        if big and ray_sp and 0.12 < hf < 0.9 and int(math.floor(t_px)) % ray_sp == 0:
            lvl = max(0, lvl - 1)
        elif not big and hf < 0.18 and nf > 2:
            lvl = 0
        key = ("fin", min(nf - 1, lvl))
        flags = 0
        if flame and hf > 0.45:
            key = ("acc", na - 1 if hf > 0.7 else max(0, na - 2))
            if leuchtet:
                flags |= F_GLOW
        pix[i] = [key, flags]


def color_features(pix, lab, feat_kind, W, H, ramps, rng):
    for i, kind in feat_kind.items():
        if not lab[i]:
            continue
        x, y = i % W, i // W
        if kind in ("crown", "lobe"):
            n = len(ramps["acc"])
            up = lab[i - W] if y > 0 else 0
            lft = lab[i - 1] if x > 0 else 0
            lvl = n - 1 if (up == 0 or lft == 0) else max(0, n - 2)
            pix[i] = [("acc", lvl), 0]
        elif kind == "horn":
            n = len(ramps["belly"])
            lft = lab[i - 1] if x > 0 else 0
            pix[i] = [("belly", n - 1 if lft == 0 else max(0, n - 2)), 0]
        elif kind == "crystal":
            n = len(ramps["acc"])
            # Facetten: linke Hälfte hell, rechte dunkler
            run_l = 0
            k = i
            while k % W > 0 and lab[k - 1] == FEAT and feat_kind.get(k - 1) == "crystal":
                run_l += 1
                k -= 1
            run_r = 0
            k = i
            while k % W < W - 1 and lab[k + 1] == FEAT and feat_kind.get(k + 1) == "crystal":
                run_r += 1
                k += 1
            lvl = n - 1 if run_l <= run_r else max(0, n - 3)
            pix[i] = [("acc", lvl), 0]
        elif kind == "stalk":
            pix[i] = [("fin", len(ramps["fin"]) - 1), F_PROTECT]
        elif kind == "barbel":
            pix[i] = [("main", 0), 0]
        elif kind == "barbel_in":
            if pix[i] is not None and lab[i] == BODY:
                pix[i] = [shift_key(ramps, pix[i][0], -2), 0]
        elif kind == "spike":
            pix[i] = [("fin", 0), 0]
        elif kind == "moss":
            r = "moss" if "moss" in ramps else "acc"
            pix[i] = [(r, len(ramps[r]) - 1), F_PROTECT]
        elif kind == "moss_patch":
            r = "moss" if "moss" in ramps else "acc"
            if pix[i] is not None:
                pix[i] = [(r, rng.randint(0, len(ramps[r]) - 1)), 0]
        elif kind == "leg":
            pix[i] = [("fin", 1), 0]


def draw_mouth(pix, lab, W, H, mouth_px, q, merk, ramps, klasse, boss, bi, sp):
    mx, my = mouth_px
    sx = bi["snout_x"]
    y = int(math.floor(my))
    base = {"S": 1, "M": 2, "L": 3, "XL": 4, "Boss": 7}[klasse]
    mlen = max(1, int(round(base * q.get("mouth", 1.0))))
    if bi["shape"] in ("rochen", "plattfisch"):
        mlen = max(1, mlen // 2)
    # Schnauzenspitze in dieser Reihe finden
    row = [x for x in range(W) if lab[y * W + x] == BODY] if 0 <= y < H else []
    if not row:
        return
    tip = max(row)
    big_mouth = "maul_gross" in merk or bi["shape"] == "kopflastig"
    tooth = ("tooth", 0) if "tooth" in ramps else lightest_key(ramps)
    teeth = "zaehne" in merk
    for k in range(1, mlen + 1):
        x = tip - k
        yy = y + (1 if big_mouth and k > mlen * 0.75 else 0)
        i = yy * W + x
        if 0 <= x < W and lab[i] == BODY:
            pix[i] = [("main", 0), 0]
            if teeth and k % 2 == 0 and klasse != "S":
                j = i - W
                if lab[j] == BODY and pix[j] is not None:
                    pix[j] = [tooth, F_PROTECT]
    gh = {"S": 0, "M": 1, "L": 1, "XL": 2, "Boss": 3}[klasse] if big_mouth else 0
    if gh:
        # offenes Maul: keilförmige Kerbe an der Schnauze, Zähne an den Kiefern
        n_open = max(2, mlen // 3)
        for k in range(n_open):
            g = int(round(gh * (1 - k / n_open)))
            x = tip - k
            for dy in range(-g, g + 1):
                i = (y + dy) * W + x
                if 0 <= x < W and 0 <= y + dy < H and lab[i] == BODY:
                    lab[i] = EMPTY
                    pix[i] = None
            if teeth:
                for side in (-1, 1):
                    j = (y + side * (g + 1)) * W + x
                    if k % 2 == 0 and 0 <= j < W * H and lab[j] == BODY:
                        pix[j] = [tooth, F_PROTECT]
                        if boss and g >= 1:
                            jj = (y + side * g) * W + x
                            lab[jj] = FEAT
                            pix[jj] = [tooth, F_PROTECT]
    elif teeth and klasse == "S":
        j = (y - 1) * W + tip - 1
        if 0 <= j < W * H and lab[j] == BODY:
            pix[j] = [tooth, F_PROTECT]
    if "hauer" in merk:
        x0 = tip - mlen
        for k in range(0, base + 2):
            x, yy = x0 + k // 2 + 1, y + 1 + k
            if 2 <= x < W - 2 and 2 <= yy < H - 2:
                i = yy * W + x
                lab[i] = FEAT
                pix[i] = [tooth, F_PROTECT]
    if "haken" in merk:
        nh = 5 if boss else 1
        mr = "metal" if "metal" in ramps else "belly"
        nm = len(ramps[mr])
        for k in range(nh):
            x = tip - 2 - k * max(2, base // 2 + 1)
            # unterste Körperzeile in dieser Spalte
            col = [yy for yy in range(H) if lab[yy * W + x] == BODY]
            if not col:
                continue
            yb = max(col)
            ln = 2 + (k % 3)
            for d in range(1, ln + 1):
                yy = yb + d
                if yy < H - 2:
                    i = yy * W + x
                    lab[i] = FEAT
                    pix[i] = [(mr, nm - 1 if d == 1 else max(0, nm - 2)), F_PROTECT]
            yy = yb + ln
            xx = x + 1
            if yy < H - 2 and xx < W - 2:
                i = yy * W + xx
                lab[i] = FEAT
                pix[i] = [(mr, max(0, nm - 2)), F_PROTECT]
                if yy - 1 > yb:
                    j = (yy - 1) * W + xx + 1
                    if xx + 1 < W - 2:
                        lab[j] = FEAT
                        pix[j] = [(mr, nm - 1), F_PROTECT]


def lightest_key(ramps):
    best, bl = ("belly", len(ramps["belly"]) - 1), -1
    for r, cols in ramps.items():
        if r == "white":
            continue
        for l, c in enumerate(cols):
            L = C.rgb_to_oklab(c)[0]
            if L > bl:
                best, bl = (r, l), L
    return best


def scars(pix, lab, W, H, bi, ramps, rng, eye):
    ex, ey = eye
    n = 3
    for k in range(n):
        x0 = int(ex - 6 - rng.randint(0, 10))
        y0 = int(ey - 4 + rng.randint(0, 10))
        ln = rng.randint(4, 7)
        for t in range(ln):
            x, y = x0 + t, y0 + t // 2 * (1 if k % 2 else -1)
            i = y * W + x
            if 0 <= x < W and 0 <= y < H and lab[i] == BODY and pix[i] and bi["dist"][i] >= 2.5:
                pix[i][0] = shift_key(ramps, pix[i][0], +2) if pix[i][0][0] != "acc" else pix[i][0]


def draw_eye(sp, pix, lab, W, H, center, e, ramps, has_iris, klasse, main=True):
    cx, cy = center
    x0 = int(round(cx - e / 2))
    y0 = int(round(cy - e / 2))
    c = (e - 1) / 2
    if has_iris:
        iris_l = ("iris", len(ramps["iris"]) - 1)
        iris_d = ("iris", 0)
    else:
        nb = len(ramps["belly"])
        iris_l = ("belly", nb - 1)
        iris_d = ("belly", max(0, nb - 2))
    pupil = ("main", 0)
    sp.pupil_key = pupil
    cells = []
    for j in range(e):
        for i in range(e):
            dx, dy = i - c, j - c
            d2 = dx * dx + dy * dy
            if e == 2 or d2 <= (e / 2) ** 2 + 0.3:
                cells.append((i, j, d2))
    pupils = []
    for (i, j, d2) in cells:
        x, y = x0 + i, y0 + j
        if not (0 <= x < W and 0 <= y < H):
            continue
        k = y * W + x
        if e == 2:
            key = pupil if (i, j) == (1, 1) else iris_l
            if (i, j) == (1, 0):
                key = iris_d if klasse != "S" else iris_l
        elif e <= 5:
            rp2 = 0.6
            if d2 <= rp2:
                key = pupil
            elif i + j < e - 1:
                key = iris_l
            else:
                key = iris_d
        else:
            rp2 = 0.6 if e == 6 else 2.2
            ring2 = (e / 2 - 1) ** 2 + 0.3
            if d2 <= rp2:
                key = pupil
            elif d2 <= ring2:
                key = iris_l if j < c else iris_d
            else:
                key = ("main", 0)
        if lab[k] == EMPTY:
            continue
        pix[k] = [key, F_PROTECT | (F_PUPIL if (main and key == pupil) else 0)]
        if key == pupil:
            pupils.append((x, y, k))
        if e == 2 and (i, j) == (0, 0):
            pupils.append((x, y, k))
    if main:
        if e == 2:
            x, y, k = x0, y0, y0 * W + x0
        else:
            x, y, k = min(pupils, key=lambda p: (p[0] + p[1], p[1]))
        if 0 <= k < W * H and pix[k] is not None:
            pix[k] = [("white", 0), F_PROTECT | F_WHITE | F_PUPIL]
            sp.white_xy = (x, y)


# --------------------------------------------------------------------------- Farblimit & Ausgabe

def finalize_colors(sp: Sprite):
    """Benutzte Farben zählen (inkl. Outline/Blink-Farben) und auf das Limit zusammenlegen."""
    limit = C.COLOR_LIMIT[sp.klasse if not sp.fish["boss"] else "Boss"]
    count = {}
    for p in list(sp.pix) + list(sp.pect.values()):
        if p:
            count[p[0]] = count.get(p[0], 0) + 1
    for k in (("main", 0), ("main", 1), sp.gill_alt, sp.shine_alt):
        if k:
            count[k] = count.get(k, 0) + 1
    rgb = {k: sp.ramps[k[0]][k[1]] for k in count}
    # Schlüssel mit identischer Farbe zusammenfassen
    mapping = {k: k for k in count}
    while True:
        groups = {}
        for k in count:
            rep = mapping[k]
            groups.setdefault(rgb[rep], set()).add(rep)
        reps = sorted({mapping[k] for k in count}, key=lambda k: -count.get(k, 0))
        distinct = {}
        for r in reps:
            distinct.setdefault(rgb[r], r)
        if len(distinct) <= limit:
            break
        # nächstgelegenes Paar (OKLab) zusammenlegen, Weiß/Outline bleiben
        cand = [r for r in distinct.values() if r[0] != "white"]
        best = None
        for a in range(len(cand)):
            for b in range(a + 1, len(cand)):
                d = C.oklab_dist(rgb[cand[a]], rgb[cand[b]])
                if best is None or d < best[0]:
                    best = (d, cand[a], cand[b])
        _, ka, kb = best
        keep, drop = (ka, kb)
        if keep in (("main", 0), ("main", 1)) or count.get(keep, 0) >= count.get(drop, 0):
            pass
        else:
            keep, drop = drop, keep
        if drop in (("main", 0),):
            keep, drop = drop, keep
        for k in list(mapping):
            if mapping[k] == drop or rgb[mapping[k]] == rgb[drop]:
                mapping[k] = keep
    sp.colors = {k: tuple(rgb[mapping[k]]) for k in count}
    sp.merged = sum(1 for k in count if mapping[k] != k)


def outline_key(sp, up_left_only):
    return ("main", 1) if up_left_only else ("main", 0)


def compose(sp: Sprite, pix=None, pect=None):
    """Pixelliste → RGBA-Bild mit selektiver 1-px-Outline aus der Alpha-Maske."""
    W, H = sp.w, sp.h
    pix = sp.pix if pix is None else pix
    pect = sp.pect if pect is None else pect
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    data = [(0, 0, 0, 0)] * (W * H)
    dark = sp.key_rgb(("main", 0))
    light = sp.key_rgb(("main", 1))
    for i, p in enumerate(pix):
        if p is None:
            continue
        x, y = i % W, i // W
        key, flags = p
        ov = pect.get(i)
        if ov is not None:
            key, flags = ov[0], ov[1] | (flags & ~0)
        if not flags & F_PROTECT:
            up = y == 0 or pix[i - W] is None
            dn = y == H - 1 or pix[i + W] is None
            lf = x == 0 or pix[i - 1] is None
            rt = x == W - 1 or pix[i + 1] is None
            if up or dn or lf or rt:
                data[i] = (light if (up or lf) and not (dn or rt) else dark) + (255,)
                continue
        data[i] = sp.key_rgb(key) + (255,)
    img.putdata(data)
    return img


def save_sprite(sp: Sprite, out_dir: str, seed: int, extra: dict):
    f = sp.fish
    C.ensure_dir(out_dir)
    img = compose(sp)
    img.save(os.path.join(out_dir, f"{f['assetKey']}.png"))
    gen = {
        "generator": "tools/art/fishgen.py",
        "version": C.GENERATOR_VERSION,
        "modell": "prozedural (F8), kein Bild-KI-Prompt",
        "seed": seed,
        "fishId": f["id"],
        "assetKey": f["assetKey"],
        "klasse": f["klasse"],
        "canvas": list(f["canvas"]),
        "seltenheit": f["rarity"],
        "boss": f["boss"],
        "parameter": sp.params,
        "farbenGenutzt": len(set(img.get_flattened_data()) - {(0, 0, 0, 0)}) if hasattr(img, "get_flattened_data") else len(set(img.getdata()) - {(0, 0, 0, 0)}),
        "farbLimit": C.COLOR_LIMIT["Boss" if f["boss"] else f["klasse"]],
        "farbenZusammengelegt": getattr(sp, "merged", 0),
        "rampen": {k: [C.rgb_to_hex(c) for c in v] for k, v in sp.ramps.items()},
        "platzhalter": bool(f["boss"] or f["rarity"] == "legendaer"),
    }
    gen.update(extra)
    with open(os.path.join(out_dir, f"{f['assetKey']}.gen.json"), "w", encoding="utf-8") as fh:
        json.dump(gen, fh, indent=2, ensure_ascii=False)
    return img


# --------------------------------------------------------------------------- Hauptprogramm

def process(fish):
    import animate  # lokal, damit Worker-Prozesse sauber importieren
    t0 = time.time()
    seed = C.seed_for(fish["id"])
    sp = build_sprite(fish)
    out_dir = os.path.join(C.FISH_DIR, fish["kuerzel"])
    frames = animate.make_frames(sp)
    frame_dir = os.path.join(out_dir, "frames")
    C.ensure_dir(frame_dir)
    for name, im in frames.items():
        im.save(os.path.join(frame_dir, f"{name}.png"))
    meta = animate.LAST_META.get(fish["assetKey"], {})
    save_sprite(sp, out_dir, seed, {"animation": meta})
    return fish["id"], fish["assetKey"], len(frames), time.time() - t0


def clean_stale(fishes):
    keep = {f["assetKey"] for f in fishes}
    if not os.path.isdir(C.FISH_DIR):
        return
    for k in os.listdir(C.FISH_DIR):
        d = os.path.join(C.FISH_DIR, k)
        if not os.path.isdir(d):
            continue
        for sub in (d, os.path.join(d, "frames")):
            if not os.path.isdir(sub):
                continue
            for fn in os.listdir(sub):
                if not fn.startswith("fish_"):
                    continue
                stem = fn.split(".")[0]
                ak = stem
                for clip in ("_swim_", "_idle_", "_struggle_", "_caught_", "_silhouette_", "_emission_"):
                    if clip in stem:
                        ak = stem.split(clip)[0]
                        break
                if ak not in keep:
                    os.remove(os.path.join(sub, fn))


def main(argv):
    db = C.resolve_db_path(argv)
    only = None
    jobs = min(4, os.cpu_count() or 1)
    for a in argv[1:]:
        if a.startswith("--only="):
            only = set(a.split("=", 1)[1].split(","))
        if a.startswith("--jobs="):
            jobs = int(a.split("=", 1)[1])
    fishes = C.load_db(db)
    print(f"fishgen {C.GENERATOR_VERSION}: {len(fishes)} Fische aus {os.path.relpath(db, C.ROOT)}")
    for k in sorted({f["kuerzel"] for f in fishes}):
        P.save_world_palette(k)
    if only:
        fishes_run = [f for f in fishes if f["id"] in only or f["assetKey"] in only]
    else:
        fishes_run = fishes
        clean_stale(fishes)
    t0 = time.time()
    results = []
    if jobs > 1 and len(fishes_run) > 2:
        with ProcessPoolExecutor(max_workers=jobs) as ex:
            for r in ex.map(process, fishes_run):
                results.append(r)
    else:
        for f in fishes_run:
            results.append(process(f))
    for fid, ak, nfr, dt in results:
        print(f"  {fid}  {ak:45s} {nfr:3d} Frames  {dt:5.2f}s")
    print(f"fertig: {len(results)} Fische in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main(sys.argv)

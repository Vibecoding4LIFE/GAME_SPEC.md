#!/usr/bin/env python3
"""Animationen aus dem Standbild (GAME_SPEC Teil F5) – alles per Code, ganze Pixel.

  swim      6 Frames (S: 4)  Spalten hinter dem vorderen Drittel um round(A·sin(2π·t/N + k·x)) versetzt,
                             A = 1 px (S/M) bzw. 2 px (L/XL/Boss), zum Schwanz steigend; Schwanz in
                             Frame 2 und 5 (S: 2 und 4) um 1 px gestaucht; Outline danach neu
  idle      4 Frames         Körper 1 px auf/ab, Brustflosse ±1 px, Kiemenpixel blinkt in Frame 3
  struggle  4 Frames         wie swim mit doppelter Amplitude und ±1 px Zittern
  caught    3 Frames         Pose nach oben gekippt (8× Nearest hoch → drehen → runter), 2 Zappel-Frames,
                             Glanzpixel blinkt
  silhouette_0               Alpha-Maske in #14161C mit 1-px-Outline in Seltenheitsfarbe
  emission_0                 nur Leuchtpixel (bei art.leuchtet)

fishgen.py ruft make_frames() direkt auf. Einzeln: python3 tools/art/animate.py [db] [--only=F014]
(baut die Sprites deterministisch neu und schreibt nur die Frames).
"""
from __future__ import annotations

import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

LAST_META: dict = {}
SIL_FILL = (0x14, 0x16, 0x1C, 255)


def _fg():
    import fishgen
    return fishgen


def merged(sp):
    out = list(sp.pix)
    for i, p in sp.pect.items():
        if p is not None and out[i] is not None:
            out[i] = [p[0], p[1] | (out[i][1] & 0)]
    return out


def displace(sp, comp, offs, src_col=None, jitter=(0, 0), vertical=False):
    W, H = sp.w, sp.h
    out = [None] * (W * H)
    jx, jy = jitter
    for y in range(H):
        for x in range(W):
            sx = src_col[x] if src_col is not None else x
            if sx is None or not (0 <= sx < W):
                continue
            p = comp[y * W + sx]
            if p is None:
                continue
            if vertical:
                nx, ny = x + offs[y] + jx, y + jy
            else:
                nx, ny = x + jx, y + offs[x] + jy
            if 0 <= nx < W and 0 <= ny < H:
                out[ny * W + nx] = p
    return out


def wave_offsets(sp, t, n, amp):
    W, H = sp.w, sp.h
    offs = [0] * (H if sp.vertical else W)
    if sp.vertical:
        # Seepferdchen: Kopf fest, Schwanz pendelt (Zeilen horizontal versetzt)
        ys = [i // W for i, p in enumerate(sp.pix) if p is not None]
        y0, y1 = min(ys), max(ys)
        y_fix = y0 + (y1 - y0) // 3
        span = max(1, y1 - y_fix)
        k = 2 * math.pi / (span * 1.3)
        for y in range(H):
            if y > y_fix:
                a = amp * ((y - y_fix) / span) ** 0.9
                offs[y] = int(round(a * math.sin(2 * math.pi * t / n + k * y)))
        return offs
    x_front = sp.snout_x - (sp.snout_x - sp.tail_x) // 3
    span = max(1, x_front - sp.tail_x)
    k = 2 * math.pi / (span * 1.25)
    for x in range(W):
        if x < x_front:
            a = amp * ((x_front - x) / span) ** 0.9
            offs[x] = int(round(a * math.sin(2 * math.pi * t / n + k * x)))
    return offs


def squeeze_cols(sp):
    """Schwanzflosse 1 px stauchen: Spalten hinter dem Schwanzstiel um 1 nach rechts."""
    W = sp.w
    src = list(range(W))
    ped = max(sp.tail_x + 1, min(sp.ped_x, sp.snout_x - 2))
    for x in range(sp.tail_x, ped + 1):
        src[x] = x - 1 if x - 1 >= sp.tail_x else None
    return src


def swim_frames(sp, n, amp, jitter_seq=None):
    fg = _fg()
    comp = merged(sp)
    frames = []
    sq_idx = {1, 4} if n == 6 else {1, 3}
    for t in range(n):
        offs = wave_offsets(sp, t, n, amp)
        src = squeeze_cols(sp) if (t in sq_idx and not sp.vertical and jitter_seq is None) else None
        jit = jitter_seq[t] if jitter_seq else (0, 0)
        pix = displace(sp, comp, offs, src, jit, sp.vertical)
        frames.append(fg.compose(sp, pix, {}))
    return frames


def idle_frames(sp):
    fg = _fg()
    W, H = sp.w, sp.h
    frames = []
    for t, (dy, pdy) in enumerate(((0, 0), (-1, 1), (0, 0), (1, -1))):
        base = [None if p is None else [p[0], p[1]] for p in sp.pix]
        for i, p in sp.pect.items():
            if p is None:
                continue
            x, y = i % W, i // W
            j = (y + pdy) * W + x
            if 0 <= y + pdy < H and base[j] is not None and not base[j][1] & fg.F_PROTECT:
                base[j] = [p[0], p[1]]
        if t == 2 and sp.gill_alt:
            for p in base:
                if p is not None and p[1] & fg.F_GILL:
                    p[0] = sp.gill_alt
        pix = displace(sp, base, [0] * (H if sp.vertical else W), None, (0, dy), sp.vertical)
        frames.append(fg.compose(sp, pix, {}))
    return frames


def _rotate_pix(sp, comp, theta):
    """8× Nearest hoch → drehen → runter (Rotsprite-light); liefert neue Pixelliste."""
    fg = _fg()
    W, H = sp.w, sp.h
    ids = {}
    table = [None]
    img = Image.new("L", (W, H), 0)
    vals = []
    for p in comp:
        if p is None:
            vals.append(0)
            continue
        k = (p[0], p[1])
        if k not in ids:
            ids[k] = len(table)
            table.append(k)
        vals.append(ids[k])
    if len(table) > 255:
        raise RuntimeError("zu viele Pixelzustände für die Rotation")
    img.putdata(vals)
    xs = [i % W for i, p in enumerate(comp) if p is not None]
    ys = [i // W for i, p in enumerate(comp) if p is not None]
    cx, cy = (min(xs) + max(xs) + 1) / 2, (min(ys) + max(ys) + 1) / 2
    up = img.resize((W * 8, H * 8), Image.NEAREST)
    rot = up.rotate(theta, resample=Image.NEAREST, center=(cx * 8, cy * 8), fillcolor=0)
    down = rot.resize((W, H), Image.NEAREST)
    out = []
    for v in down.getdata():
        out.append(None if v == 0 else [table[v][0], table[v][1]])
    # genau ein Weiß-Highlight: links-oben in der Pupille
    pupils = [i for i, p in enumerate(out) if p is not None and p[1] & fg.F_PUPIL]
    for i in pupils:
        out[i] = [sp.pupil_key, (out[i][1] | fg.F_PROTECT | fg.F_PUPIL) & ~fg.F_WHITE]
    for i, p in enumerate(out):
        if p is not None and p[1] & fg.F_WHITE:
            out[i] = [sp.pupil_key, p[1] & ~fg.F_WHITE]
    if pupils:
        i = min(pupils, key=lambda j: ((j % W) + (j // W), j // W))
        out[i] = [("white", 0), fg.F_PROTECT | fg.F_WHITE | fg.F_PUPIL]
    return out


def _fits(sp, pix, margin=1):
    W, H = sp.w, sp.h
    xs = [i % W for i, p in enumerate(pix) if p is not None]
    ys = [i // W for i, p in enumerate(pix) if p is not None]
    return min(xs) >= margin and min(ys) >= margin and max(xs) <= W - 1 - margin and max(ys) <= H - 1 - margin


def caught_frames(sp):
    fg = _fg()
    comp = merged(sp)
    theta = 20
    rot = None
    for th in range(20, 4, -2):
        r = _rotate_pix(sp, comp, th)
        n_before = sum(1 for p in comp if p is not None)
        n_after = sum(1 for p in r if p is not None)
        if _fits(sp, r, margin=1) and n_after >= n_before * 0.95:   # Randzeile frei = nichts abgeschnitten
            theta, rot = th, r
            break
    if rot is None:
        theta = 6
        rot = _rotate_pix(sp, comp, theta)
    frames = [fg.compose(sp, rot, {})]
    W, H = sp.w, sp.h
    xs = [i % W for i, p in enumerate(rot) if p is not None]
    x0, x1 = min(xs), max(xs)
    xmid = (x0 + x1) // 2 + (x1 - x0) // 6
    for t, sgn in ((1, 1), (2, -1)):
        offs = [0] * W
        for x in range(W):
            if x < xmid:
                offs[x] = sgn * int(round(1.0 * ((xmid - x) / max(1, xmid - x0)) ** 0.8 + 0.2))
        base = [None if p is None else [p[0], p[1]] for p in rot]
        if t == 1 and sp.shine_alt:
            for p in base:
                if p is not None and p[1] & fg.F_SHINE:
                    p[0] = sp.shine_alt
        pix = displace(sp, base, offs, None, (0, 0), False)
        frames.append(fg.compose(sp, pix, {}))
    return frames, theta


def silhouette(sp, still):
    W, H = sp.w, sp.h
    rc = C.hex_to_rgb(C.RARITY_COLOR[sp.fish["rarity"]]) + (255,)
    a = [p[3] for p in still.getdata()]
    out = []
    for i, v in enumerate(a):
        if not v:
            out.append((0, 0, 0, 0))
            continue
        x, y = i % W, i // W
        edge = (x == 0 or not a[i - 1]) or (x == W - 1 or not a[i + 1]) or \
            (y == 0 or not a[i - W]) or (y == H - 1 or not a[i + W])
        out.append(rc if edge else SIL_FILL)
    img = Image.new("RGBA", (W, H))
    img.putdata(out)
    return img


def emission(sp, still):
    fg = _fg()
    data = list(still.getdata())
    out = []
    for i, p in enumerate(sp.pix):
        glow = p is not None and p[1] & fg.F_GLOW
        out.append(data[i] if glow else (0, 0, 0, 0))
    img = Image.new("RGBA", (sp.w, sp.h))
    img.putdata(out)
    return img


def make_frames(sp) -> dict:
    fg = _fg()
    f = sp.fish
    ak = f["assetKey"]
    cf = C.clip_frames(sp.klasse)
    amp = C.SWIM_AMP[sp.klasse]
    still = fg.compose(sp)
    frames = {}
    for t, im in enumerate(swim_frames(sp, cf["swim"], amp)):
        frames[f"{ak}_swim_{t}"] = im
    for t, im in enumerate(idle_frames(sp)):
        frames[f"{ak}_idle_{t}"] = im
    jit = [(1, 0), (0, -1), (-1, 0), (0, 1)]
    for t, im in enumerate(swim_frames(sp, cf["struggle"], amp * 2, jitter_seq=jit)):
        frames[f"{ak}_struggle_{t}"] = im
    cfr, theta = caught_frames(sp)
    for t, im in enumerate(cfr):
        frames[f"{ak}_caught_{t}"] = im
    frames[f"{ak}_silhouette_0"] = silhouette(sp, still)
    if f["art"].get("leuchtet"):
        frames[f"{ak}_emission_0"] = emission(sp, still)
    LAST_META[ak] = {"swimAmplitude": amp, "caughtWinkel": theta,
                     "frames": {k: v for k, v in cf.items()}, "fps": C.CLIP_FPS}
    return frames


def main(argv):
    fg = _fg()
    db = C.resolve_db_path(argv)
    only = None
    for a in argv[1:]:
        if a.startswith("--only="):
            only = set(a.split("=", 1)[1].split(","))
    for f in C.load_db(db):
        if only and f["id"] not in only:
            continue
        sp = fg.build_sprite(f)
        frames = make_frames(sp)
        d = os.path.join(C.FISH_DIR, f["kuerzel"], "frames")
        C.ensure_dir(d)
        for name, im in frames.items():
            im.save(os.path.join(d, f"{name}.png"))
        print(f"{f['id']} {len(frames)} Frames")


if __name__ == "__main__":
    main(sys.argv)

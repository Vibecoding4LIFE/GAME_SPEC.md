#!/usr/bin/env python3
"""Kleine Selbstprüfung der Fisch-Sprites (Vorstufe zu qa.py aus F6).

Aufruf:  python3 tools/art/check.py [pfad/zu/fish_db.json]

Prüft je Fisch: Canvasgröße, ≥ 2 px Rand, Alpha nur 0/255, Farbanzahl ≤ Limit, kein #000000,
genau 1 weißes Highlight-Pixel, gen.json vorhanden, alle Clips/Frames im Welt-Atlas (Name, Größe,
Alpha binär). Ausgabe als Tabelle, Exit-Code 1 bei Fehlern.
Nicht geprüft (kommt mit qa.py in Phase 4): Farben ⊂ Weltpalette, Lichtprobe, IoU der Silhouetten.
"""
from __future__ import annotations

import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
from pack import frame_names  # noqa: E402


def pixels(im):
    return list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata())


def check_still(f):
    errs = []
    W, H = f["canvas"]
    p = os.path.join(C.FISH_DIR, f["kuerzel"], f"{f['assetKey']}.png")
    if not os.path.exists(p):
        return ["Standbild fehlt"], {}
    im = Image.open(p).convert("RGBA")
    if im.size != (W, H):
        errs.append(f"Canvas {im.size[0]}x{im.size[1]} != {W}x{H}")
    px = pixels(im)
    alphas = {a for (_, _, _, a) in px}
    if not alphas <= {0, 255}:
        errs.append("Alpha nicht binär")
    w, h = im.size
    margin_bad = any(px[y * w + x][3] for y in range(h) for x in range(w)
                     if x < 2 or y < 2 or x >= w - 2 or y >= h - 2)
    if margin_bad:
        errs.append("Rand < 2 px")
    cols = {p_[:3] for p_ in px if p_[3]}
    limit = C.COLOR_LIMIT["Boss" if f["boss"] else f["klasse"]]
    if len(cols) > limit:
        errs.append(f"{len(cols)} Farben > {limit}")
    if (0, 0, 0) in cols:
        errs.append("reines Schwarz")
    white = sum(1 for p_ in px if p_[3] and p_[:3] == (255, 255, 255))
    if white != 1:
        errs.append(f"{white} Weiß-Pixel (soll 1)")
    xs = [i % w for i, p_ in enumerate(px) if p_[3]]
    if xs and white == 1 and f["art"].get("koerperform") != "seepferdchen":
        wi = next(i for i, p_ in enumerate(px) if p_[3] and p_[:3] == (255, 255, 255))
        if wi % w < (min(xs) + max(xs)) / 2:
            errs.append("Auge nicht in der rechten Hälfte (Blick nach rechts?)")
    if not os.path.exists(os.path.join(C.FISH_DIR, f["kuerzel"], f"{f['assetKey']}.gen.json")):
        errs.append("gen.json fehlt")
    return errs, {"farben": f"{len(cols)}/{limit}", "weiss": white}


def load_atlas(kuerzel, cache):
    if kuerzel in cache:
        return cache[kuerzel]
    jp = os.path.join(C.OUT_DIR, kuerzel, f"atlas_fish_{kuerzel}.json")
    if not os.path.exists(jp):
        cache[kuerzel] = (None, None, f"Atlas-JSON fehlt: {os.path.relpath(jp, C.ROOT)}")
        return cache[kuerzel]
    with open(jp, encoding="utf-8") as fh:
        data = json.load(fh)
    ip = os.path.join(C.OUT_DIR, kuerzel, data["meta"]["image"])
    err = None
    img = None
    if not os.path.exists(ip):
        err = "Atlas-PNG fehlt"
    else:
        img = Image.open(ip).convert("RGBA")
        W, H = img.size
        if (W & (W - 1)) or (H & (H - 1)) or W > 4096 or H > 4096:
            err = f"Atlasgröße {W}x{H} keine Zweierpotenz ≤ 4096"
        if data["meta"].get("clips") != C.CLIP_FPS:
            err = "meta.clips falsch"
    cache[kuerzel] = (data, img, err)
    return cache[kuerzel]


def check_frames(f, cache):
    data, img, err = load_atlas(f["kuerzel"], cache)
    if data is None:
        return [err]
    errs = [err] if err else []
    W, H = f["canvas"]
    missing = []
    for n in frame_names(f):
        fr = data["frames"].get(n)
        if fr is None:
            missing.append(n)
            continue
        r = fr["frame"]
        if (r["w"], r["h"]) != (W, H) or fr["sourceSize"] != {"w": W, "h": H}:
            errs.append(f"{n}: Größe {r['w']}x{r['h']}")
            continue
        if img is not None:
            crop = img.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
            if not {p_[3] for p_ in pixels(crop)} <= {0, 255}:
                errs.append(f"{n}: Alpha nicht binär")
            if n.endswith(("_silhouette_0", "_emission_0")):
                continue
            white = sum(1 for p_ in pixels(crop) if p_[3] and p_[:3] == (255, 255, 255))
            if white != 1:
                errs.append(f"{n}: {white} Weiß-Pixel")
    if missing:
        errs.append(f"{len(missing)} Frames fehlen (z. B. {missing[0]})")
    return errs


def main(argv):
    db = C.resolve_db_path(argv)
    fishes = C.load_db(db)
    cache = {}
    rows = []
    n_err = 0
    for f in sorted(fishes, key=lambda x: x["nr"]):
        e1, info = check_still(f)
        e2 = check_frames(f, cache)
        errs = e1 + e2
        n_err += bool(errs)
        rows.append((f["id"], f["assetKey"], f["klasse"], "x".join(map(str, f["canvas"])),
                     info.get("farben", "-"), str(info.get("weiss", "-")),
                     "OK" if not errs else "FEHLER: " + "; ".join(errs)))
    head = ("ID", "assetKey", "Kl.", "Canvas", "Farben", "Weiß", "Status")
    widths = [max(len(str(r[i])) for r in rows + [head]) for i in range(6)]
    line = "  ".join(h.ljust(widths[i]) for i, h in enumerate(head[:6])) + "  " + head[6]
    print(line)
    print("-" * min(140, len(line) + 20))
    for r in rows:
        print("  ".join(str(r[i]).ljust(widths[i]) for i in range(6)) + "  " + r[6])
    print(f"\n{len(rows)} Fische geprüft, {n_err} mit Fehlern ({os.path.relpath(db, C.ROOT)})")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env python3
"""Selbstprüfung der Welt-/Figuren-/HUD-Grafiken (harte Regeln aus F1).

Aufruf:  python3 tools/art/check_world.py   (wird auch von check.py aufgerufen)

Prüft: alle Ebenen aus world_see.json vorhanden, Größe wie angegeben, kachelbare Ebenen 960 px breit;
Alpha binär; Farben ⊂ erlaubte Paletten; kein #000000; #FFFFFF nur als Augenlicht (Anzahl = gen.json „eyes“);
jede Ebene/jedes Sprite hat eine gen.json; Atlanten: Zweierpotenz, Padding/Extrude, meta.clips passt zu den Frames,
Anker liegen im Frame; Spielerplätze/Deko-Frames existieren; 9-Slice-Rahmen 24×24 mit Slice 8.
"""
from __future__ import annotations

import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

WORLD = os.path.join(C.ROOT, "public", "assets", "worlds", "see")
ATLASES = [
    (os.path.join(WORLD, "atlas_world_see.json"), ["see", "see_ext"], os.path.join(C.ART_SRC, "world", "see", "sprites")),
    (os.path.join(C.ROOT, "public", "assets", "figures", "atlas_figures.json"), ["figures"], os.path.join(C.ART_SRC, "figures")),
    (os.path.join(C.ROOT, "public", "assets", "ui", "atlas_hud.json"), ["hud"], os.path.join(C.ART_SRC, "ui")),
]


def allowed(pals):
    out = set()
    for n in pals:
        with open(os.path.join(C.PAL_DIR, f"{n}.json"), encoding="utf-8") as fh:
            out |= {C.hex_to_rgb(c) for c in json.load(fh)["colors"]}
    return out


def check_pixels(im, ok_cols, eyes, name, errs):
    px = (list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata()))
    if not {p[3] for p in px} <= {0, 255}:
        errs.append(f"{name}: Alpha nicht binär")
    cols = {p[:3] for p in px if p[3] == 255}
    whites = sum(1 for p in px if p == (255, 255, 255, 255))
    bad = cols - ok_cols - {(255, 255, 255)}
    if bad:
        errs.append(f"{name}: {len(bad)} Farben außerhalb der Palette")
    if (0, 0, 0) in cols:
        errs.append(f"{name}: reines Schwarz")
    if whites != eyes:
        errs.append(f"{name}: {whites} Weiß-Pixel (erwartet {eyes})")


def main():
    errs = []
    n_img = 0
    wj = os.path.join(WORLD, "world_see.json")
    if not os.path.exists(wj):
        print("world_see.json fehlt – zuerst python3 tools/art/see_world.py")
        return 1
    world = json.load(open(wj, encoding="utf-8"))
    see_cols = allowed(["see", "see_ext"])
    for e in world["ebenen"]:
        p = os.path.join(WORLD, e["datei"])
        if not os.path.exists(p):
            errs.append(f"Ebene fehlt: {e['datei']}")
            continue
        im = Image.open(p).convert("RGBA")
        n_img += 1
        if im.size != (e["w"], e["h"]):
            errs.append(f"{e['datei']}: Größe {im.size} != {e['w']}x{e['h']}")
        if e["kachelbar"] and im.size[0] != 960:
            errs.append(f"{e['datei']}: kachelbar, aber nicht 960 px breit")
        check_pixels(im, see_cols, 0, e["datei"], errs)
        if not os.path.exists(os.path.join(C.ART_SRC, "world", "see", f"layer_{e['id']}.gen.json")):
            errs.append(f"{e['datei']}: gen.json fehlt")
    frames_by_atlas = {}
    for (jp, pals, gen_dir) in ATLASES:
        if not os.path.exists(jp):
            errs.append(f"Atlas fehlt: {os.path.relpath(jp, C.ROOT)}")
            continue
        data = json.load(open(jp, encoding="utf-8"))
        img = Image.open(os.path.join(os.path.dirname(jp), data["meta"]["image"])).convert("RGBA")
        W, H = img.size
        base = os.path.basename(jp)
        if (W & (W - 1)) or (H & (H - 1)) or W > 4096 or H > 4096:
            errs.append(f"{base}: Größe {W}x{H} keine Zweierpotenz")
        if data["meta"].get("padding") != 2 or data["meta"].get("extrude") != 1:
            errs.append(f"{base}: Padding/Extrude falsch")
        ok_cols = allowed(pals)
        keys = {}
        for name, fr in data["frames"].items():
            key, idx = name.rsplit("_", 1)
            keys.setdefault(key, []).append(int(idx))
            r = fr["frame"]
            crop = img.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
            gp = os.path.join(gen_dir, f"{key}.gen.json")
            eyes = json.load(open(gp, encoding="utf-8")).get("eyes", 0) if os.path.exists(gp) else 0
            if not os.path.exists(gp):
                errs.append(f"{name}: gen.json fehlt")
            check_pixels(crop, ok_cols, eyes, name, errs)
            for an, a in fr.get("anchors", {}).items():
                if not (0 <= a["x"] <= r["w"] and 0 <= a["y"] <= r["h"]):
                    errs.append(f"{name}: Anker {an} außerhalb")
            n_img += 1
        for key, idxs in keys.items():
            if sorted(idxs) != list(range(len(idxs))):
                errs.append(f"{base}: {key} Frames nicht lückenlos 0..n")
            if len(idxs) > 1 and key not in data["meta"]["clips"] and not key.startswith("rod_bend"):
                errs.append(f"{base}: {key} fehlt in meta.clips")
        for key in data["meta"]["clips"]:
            if key not in keys:
                errs.append(f"{base}: meta.clips nennt unbekannten Clip {key}")
        frames_by_atlas[base] = set(data["frames"])
    wf = frames_by_atlas.get("atlas_world_see.json", set())
    for d in world["deko"] + world["spawnZonen"]:
        fn = d.get("frame") or f"{d['anim']}_0"
        if fn not in wf:
            errs.append(f"world_see.json: Deko-Frame {fn} fehlt im Atlas")
    ui = os.path.join(C.ROOT, "public", "assets", "ui")
    hud_cols = allowed(["hud"])
    for f in ("frame_wood.png", "frame_parchment.png"):
        p = os.path.join(ui, f)
        if not os.path.exists(p):
            errs.append(f"{f} fehlt")
            continue
        im = Image.open(p).convert("RGBA")
        if im.size != (24, 24):
            errs.append(f"{f}: {im.size} statt 24x24 (Slice 8)")
        check_pixels(im, hud_cols, 0, f, errs)
        n_img += 1
    for e in errs:
        print("FEHLER:", e)
    print(f"Welt/Figuren/HUD: {n_img} Bilder geprüft, {len(errs)} Fehler")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Texture-Atlas pro Welt (Phaser JSON-Hash) + Kontaktbögen.

Aufruf:  python3 tools/art/pack.py [pfad/zu/fish_db.json]

Ausgabe:
  public/assets/fish/<kuerzel>/atlas_fish_<kuerzel>.png/.json   (Padding 2 px, Extrude 1 px, Zweierpotenz ≤ 4096)
  art_src/contact/<kuerzel>_contact.png                         (Standbilder 3×, heller + dunkler Weltgrund)
"""
from __future__ import annotations

import json
import os
import sys
import time

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import palette as P  # noqa: E402

PADDING = 2
EXTRUDE = 1
MAX_SIZE = 4096


def frame_names(f) -> list[str]:
    ak = f["assetKey"]
    names = []
    for clip, n in C.clip_frames(f["klasse"]).items():
        names += [f"{ak}_{clip}_{i}" for i in range(n)]
    names.append(f"{ak}_silhouette_0")
    if f["art"].get("leuchtet"):
        names.append(f"{ak}_emission_0")
    return names


def shelf_pack(sizes, W, H):
    """Regal-Packer: sizes = [(name, w, h)] (bereits inkl. Extrude), sortiert nach Höhe."""
    pos = {}
    x, y, shelf_h = PADDING, PADDING, 0
    for name, w, h in sizes:
        if x + w + PADDING > W:
            x = PADDING
            y += shelf_h + PADDING
            shelf_h = 0
        if w + 2 * PADDING > W or y + h + PADDING > H:
            return None
        pos[name] = (x, y)
        x += w + PADDING
        shelf_h = max(shelf_h, h)
    return pos


def choose_size(sizes):
    cands = []
    p = 64
    while p <= MAX_SIZE:
        cands += [(p, p), (p * 2, p)] if p * 2 <= MAX_SIZE else [(p, p)]
        p *= 2
    cands.sort(key=lambda s: (s[0] * s[1], max(s) / min(s)))
    for W, H in cands:
        pos = shelf_pack(sizes, W, H)
        if pos is not None:
            return W, H, pos
    raise RuntimeError("Frames passen nicht in 4096×4096 – Atlas aufteilen nötig")


def extrude_paste(atlas, im, x, y):
    """Frame bei (x+E, y+E) einsetzen und die Randpixel E px nach außen kopieren."""
    w, h = im.size
    e = EXTRUDE
    atlas.paste(im, (x + e, y + e))
    for k in range(1, e + 1):
        atlas.paste(im.crop((0, 0, w, 1)), (x + e, y + e - k))
        atlas.paste(im.crop((0, h - 1, w, h)), (x + e, y + e + h - 1 + k))
        atlas.paste(im.crop((0, 0, 1, h)), (x + e - k, y + e))
        atlas.paste(im.crop((w - 1, 0, w, h)), (x + e + w - 1 + k, y + e))
        for (cx, cy, dx, dy) in ((0, 0, -k, -k), (w - 1, 0, k, -k), (0, h - 1, -k, k), (w - 1, h - 1, k, k)):
            atlas.putpixel((x + e + cx + dx, y + e + cy + dy), im.getpixel((cx, cy)))


def pack_world(kuerzel, fishes):
    frame_dir = os.path.join(C.FISH_DIR, kuerzel, "frames")
    items = []
    missing = []
    for f in fishes:
        for n in frame_names(f):
            p = os.path.join(frame_dir, f"{n}.png")
            if not os.path.exists(p):
                missing.append(n)
                continue
            items.append((n, Image.open(p).convert("RGBA")))
    if missing:
        raise RuntimeError(f"{kuerzel}: {len(missing)} Frames fehlen (fishgen.py zuerst), z. B. {missing[:3]}")
    sizes = [(n, im.size[0] + 2 * EXTRUDE, im.size[1] + 2 * EXTRUDE) for n, im in items]
    sizes.sort(key=lambda s: (-s[2], -s[1], s[0]))
    W, H, pos = choose_size(sizes)
    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    frames = {}
    lookup = dict(items)
    for n, _, _ in sizes:
        im = lookup[n]
        x, y = pos[n]
        extrude_paste(atlas, im, x, y)
        w, h = im.size
        frames[n] = {
            "frame": {"x": x + EXTRUDE, "y": y + EXTRUDE, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
    out = os.path.join(C.OUT_DIR, kuerzel)
    C.ensure_dir(out)
    img_name = f"atlas_fish_{kuerzel}.png"
    atlas.save(os.path.join(out, img_name), optimize=True)
    ordered = {n: frames[n] for n, _ in items}
    data = {
        "frames": ordered,
        "meta": {
            "app": "tools/art/pack.py",
            "version": C.GENERATOR_VERSION,
            "image": img_name,
            "format": "RGBA8888",
            "size": {"w": W, "h": H},
            "scale": "1",
            "padding": PADDING,
            "extrude": EXTRUDE,
            "clips": dict(C.CLIP_FPS),
        },
    }
    with open(os.path.join(out, f"atlas_fish_{kuerzel}.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1, ensure_ascii=False)
    return W, H, len(items)


def contact_sheet(kuerzel, fishes, scale=3):
    light, dark = P.world_backgrounds(kuerzel)
    font = ImageFont.load_default()
    stills = []
    for f in sorted(fishes, key=lambda f: f["nr"]):
        p = os.path.join(C.FISH_DIR, kuerzel, f"{f['assetKey']}.png")
        im = Image.open(p).convert("RGBA")
        stills.append((f, im.resize((im.size[0] * scale, im.size[1] * scale), Image.NEAREST)))
    panel_w = max(1200, max(im.size[0] for _, im in stills) + 24)
    gap, label_h = 12, 14
    # Zeilen umbrechen
    rows, row, x = [], [], gap
    for f, im in stills:
        if row and x + im.size[0] + gap > panel_w:
            rows.append(row)
            row, x = [], gap
        row.append((f, im))
        x += im.size[0] + gap
    if row:
        rows.append(row)
    panel_h = gap + sum(max(im.size[1] for _, im in r) + label_h + gap for r in rows) + 20
    sheet = Image.new("RGBA", (panel_w, panel_h * 2), (0, 0, 0, 255))
    d = ImageDraw.Draw(sheet)
    for pi, bg in enumerate((light, dark)):
        oy = pi * panel_h
        d.rectangle([0, oy, panel_w - 1, oy + panel_h - 1], fill=tuple(bg) + (255,))
        txt = (30, 30, 36) if pi == 0 else (230, 230, 220)
        d.text((gap, oy + 4), f"{kuerzel} - {'hell' if pi == 0 else 'dunkel'} - {len(stills)} Fische, 3x",
               fill=txt, font=font)
        y = oy + 20
        for r in rows:
            rh = max(im.size[1] for _, im in r)
            x = gap
            for f, im in r:
                sheet.alpha_composite(im, (x, y + (rh - im.size[1]) // 2))
                d.text((x, y + rh + 2), f"Nr. {f['nr']:03d}", fill=txt, font=font)
                x += im.size[0] + gap
            y += rh + label_h + gap
    C.ensure_dir(C.CONTACT_DIR)
    p = os.path.join(C.CONTACT_DIR, f"{kuerzel}_contact.png")
    sheet.convert("RGB").save(p)
    return p


def main(argv):
    db = C.resolve_db_path(argv)
    fishes = C.load_db(db)
    t0 = time.time()
    worlds = {}
    for f in fishes:
        worlds.setdefault(f["kuerzel"], []).append(f)
    for k in sorted(worlds):
        W, H, n = pack_world(k, worlds[k])
        cp = contact_sheet(k, worlds[k])
        print(f"{k:7s} {len(worlds[k]):3d} Fische, {n:4d} Frames -> atlas {W}x{H}, "
              f"Kontaktbogen {os.path.relpath(cp, C.ROOT)}")
    print(f"pack fertig in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main(sys.argv)

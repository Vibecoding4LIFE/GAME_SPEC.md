"""Atlas-Packer für Welt-, Figuren- und HUD-Sprites (Phaser JSON-Hash, Padding 2, Extrude 1)
und Kontaktbögen. Nutzt Regal-Packer und Extrude aus pack.py (gleiches Format wie die Fisch-Atlanten).
"""
from __future__ import annotations

import json
import os

from PIL import Image, ImageDraw, ImageFont

import common as C
from pack import EXTRUDE, PADDING, choose_size, extrude_paste


def pack_sprites(sprites, out_dir: str, base: str, gen_dir: str, palettes: list[str]):
    """sprites: Liste von Sprite (key, frames, fps, loop, yoyo, anchors, eyes).
    Schreibt <out_dir>/<base>.png/.json und je Sprite eine gen.json in gen_dir. Liefert (W, H, n)."""
    items = []
    clips, anims = {}, {}
    frame_extra = {}
    for sp in sprites:
        n = len(sp.frames)
        for i, im in enumerate(sp.frames):
            name = f"{sp.key}_{i}"
            im.validate(sp.eyes, name)
            items.append((name, im.im))
            anc = sp.anchors
            if isinstance(anc, list):
                anc = anc[i]
            if anc:
                frame_extra[name] = anc
        if n > 1 or sp.fps:
            clips[sp.key] = sp.fps or 1
            anims[sp.key] = {"frames": n, "fps": sp.fps or 1, "loop": sp.loop, "yoyo": sp.yoyo}
        C.ensure_dir(gen_dir)
        with open(os.path.join(gen_dir, f"{sp.key}.gen.json"), "w", encoding="utf-8") as fh:
            json.dump({"generator": "tools/art", "version": C.GENERATOR_VERSION, "atlas": base,
                       "frames": [f"{sp.key}_{i}" for i in range(n)],
                       "size": [sp.frames[0].w, sp.frames[0].h], "palettes": palettes, "eyes": sp.eyes,
                       "fps": sp.fps, "loop": sp.loop, "yoyo": sp.yoyo, "anchors": sp.anchors,
                       "hinweis": sp.note or None,
                       "ableitung": "prozedural; Animationsframes per Code aus dem Standbild (F5)"},
                      fh, indent=1, ensure_ascii=False)
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
        fr = {
            "frame": {"x": x + EXTRUDE, "y": y + EXTRUDE, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        if n in frame_extra:
            fr["anchors"] = frame_extra[n]
        frames[n] = fr
    C.ensure_dir(out_dir)
    atlas.save(os.path.join(out_dir, f"{base}.png"), optimize=True)
    data = {
        "frames": {n: frames[n] for n, _ in items},
        "meta": {
            "app": "tools/art/atlas.py",
            "version": C.GENERATOR_VERSION,
            "image": f"{base}.png",
            "format": "RGBA8888",
            "size": {"w": W, "h": H},
            "scale": "1",
            "padding": PADDING,
            "extrude": EXTRUDE,
            "palettes": palettes,
            "clips": clips,
            "anims": anims,
        },
    }
    with open(os.path.join(out_dir, f"{base}.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1, ensure_ascii=False)
    return W, H, len(items)


def contact_sheet(sprites, path: str, title: str, light, dark, scale=3, width=1500):
    """Alle Frames in `scale`-facher Größe, links heller, rechts dunkler Grund, beschriftet."""
    font = ImageFont.load_default()
    cells = []
    for sp in sprites:
        ims = [f.im.resize((f.w * scale, f.h * scale), Image.NEAREST) for f in sp.frames]
        w = sum(i.size[0] for i in ims) + 4 * (len(ims) - 1)
        h = max(i.size[1] for i in ims)
        label = sp.key + (f"  ({len(ims)}f @ {sp.fps} fps)" if sp.fps else (f"  ({len(ims)}f)" if len(ims) > 1 else ""))
        tw = int(font.getlength(label)) if hasattr(font, "getlength") else len(label) * 6
        cells.append((label, ims, max(w, tw), h))
    gap, lab = 10, 12
    half = max(width // 2, max(c[2] for c in cells) + 2 * gap)
    width = half * 2
    rows, row, x = [], [], gap
    for c in cells:
        if row and x + c[2] + gap > half:
            rows.append(row)
            row, x = [], gap
        row.append(c)
        x += c[2] + gap
    if row:
        rows.append(row)
    H = 24 + sum(max(c[3] for c in r) + lab + gap for r in rows) + gap
    sheet = Image.new("RGB", (width, H), (0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for pi, bg in enumerate((light, dark)):
        ox = pi * half
        d.rectangle([ox, 0, ox + half - 1, H - 1], fill=tuple(bg[:3]))
        txt = (30, 30, 36) if pi == 0 else (232, 228, 214)
        d.text((ox + gap, 6), f"{title} – {'hell' if pi == 0 else 'dunkel'} – {scale}x", fill=txt, font=font)
        y = 24
        for r in rows:
            rh = max(c[3] for c in r)
            x = ox + gap
            for (label, ims, w, h) in r:
                xx = x
                for im in ims:
                    sheet.paste(im, (xx, y + rh - im.size[1]), im)
                    xx += im.size[0] + 4
                d.text((x, y + rh + 1), label, fill=txt, font=font)
                x += w + gap
            y += rh + lab + gap
    C.ensure_dir(os.path.dirname(path))
    sheet.save(path)
    return path

#!/usr/bin/env python3
"""Welt 1 „Sonnenspiegelsee“: Ebenen, Deko-Atlas, Figuren-Atlas, HUD-Atlas, world_see.json,
Vorschaubilder und Kontaktbögen. Deterministisch (feste Seeds, keine Zeitstempel).

Aufruf:  python3 tools/art/see_world.py

Ausgabe:
  public/assets/worlds/see/layer_*.png, atlas_world_see.png/.json, world_see.json
  public/assets/figures/atlas_figures.png/.json
  public/assets/ui/atlas_hud.png/.json, frame_wood.png, frame_parchment.png, frames.json
  art_src/world/see/*.gen.json, art_src/figures/*.gen.json, art_src/ui/*.gen.json
  art_src/contact/see_world_contact.png, figures_contact.png, hud_contact.png,
  art_src/contact/see_scene_preview_quer.png, _quer_tief.png, _hoch.png, _tageszeiten.png
"""
from __future__ import annotations

import json
import os
import sys
import time

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import atlas  # noqa: E402
import common as C  # noqa: E402
import fig_sprites as FIG  # noqa: E402
import hud_sprites as HUD  # noqa: E402
import palettes_ext  # noqa: E402
import see_lakebed as LB  # noqa: E402
import see_layers as SL  # noqa: E402
import see_layout as L  # noqa: E402
import see_sprites as SS  # noqa: E402
from see_sprites import Sprite  # noqa: E402

OUT_WORLD = os.path.join(C.ROOT, "public", "assets", "worlds", "see")
OUT_FIG = os.path.join(C.ROOT, "public", "assets", "figures")
OUT_UI = os.path.join(C.ROOT, "public", "assets", "ui")
GEN_WORLD = os.path.join(C.ART_SRC, "world", "see")
GEN_FIG = os.path.join(C.ART_SRC, "figures")
GEN_UI = os.path.join(C.ART_SRC, "ui")

TOD = ["morgen", "tag", "abend", "nacht"]

# Tageszeit-Overlays: Multiplikations-Tönung (Phaser: setTint, TintModes.MULTIPLY = Standard)
TOD_TINT = {
    "morgen": {"oben": ("#F4A6C1", 0.22), "unter": ("#D988AF", 0.18)},
    "tag": {"oben": ("#FFE066", 0.0), "unter": ("#FFE066", 0.0)},
    "abend": {"oben": ("#F0BE2C", 0.34), "unter": ("#E8743C", 0.26)},
    "nacht": {"oben": ("#1F2B5C", 0.62), "unter": ("#111934", 0.58)},
}


def mix_white(hex_, a):
    r, g, b = C.hex_to_rgb(hex_)
    return C.rgb_to_hex((round(255 + (r - 255) * a), round(255 + (g - 255) * a), round(255 + (b - 255) * a)))


# --------------------------------------------------------------------------- Ebenen

def layer_specs():
    """(id, Img-Fabrik, x, y, parallaxX, kachelbar, Tiefe, Gruppe)"""
    specs = []
    for t in TOD:
        specs.append((f"sky_{t}", lambda t=t: SL.sky(t), 0, 0, 0.1, True, 0, "himmel"))
    specs += [
        ("far", SL.far, 0, SL.FAR_Y, 0.3, True, 3, "oben"),
        ("mid", SL.mid, 0, SL.MID_Y, 0.6, True, 4, "oben"),
        ("water", SL.water_back, 0, L.SURFACE_Y, 1.0, True, 10, "unter"),
        ("godrays", SL.godrays, 0, L.SURFACE_Y, 1.0, True, 11, "unter"),
    ]
    for f in range(4):
        specs.append((f"surface_{f}", lambda f=f: SL.surface(f), 0, SL.SURF_Y, 1.0, True, 12, "oben"))
    specs += [
        ("lakebed", LB.lakebed, 0, L.SURFACE_Y, 1.0, True, 13, "unter"),
        ("steg", SL.steg, 0, SL.STEG_Y, 1.0, False, 30, "oben"),
        ("foreground", SL.foreground, 0, SL.FG_Y, 1.15, True, 40, "oben"),
        ("fog", SL.fog, 0, SL.FOG_Y, 0.8, True, 41, "oben"),
    ]
    return specs


def build_layers():
    out = {}
    for (lid, fac, x, y, px, tile, depth, grp) in layer_specs():
        img = fac()
        path = os.path.join(OUT_WORLD, f"layer_{lid}.png")
        img.save(path, gen={"ebene": lid, "seed": "fest (siehe see_layers.py)", "x": x, "y": y,
                            "parallaxX": px, "kachelbar": tile,
                            "skript": "tools/art/see_layers.py" if lid != "lakebed" else "tools/art/see_lakebed.py"},
                 gen_dir=GEN_WORLD)
        out[lid] = (img, x, y, px, tile, depth, grp)
    return out


# --------------------------------------------------------------------------- Deko-Platzierung

def deco_list():
    d = []
    for (x, var) in L.LILIES:
        d.append({"frame": f"see_seerose_blatt_{var}_still_0", "x": x, "y": L.SURFACE_Y, "anker": "wasserlinie",
                  "tiefe": 14})
    for x in L.LILY_FLOWERS:
        d.append({"frame": "see_seerose_bluete_still_0", "x": x, "y": L.SURFACE_Y - 3, "anker": "fuss", "tiefe": 15})
    d.append({"anim": "see_frosch_idle", "x": 252, "y": L.SURFACE_Y - 2, "anker": "fuss", "tiefe": 15,
              "regen": "see_frosch_quak"})
    for (x, fl) in ((256, False), (470, True), (720, False)):
        d.append({"anim": "see_schilf_sway", "x": x, "y": L.SURFACE_Y + 1, "anker": "fuss", "tiefe": 15,
                  "flipX": fl})
    d.append({"anim": "see_ente_swim", "x": 560, "y": L.SURFACE_Y, "anker": "wasserlinie", "tiefe": 15,
              "bahn": [520, 900]})
    d.append({"anim": "see_ente_dabble", "x": 640, "y": L.SURFACE_Y, "anker": "wasserlinie", "tiefe": 15})
    d.append({"frame": "see_reiher_still_0", "x": L.STEG_X1 - 2, "y": L.STEG_DECK_Y - 10, "anker": "fuss",
              "tiefe": 31, "hinweis": "steht auf dem Poller am Stegende"})
    d.append({"anim": "see_kaulquappen_swim", "x": 230, "y": 150, "tiefe": 16, "zone": "seerosen"})
    for (x, top) in ((360, 0), (420, 0), (790, 0), (860, 0)):
        d.append({"anim": "see_wasserpest_sway", "x": x, "y": L.floor_y(x) + 1, "anker": "fuss", "tiefe": 16})
    for x in (40, 104, 168, 236):
        d.append({"anim": "see_lichtfleck_shimmer", "x": x, "y": L.floor_y(x) - 3, "tiefe": 16, "nurTag": True})
    d.append({"anim": "see_libelle_fly", "x": 300, "y": 96, "tiefe": 35, "bahn": [220, 560]})
    d.append({"anim": "see_wasserlaeufer_skate", "x": 600, "y": L.SURFACE_Y, "anker": "wasserlinie", "tiefe": 15})
    return d


def spawn_zones():
    """Bereiche für zufälliges Umgebungsleben (Szene wählt Position, Tageszeit-Filter)."""
    return [
        {"anim": "see_gluehwuermchen_glow", "rect": [0, 60, 960, 56], "nur": ["nacht"], "anzahl": 14},
        {"anim": "see_schwalbe_fly", "rect": [0, 20, 960, 60], "nur": ["abend"], "anzahl": 3},
        {"anim": "see_muecken_swarm", "rect": [200, 90, 600, 24], "ereignis": "Mueckenschwarm", "anzahl": 4},
        {"anim": "see_stern_twinkle", "rect": [0, 0, 960, 70], "nur": ["nacht"], "anzahl": 12},
        {"anim": "see_blase_m_wobble", "rect": [0, 140, 960, 480], "anzahl": 6, "steigt": True},
        {"frame": "see_regentropfen_still_0", "rect": [0, 0, 960, 120], "wetter": ["Regen", "Gewitter"],
         "anzahl": 80, "faellt": True},
        {"anim": "see_regenring_splash", "rect": [0, 119, 960, 2], "wetter": ["Regen", "Gewitter"], "anzahl": 10},
        {"anim": "see_mondsaeule_shimmer", "rect": [380, 114, 200, 6], "ereignis": "Vollmond", "anzahl": 1},
        {"frame": "see_blitz_a_still_0", "rect": [0, 0, 960, 100], "wetter": ["Gewitter"], "anzahl": 1},
    ]


def world_json(layers):
    ebenen = []
    for lid, (img, x, y, px, tile, depth, grp) in layers.items():
        e = {"id": lid, "datei": f"layer_{lid}.png", "x": x, "y": y, "w": img.w, "h": img.h,
             "parallaxX": px, "parallaxY": 1.0, "kachelbar": tile, "tiefe": depth, "tintGruppe": grp}
        if lid.startswith("sky_"):
            e["tageszeit"] = lid[4:]
        if lid.startswith("surface_"):
            e["animation"] = {"key": "surface", "frame": int(lid[-1]), "frames": 4, "fps": 4}
        if lid == "fog":
            e["nurWetter"] = ["Nebel"]
        if lid == "godrays":
            e["nurTageszeit"] = ["morgen", "tag", "abend"]
            e["hinweis"] = "Lichtstrahlen; bei Bewölkt/Regen ausblenden (Alpha zur Laufzeit erlaubt)"
        ebenen.append(e)
    tod = {}
    for t in TOD:
        tt = TOD_TINT[t]
        tod[t] = {"himmel": f"sky_{t}",
                  "tint": {"oben": mix_white(*tt["oben"]), "unter": mix_white(*tt["unter"]), "himmel": "#FFFFFF"},
                  "overlay": {"oben": {"farbe": tt["oben"][0], "alpha": tt["oben"][1]},
                              "unter": {"farbe": tt["unter"][0], "alpha": tt["unter"][1]}},
                  "sonne": t in ("morgen", "tag", "abend"), "mond": t == "nacht"}
    data = {
        "version": 1,
        "welt": "W1",
        "kuerzel": "see",
        "generator": f"tools/art/see_world.py {C.GENERATOR_VERSION}",
        "groesse": {"w": L.WORLD_W, "h": L.WORLD_H},
        "ansicht": {"quer": {"w": 640, "h": 360}, "hoch": {"w": 360, "h": 640}},
        "pixelProMeter": L.PPM,
        "oberflaecheY": L.SURFACE_Y,
        "maxTiefeM": L.MAX_DEPTH_M,
        "grundTiefsterY": L.y_of(L.MAX_DEPTH_M),
        "kamera": {
            "quer": {"scrollX": [0, L.WORLD_W - 640], "scrollY": [0, L.WORLD_H - 360],
                     "regel": "bei 0 m scrollY = 0 (Oberfläche auf y = 120); beim Sinken folgt die Kamera dem Köder, "
                              "max. scrollY = 280 (25 m sichtbar)"},
            "hoch": {"scrollX": [0, L.WORLD_W - 360], "scrollY": [0, 0],
                     "regel": "ganze Höhe sichtbar; waagerecht folgt die Kamera dem eigenen Platz/Köder"},
            "rundung": "scrollX/scrollY immer Math.round",
        },
        "ebenen": sorted(ebenen, key=lambda e: (e["tiefe"], e["id"])),
        "tiefenOrdnung": {"himmel": 0, "sonneMond": 1, "wolken": 2, "ferne": 3, "mitte": 4, "wasser": 10,
                          "godrays": 11, "oberflaeche": 12, "seegrund": 13, "dekoUnterWasser": 16,
                          "fische": 20, "schnur": 21, "steg": 30, "boote": 31, "spieler": 32, "rute": 33,
                          "dekoUeberWasser": 35, "vordergrund": 40, "nebel": 41, "hud": 100},
        "tageszeiten": tod,
        "sonnenbahn": {"x": [60, 900], "yHoch": 18, "yHorizont": 100, "hinweis": "Sonne/Mond als Atlas-Frames"},
        "tiefenschichten": [{"name": n, "minM": a, "maxM": b, "yMin": L.y_of(a), "yMax": L.y_of(b), "hudFarbe": c}
                            for (n, a, b, c) in L.DEPTH_LAYERS],
        "seegrund": {"hinweis": "Grundlinie (x, y) alle 8 px; Köder kann nicht tiefer als der Grund an seiner x-Position",
                     "polyline": L.floor_polyline(8)},
        "spielerplaetze": L.PLAYER_SPOTS,
        "spielerplatzRegeln": {
            "steg": "Figur angler_<v>_sit_still_0 mit Anker 'sitz' auf (x, y)",
            "boot": "boat_ruderboot_rock mit Anker 'wasserlinie' auf (x, y); Figur mit 'sitz' auf Boot-Anker 'sitz'; "
                    "Boot vor der Figur zeichnen",
            "rute": "rod_bend_<n> mit Anker 'griff' auf Figuren-Anker 'hand'; Schnur beginnt am Anker 'spitze'",
        },
        "deckung": L.cover_zones(),
        "futterplatz": {"anim": "see_kruemelwolke_drift", "anker": "mitte",
                        "hinweis": "Dauer und Bonus stehen in den Spieldaten (Spec: 30 s, Friedfische +50 %)"},
        "deko": deco_list(),
        "spawnZonen": spawn_zones(),
        "atlanten": {
            "welt": "assets/worlds/see/atlas_world_see.json",
            "figuren": "assets/figures/atlas_figures.json",
            "hud": "assets/ui/atlas_hud.json",
            "fische": "assets/fish/see/atlas_fish_see.json",
        },
    }
    path = os.path.join(OUT_WORLD, "world_see.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1, ensure_ascii=False)
    return data


# --------------------------------------------------------------------------- Vorschau

class AtlasReader:
    def __init__(self, json_path):
        with open(json_path, encoding="utf-8") as fh:
            self.data = json.load(fh)
        self.img = Image.open(os.path.join(os.path.dirname(json_path), self.data["meta"]["image"])).convert("RGBA")
        self.cache = {}

    def frame(self, name):
        if name not in self.cache:
            r = self.data["frames"][name]["frame"]
            self.cache[name] = self.img.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
        return self.cache[name]

    def anchor(self, name, key):
        a = self.data["frames"][name].get("anchors", {}).get(key)
        return (a["x"], a["y"]) if a else (self.frame(name).size[0] // 2, self.frame(name).size[1] // 2)


def tint(im: Image.Image, hex_):
    if hex_.upper() == "#FFFFFF":
        return im
    r, g, b = C.hex_to_rgb(hex_)
    ch = im.split()
    out = [ch[0].point(lambda v: v * r // 255), ch[1].point(lambda v: v * g // 255),
           ch[2].point(lambda v: v * b // 255), ch[3]]
    return Image.merge("RGBA", out)


def render(world, cam_x, cam_y, w, h, tod="tag", weather=None):
    """Setzt die Szene wie das Spiel zusammen (Ebenen aus PNG, Deko/Figuren aus den Atlanten)."""
    wa = AtlasReader(os.path.join(OUT_WORLD, "atlas_world_see.json"))
    fa = AtlasReader(os.path.join(OUT_FIG, "atlas_figures.json"))
    fish_json = os.path.join(C.ROOT, "public", "assets", "fish", "see", "atlas_fish_see.json")
    fsh = AtlasReader(fish_json) if os.path.exists(fish_json) else None
    tints = world["tageszeiten"][tod]["tint"]
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    items = []   # (tiefe, fn)

    def put(im, x, y, grp="oben"):
        im2 = tint(im, tints.get(grp, "#FFFFFF"))
        canvas.alpha_composite(im2, (int(round(x - cam_x)), int(round(y - cam_y)))) \
            if -im.size[0] < x - cam_x < w and -im.size[1] < y - cam_y < h else None

    for e in world["ebenen"]:
        if "tageszeit" in e and e["tageszeit"] != tod:
            continue
        if e["id"].startswith("surface_") and e["id"] != "surface_0":
            continue
        if e.get("nurWetter") and weather not in e["nurWetter"]:
            continue
        if e.get("nurTageszeit") and tod not in e["nurTageszeit"]:
            continue
        im = Image.open(os.path.join(OUT_WORLD, e["datei"])).convert("RGBA")

        def draw_layer(im=im, e=e):
            sx = e["x"] - round(cam_x * e["parallaxX"])
            sy = e["y"] - cam_y
            grp = e["tintGruppe"]
            im2 = tint(im, tints.get(grp, "#FFFFFF"))
            if e["kachelbar"]:
                start = sx % e["w"] - e["w"]
                x = start
                while x < w:
                    canvas.alpha_composite(im2, (int(x), int(sy))) if -e["h"] < sy < h else None
                    x += e["w"]
            else:
                if -im.size[0] < sx < w and -im.size[1] < sy < h:
                    canvas.alpha_composite(im2, (int(sx), int(sy)))
        items.append((e["tiefe"], len(items), draw_layer))

    # Sonne / Mond / Wolken
    if world["tageszeiten"][tod]["sonne"]:
        sx = {"morgen": 140, "tag": 470, "abend": 820}[tod]
        sy = {"morgen": 70, "tag": 14, "abend": 78}[tod]
        items.append((1, len(items), lambda sx=sx, sy=sy: put(wa.frame("see_sonne_still_0"), sx - round(cam_x * 0.05),
                                                              sy, "himmel")))
    else:
        items.append((1, len(items), lambda: put(wa.frame("see_mond_voll_still_0"), 520 - round(cam_x * 0.05), 22,
                                                 "himmel")))
    items.append((2, len(items), lambda: put(wa.frame("see_wolke_a_still_0"), 250 - round(cam_x * 0.15), 52, "himmel")))

    # Deko
    def deco_frame(dd):
        if "frame" in dd:
            return dd["frame"]
        key = dd["anim"]
        if tod == "nacht" and key == "see_lichtfleck_shimmer":
            return None
        return f"{key}_0"

    for dd in world["deko"]:
        fn = deco_frame(dd)
        if fn is None:
            continue
        im = wa.frame(fn)
        if dd.get("flipX"):
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        ax, ay = wa.anchor(fn, dd["anker"]) if dd.get("anker") else (im.size[0] // 2, im.size[1] // 2)
        grp = "unter" if dd["y"] > L.SURFACE_Y + 4 else "oben"
        items.append((dd["tiefe"], len(items), lambda im=im, dd=dd, ax=ax, ay=ay, grp=grp:
                      put(im, dd["x"] - ax, dd["y"] - ay, grp)))
    if tod == "nacht":
        for (x, y) in ((140, 96), (300, 84), (520, 100), (610, 76), (760, 92), (60, 70)):
            items.append((35, len(items), lambda x=x, y=y: put(wa.frame("see_gluehwuermchen_glow_2"), x, y, "himmel")))
    # Futterplatz-Krümelwolke als Beispiel
    items.append((16, len(items), lambda: put(wa.frame("see_kruemelwolke_drift_0"), 470, 170, "unter")))
    items.append((16, len(items), lambda: put(wa.frame("see_blase_m_wobble_0"), 600, 230, "unter")))
    items.append((16, len(items), lambda: put(wa.frame("see_blase_s_wobble_1"), 604, 214, "unter")))

    # Fische (Beispiel, um Lesbarkeit vor dem Hintergrund zu prüfen)
    if fsh:
        names = sorted({n.rsplit("_swim_", 1)[0] for n in fsh.data["frames"] if "_swim_" in n})
        picks = [(names[0], 250, 150), (names[3 % len(names)], 380, 300), (names[13 % len(names)], 540, 440),
                 (names[19 % len(names)], 560, 560)]
        for (nm, x, y) in picks:
            items.append((20, len(items), lambda nm=nm, x=x, y=y: put(fsh.frame(f"{nm}_swim_0"), x, y, "unter")))

    # Spieler, Boote, Ruten, Posen, Schnur
    variants = ["a", "b", "c", "d"]
    for i, spot in enumerate(world["spielerplaetze"]):
        v = variants[i]
        ang = f"angler_{v}_sit_still_0"
        sitz = fa.anchor(ang, "sitz")
        hand = fa.anchor(ang, "hand")
        if spot["typ"] == "boot":
            bf = f"boat_ruderboot_rock_{i % 2}"
            bwl = fa.anchor(bf, "wasserlinie")
            bx, by = spot["x"] - bwl[0], spot["y"] - bwl[1]
            bs = fa.anchor(bf, "sitz")
            seat = (bx + bs[0], by + bs[1])
            items.append((31, len(items), lambda bf=bf, bx=bx, by=by: put(fa.frame(bf), bx, by)))
            depth_ang = 30.5
        else:
            seat = (spot["x"], spot["y"])
            depth_ang = 32
        ax, ay = seat[0] - sitz[0], seat[1] - sitz[1]
        items.append((depth_ang, len(items), lambda ang=ang, ax=ax, ay=ay: put(fa.frame(ang), ax, ay)))
        bend = [0, 1, 0, 3][i]
        rf = f"rod_bend_{bend}"
        g = fa.anchor(rf, "griff")
        tip = fa.anchor(rf, "spitze")
        rx, ry = ax + hand[0] - g[0], ay + hand[1] - g[1]
        items.append((33, len(items), lambda rf=rf, rx=rx, ry=ry: put(fa.frame(rf), rx, ry)))
        tipw = (rx + tip[0], ry + tip[1])
        pose_f = ["pose_idle_0", "pose_nibble_0", "pose_idle_1", "pose_bite_0"][i]
        px = spot["x"] + [70, 96, 120, 150][i]
        pwl = fa.anchor(pose_f, "wasserlinie")
        pfx, pfy = px - pwl[0], L.SURFACE_Y - pwl[1]
        items.append((34, len(items), lambda pose_f=pose_f, pfx=pfx, pfy=pfy: put(fa.frame(pose_f), pfx, pfy)))
        line_end = (px, L.SURFACE_Y - 9 if i != 3 else L.SURFACE_Y)

        def draw_line(a=tipw, b=line_end):
            from PIL import ImageDraw
            dr = ImageDraw.Draw(canvas)
            pts = []
            for k in range(25):
                t = k / 24
                sag = 6 * t * (1 - t) * 4 * 0.5
                pts.append((a[0] + (b[0] - a[0]) * t - cam_x, a[1] + (b[1] - a[1]) * t + sag - cam_y))
            col = tuple(int(c) for c in C.hex_to_rgb(tint_hex(tints["oben"], "#F2EFE2"))) + (255,)
            for p, q in zip(pts, pts[1:]):
                dr.line([tuple(map(round, p)), tuple(map(round, q))], fill=col, width=1)
        items.append((21, len(items), draw_line))

    for _, _, fn in sorted(items, key=lambda t: (t[0], t[1])):
        fn()
    return canvas


def tint_hex(tint_, col):
    a = C.hex_to_rgb(tint_)
    b = C.hex_to_rgb(col)
    return C.rgb_to_hex(tuple(x * y // 255 for x, y in zip(a, b)))


def previews(world):
    C.ensure_dir(C.CONTACT_DIR)
    out = []
    for (name, cx, cy, w, h) in (("quer", 0, 0, 640, 360), ("quer_tief", 220, 280, 640, 360),
                                 ("hoch", 60, 0, 360, 640)):
        im = render(world, cx, cy, w, h)
        p = os.path.join(C.CONTACT_DIR, f"see_scene_preview_{name}.png")
        im.convert("RGB").resize((w * 2, h * 2), Image.NEAREST).save(p)
        out.append(p)
    # Tageszeiten (1×, 2×2-Raster)
    sheet = Image.new("RGB", (640 * 2 + 4, 360 * 2 + 4), (20, 20, 24))
    for i, t in enumerate(TOD):
        im = render(world, 0, 0, 640, 360, tod=t, weather="Nebel" if t == "morgen" else None)
        sheet.paste(im.convert("RGB"), ((i % 2) * 644, (i // 2) * 364))
    p = os.path.join(C.CONTACT_DIR, "see_scene_preview_tageszeiten.png")
    sheet.save(p)
    out.append(p)
    return out


# --------------------------------------------------------------------------- Kontaktbögen

def layer_sprites(layers):
    sps = []
    for lid, (img, *_rest) in layers.items():
        if lid.startswith("surface_") and lid != "surface_0":
            continue
        sps.append(Sprite(f"layer_{lid}", [img]))
    sps.append(Sprite("layer_surface (4 Frames)", [layers[f"surface_{i}"][0] for i in range(4)]))
    return sps


def main():
    t0 = time.time()
    palettes_ext.main()
    for d in (OUT_WORLD, OUT_FIG, OUT_UI, GEN_WORLD, GEN_FIG, GEN_UI):
        C.ensure_dir(d)
    layers = build_layers()
    deco = SS.all_sprites()
    W, H, n = atlas.pack_sprites(deco, OUT_WORLD, "atlas_world_see", os.path.join(GEN_WORLD, "sprites"),
                                 ["see", "see_ext"])
    print(f"atlas_world_see   {n:3d} Frames -> {W}x{H}")
    figs = FIG.all_sprites()
    W, H, n = atlas.pack_sprites(figs, OUT_FIG, "atlas_figures", GEN_FIG, ["figures"])
    print(f"atlas_figures     {n:3d} Frames -> {W}x{H}")
    huds = HUD.all_sprites(L.DEPTH_LAYERS)
    W, H, n = atlas.pack_sprites(huds, OUT_UI, "atlas_hud", GEN_UI, ["hud"])
    print(f"atlas_hud         {n:3d} Frames -> {W}x{H}")
    HUD.frame_wood_9slice().save(os.path.join(OUT_UI, "frame_wood.png"),
                                 gen={"slice": 16, "skript": "tools/art/hud_sprites.py"}, gen_dir=GEN_UI)
    HUD.frame_parchment_9slice().save(os.path.join(OUT_UI, "frame_parchment.png"),
                                      gen={"slice": 12, "skript": "tools/art/hud_sprites.py"}, gen_dir=GEN_UI)
    with open(os.path.join(OUT_UI, "frames.json"), "w", encoding="utf-8") as fh:
        json.dump({"version": 1, "rahmen": HUD.FRAMES_9SLICE}, fh, indent=1, ensure_ascii=False)
    world = world_json(layers)
    # Kontaktbögen
    light, dark = (143, 211, 244), (18, 52, 47)
    cp = [
        atlas.contact_sheet(deco, os.path.join(C.CONTACT_DIR, "see_world_contact.png"),
                            "Welt 1 – Deko-Atlas atlas_world_see", light, dark, scale=3, width=1600),
        atlas.contact_sheet(layer_sprites(layers), os.path.join(C.CONTACT_DIR, "see_layers_contact.png"),
                            "Welt 1 – Ebenen (1x)", light, dark, scale=1, width=2000),
        atlas.contact_sheet(figs, os.path.join(C.CONTACT_DIR, "figures_contact.png"),
                            "Figuren & Ausruestung atlas_figures", light, dark, scale=3, width=1400),
        atlas.contact_sheet(huds + [Sprite("frame_wood.png", [HUD.frame_wood_9slice()]),
                                    Sprite("frame_parchment.png", [HUD.frame_parchment_9slice()])],
                            os.path.join(C.CONTACT_DIR, "hud_contact.png"), "HUD atlas_hud", light, dark,
                            scale=3, width=1400),
    ]
    pv = previews(world)
    for p in cp + pv:
        print(f"  {os.path.relpath(p, C.ROOT)}")
    print(f"see_world fertig in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()

"""UI-Grafiken für die HTML-Overlays (Holz/Messing/Tinte, Palette art_src/palettes/hud.json).
Aufruf: python3 -I ui_art.py <repo>  → schreibt public/assets/ui/{btn_wood,btn_wood_down,plate_ink,bar_frame,btn_action,bobber}.png
Alle Bilder 1 Bildpixel = 1 Kunstpixel; das CSS skaliert ganzzahlig (×2 bzw. ×3) mit image-rendering: pixelated."""
import json, math, sys
from pathlib import Path
from PIL import Image

repo = Path(sys.argv[1])
pal = json.loads((repo / 'art_src/palettes/hud.json').read_text())
R = {r['name']: r['colors'] for r in pal['ramps']}
def rgb(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
HOLZ = [rgb(c) for c in R['Holz']]          # 0 dunkel … 4 hell
MESS = [rgb(c) for c in R['Messing']]
TINTE = [rgb(c) for c in R['Tinte']]
ROT = [rgb(c) for c in R['Signalrot']]
GRUEN = [rgb(c) for c in R['Gruen']]
WASSER = [rgb(c) for c in R['Wasser']]
PERG = [rgb(c) for c in R['Pergament']]
WOLKE = [rgb(c) for c in R['Wolke']]
ORANGE = [rgb(c) for c in R['Orange']]
T = (0, 0, 0, 0)
out = repo / 'public/assets/ui'

def plate(w, h, lip, pressed, fill_alpha=225):
    """Holzplatte mit Messingkante und 1 px Lippe unten (gedrückt: Lippe weg, Platte 1 px tiefer)."""
    im = Image.new('RGBA', (w, h), T)
    top = 1 if pressed else 0
    bh = h - lip  # Höhe der Platte ohne Lippe
    def put(x, y, c):
        if 0 <= x < w and 0 <= y < h: im.putpixel((x, y), c)
    for y in range(bh):
        for x in range(w):
            yy = y + top
            corner = (x in (0, w - 1)) and (y in (0, bh - 1))
            if corner: continue
            if x in (0, w - 1) or y in (0, bh - 1): c = TINTE[0]
            elif y == 1 or x == 1: c = MESS[3]                    # Licht oben/links
            elif y == bh - 2 or x == w - 2: c = MESS[1]           # Schatten unten/rechts
            else:
                # Holzmaserung: Planken alle 3 Zeilen, Fuge dunkler
                row = (y - 2) % 3
                c = HOLZ[2] if row == 2 else (HOLZ[3] if row == 0 else HOLZ[3])
                if row == 2: c = HOLZ[2]
                if (x + y * 3) % 7 == 0 and row != 2: c = HOLZ[4]
                c = (c[0], c[1], c[2], fill_alpha)
            put(x, yy, c)
    if not pressed:
        for x in range(1, w - 1):
            put(x, bh, TINTE[0] if x in (1, w - 2) else HOLZ[0])
        for x in range(2, w - 2):
            put(x, bh + lip - 1, TINTE[0])
    return im

def ink_plate(w, h):
    im = Image.new('RGBA', (w, h), T)
    for y in range(h):
        for x in range(w):
            if (x in (0, w - 1)) and (y in (0, h - 1)): continue
            if x in (0, w - 1) or y in (0, h - 1): c = TINTE[0]
            elif y == 1 or x == 1: c = MESS[3]
            elif y == h - 2 or x == w - 2: c = MESS[0]
            else: c = (TINTE[1][0], TINTE[1][1], TINTE[1][2], 235) if y == 2 else (TINTE[0][0], TINTE[0][1], TINTE[0][2], 235)
            im.putpixel((x, y), c)
    return im

def bar_frame(w, h):
    """Rahmen für den Ladebalken: Holz außen, Messingkante, dunkle Rinne innen."""
    im = Image.new('RGBA', (w, h), T)
    for y in range(h):
        for x in range(w):
            if (x in (0, w - 1)) and (y in (0, h - 1)): continue
            d = min(x, y, w - 1 - x, h - 1 - y)
            if d == 0: c = TINTE[0]
            elif d == 1: c = MESS[3] if (y == 1 or x == 1) else MESS[1]
            elif d == 2: c = HOLZ[1]
            else: c = (13, 34, 31, 255)
            im.putpixel((x, y), c)
    return im

PHASES = [  # Reihenfolge = Spalte im Bogen
    ('aim', ORANGE),
    ('wait', WASSER),
    ('bite', ROT),
    ('fight', GRUEN),
]

def round_button(ramp, pressed, size=34, lip=2):
    im = Image.new('RGBA', (size, size + lip), T)
    cx = cy = (size - 1) / 2
    oy = 1 if pressed else 0
    def inside(x, y, r): return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    r_out = size / 2 - 0.3
    # Lippe (Schatten unter dem Knopf)
    if not pressed:
        for y in range(size + lip):
            for x in range(size):
                if not inside(x, y, r_out) and inside(x, y - lip, r_out):
                    im.putpixel((x, y), TINTE[0] if not inside(x, y - lip + 1, r_out - 1) else HOLZ[0])
    for y in range(size):
        for x in range(size):
            if not inside(x, y, r_out): continue
            dx, dy = x - cx, y - cy
            r = math.hypot(dx, dy)
            light = -(dx + dy) / (r + 1e-6)  # +1 = oben links
            if r > r_out - 1.2: c = TINTE[0]
            elif r > r_out - 4.2:  # Messingring
                c = MESS[4] if light > 0.75 else MESS[3] if light > 0.2 else MESS[2] if light > -0.4 else MESS[1] if light > -0.85 else MESS[0]
            elif r > r_out - 5.2: c = TINTE[1]  # Fuge
            else:
                t = (y - (cy - r_out + 5)) / (2 * (r_out - 5))
                n = len(ramp)
                idx = max(0, min(n - 2, int((1 - t) * (n - 1))))  # oben heller
                if pressed: idx = max(0, idx - 1)  # gedrückt: eine Stufe dunkler
                c = ramp[idx]
                # Glanzbogen oben links
                if r > r_out - 7.5 and light > 0.55 and not pressed: c = ramp[-1]
                if r > r_out - 7.2 and light < -0.7: c = ramp[0]
            im.putpixel((x, y + oy), c)
    return im

def bobber():
    """Pose 7×14: Antenne, rot/weiß, Kiel."""
    rows = [
        '...k...',
        '...k...',
        '..kwk..',
        '.krrrk.',
        'krRrrrk',
        'krRrrrk',
        'kwwwwwk',
        'kWwwwwk',
        '.kwwwk.',
        '..kwk..',
        '...k...',
        '...k...',
    ]
    cols = {'.': T, 'k': TINTE[0], 'r': ROT[1], 'R': ROT[3], 'w': WOLKE[2], 'W': (255, 255, 255, 255)}
    im = Image.new('RGBA', (7, len(rows)), T)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row): im.putpixel((x, y), cols[ch])
    return im

plate(12, 13, 1, False).save(out / 'btn_wood.png')
plate(12, 13, 1, True).save(out / 'btn_wood_down.png')
ink_plate(12, 12).save(out / 'plate_ink.png')
bar_frame(12, 12).save(out / 'bar_frame.png')
sheet = Image.new('RGBA', (34 * len(PHASES), 36 * 2), T)
for i, (_, ramp) in enumerate(PHASES):
    sheet.paste(round_button(ramp, False), (i * 34, 0))
    sheet.paste(round_button(ramp, True), (i * 34, 36))
sheet.save(out / 'btn_action.png')
bobber().save(out / 'bobber.png')
print('geschrieben:', ', '.join(['btn_wood.png', 'btn_wood_down.png', 'plate_ink.png', 'bar_frame.png', 'btn_action.png', 'bobber.png']))

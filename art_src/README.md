# art_src – Quellen der Pixel-Pipeline

Erzeugt mit `npm run art` (= `python3 tools/art/fishgen.py && python3 tools/art/pack.py`),
Selbstprüfung mit `python3 tools/art/check.py`. Alle Skripte nehmen optional einen DB-Pfad
(Standard `public/data/fish_db.json`; fehlt sie, wird mit Warnung die Fixture benutzt).

| Ordner | Inhalt |
|---|---|
| `palettes/<kuerzel>.json/.png` | Weltpalette: 8 Leitfarben × 4 Stufen = 32 Farben (OKLCh-Rampen, Schatten kühler/satter, Lichter wärmer) |
| `fish/<kuerzel>/<assetKey>.png` | Standbild im Canvas der Größenklasse, Blick nach rechts |
| `fish/<kuerzel>/<assetKey>.gen.json` | Generator-Version, Seed (aus der Fisch-ID), Parameter, Rampen, Caught-Winkel |
| `fish/<kuerzel>/frames/` | alle Clip-Frames für `pack.py` |
| `contact/<kuerzel>_contact.png` | Kontaktbogen: Standbilder 3×, heller und dunkler Weltgrund |
| `fixtures/fish_db_sample.json` | 22 Test-Fische im Vertragsformat (alle Größenklassen, Sonderformen) |

## Platzhalter (bewusst)

- **Alle 100 Fische sind prozedurale Platzhalter (F8).** Bessere Grafiken ersetzen die Dateien später 1:1
  unter demselben `assetKey`.
- **Legendäre Fische/Bosse (020, 040, 060, 080, 100):** Die Spec (F8.5) verlangt handgeschriebene
  Zeichenraster in JSON. Das ist für Phase 4 vorgesehen; derzeit prozedural mit Extra-Details
  (Krone/Hörner/Narben/Haken/Leuchtangeln je nach Merkmal). `gen.json` markiert sie mit `"platzhalter": true`.
- Nicht umgesetzte Merkmale (werden ignoriert): `blume`, `kuppel`, `lippen`, `buckel`, `schnabel`,
  `beinflossen`, `korallen`, `schneeflocke`, `saugnapf`, `federn`, `schmollmund`, `skelett`, `panzer`.
- Zweite Sprites (aufgeblasen, Segel hoch, Blob-Fang-Sprite …), Palette-Cycling und Schillernd-Varianten fehlen noch.

## Bekannte Abweichungen vom Style Guide (F1/F5)

- **Farben stammen aus Fisch-Rampen (`art.farben`), nicht aus der Weltpalette.** Die harte Regel
  „alle Farben ⊂ Weltpalette" prüft erst `qa.py` (Phase 4); das Farblimit (12/16/24) wird eingehalten,
  bei Überschreitung werden die zwei ähnlichsten Farben (OKLab) zusammengelegt.
- **Caught-Pose:** Ziel 20°; passt der gekippte Fisch nicht in denselben Canvas, wird der Winkel in
  2°-Schritten bis 6° reduziert (Wert steht in `gen.json` → `animation.caughtWinkel`).
- In Animationsframes kann bei Struggle (±1 px Zittern) der 2-px-Rand unterschritten werden; der Rand
  wird nur am Standbild geprüft.
- Keine Master-Palette (~64 Farben) – nur die 5 Weltpaletten.

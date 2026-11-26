# Datenvertrag (Phase 0)

Dieser Vertrag ergänzt GAME_SPEC.md Teil G (6.6/6.7) um die Felder, die Spiel **und** Pixel-Pipeline brauchen,
die in der Spec aber noch nicht als CSV-Spalte stehen. Änderungen nur über den `architekt`.

## 1. Zusätzliche Spalten in `Data/fish.csv` (nach den Spalten aus 6.6, gleiche Regeln: `;`, `|`, UTF-8)

| Spalte | Typ | Beispiel | Bedeutung |
|---|---|---|---|
| `pflicht_oder` | DNF-Liste | `Gewitter\|Vollmond` · `Korallenbluete\|Regen+Flut` | Alternative Pflicht-Bedingungen. `\|` = ODER, `+` = UND. Werte sind Wetter- **oder** Ereignis-Schlüssel. Leer = keine. Wird **zusätzlich** zu `wetter_pflicht`/`ereignis_pflicht` geprüft (UND). |
| `koerperform` | enum | `torpedo` | `schlank`, `normal`, `hochrueckig`, `rund`, `torpedo`, `aal`, `scheibe`, `rochen`, `plattfisch`, `seepferdchen`, `kugel`, `band`, `kopflastig` |
| `schwanz` | enum | `gegabelt` | `gegabelt`, `rund`, `sichel`, `gerade`, `hai`, `saum`, `spitz`, `dreiteilig` |
| `muster` | enum | `flecken` | `keins`, `querstreifen`, `laengsband`, `punkte`, `flecken`, `netz`, `sattel`, `marmor`, `ringe`, `schuppen`, `platten`, `leuchtpunkte`, `risse`, `hexagon`, `wellen` |
| `farben` | 4–5 Hex | `#5B6B2F\|#E8E4C9\|#E9D86A\|#8A4B2A` | Rücken/Haupt · Bauch · Muster/Akzent · Flossen · (optional) Iris |
| `schillernd_farben` | 4–5 Hex | gleiche Reihenfolge | Schillernd-Palette |
| `merkmale` | Tags | `zaehne\|maul_gross` | frei, aber bevorzugt aus: `barteln`, `zaehne`, `horn`, `schnauze_lang`, `maul_gross`, `stacheln`, `segel`, `kristalle`, `flammen`, `leuchtangel`, `glupschaugen`, `krone`, `moos`, `fettflosse`, `haken`, `froschbeine`, `blume`, `tentakel`, `kuppel`, `hauer` |
| `name_en` | string | `Northern Pike` | englischer Name |
| `lexikon_text_en` / `hinweis_text_en` | string | | Übersetzungen (B7: kein Schlüssel leer) |

`Data/boss_phases.csv` bekommt zusätzlich `name_en;ansage_en`.

## 2. Weitere Tabellen

- `Data/worlds.csv`: `id;index;kuerzel;name_de;name_en;muenzfaktor;leitfarben;min_tiefe_m;max_tiefe_m;schichten;ufer_ende_m;freiwasser_ende_m;mechanik;schillernd_regel`
  - `kuerzel`: `see`, `riff`, `fjord`, `tiefe`, `grotte`
  - `leitfarben`: 8 Hex, `|`-getrennt (Teil E)
  - `schichten`: `Name:min-max|…` (Teil E, Tiefenschichten). `min_tiefe_m` ist bei allen Welten `0` (Oberfläche); W4-Schichten beginnen erst bei 200 m.
- `Data/weather.csv`: `welt;wetter;gewicht;anzeigename_de;anzeigename_en;nur_zeit` (Prozentwerte aus Teil E; `nur_zeit` z. B. `Morgen` für Morgennebel)
- `Data/events.csv`: `welt;ereignis;beschreibung_de` (alle Ereignisse aus Teil E, Schlüssel aus `WORLD_EVENTS`)

## 3. Erzeugte Dateien (`npm run data`)

- `public/data/fish_db.json` – Format aus Teil G 6.7, **plus** pro Fisch:
  - `"slug"`: Name kleingeschrieben, ä→ae, ö→oe, ü→ue, ß→ss, alles andere als `[a-z0-9]` → `-`, doppelte `-` zusammengefasst, Rand-`-` entfernt (`der-alte-barnabas`)
  - `"weltKuerzel"`: `see` …
  - `"assetKey"`: `fish_<weltKuerzel>_<nr3>_<slug>` (z. B. `fish_see_014_hecht`)
  - `"spawn.pflichtOder"`: `string[][]` (DNF)
  - `"art"`: `{ koerperform, schwanz, muster, farben[], schillerndFarben[], merkmale[], text, schillernd, leuchtet }`
  - bei Bossen `"bossPhasen"` (6.7)
- `public/data/worlds.json` – `{ version, worlds: [...] }` inkl. Wetter- und Ereignistabelle.
- Text-Schlüssel in `src/i18n/de.json` / `en.json` (`fish.<nr3>.name|lexicon|hint`, `boss.<nr3>.phase<n>`, `boss.<nr3>.phase<n>.ansage`).

## 4. Sprites (Namenskonvention, verbindlich)

- Frame-Namen im Atlas: `<assetKey>_<clip>_<frame>`, z. B. `fish_see_014_hecht_swim_0`
- Clips: `swim` (6 Frames, S: 4, 10 FPS), `idle` (4, 6 FPS), `struggle` (4, 14 FPS), `caught` (3, 8 FPS)
- Zusätzlich je Fisch: `<assetKey>_silhouette_0` (Lexikon) und bei `leuchtet` `<assetKey>_emission_0`
- Atlas pro Welt: `public/assets/fish/<kuerzel>/atlas_fish_<kuerzel>.png` + `.json` (Phaser-JSON-Hash, Padding 2 px, Extrude 1 px)
- Bildraten stehen zusätzlich in der Atlas-JSON unter `meta.clips` (`{ "swim": 10, … }`), damit nichts im Code hartcodiert ist.

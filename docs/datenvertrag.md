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

## 5. Phase 1 – Ausrüstung, Balancing, Fisch-Tags (daten-designer, 27.11.)

Grundsatz Teil I Nr. 4: Jede Zahl, die `src/game/` braucht, steht in einer CSV. Die Spiellogik liest nur
`public/data/{fish_db,worlds,gear,balancing}.json` über `loadFishData`, `loadWorldDb`, `loadGear`, `loadBalancing` (`src/data/`).

### 5.1 `fish.csv` – Spalte `tags` (letzte Spalte)

`|`-getrennt, Werte aus `FISH_TAGS` (`src/data/types.ts`). Regeln (Validator, Fehler):
- genau einer von `raubfisch` / `friedfisch` (Zucken +25 % bzw. −15 %, Sonnig/Bewölkt, Wobbler)
- `oberflaeche` und `grund` schließen sich aus
- `leucht`, `zahnfisch`, `schwarm` stehen **nicht** in der Spalte, der Build leitet sie aus `leuchtet`, `zahnfisch`, `schwarm` (max ≥ 2) ab

| Tag | Vergabe-Regel | wirkt über |
|---|---|---|
| `raubfisch` / `friedfisch` | Anglersprache: frisst Fische/große Beute bzw. nicht; Text/Lieblingsköder (Blinker → Raubfisch) | Zucken, Sonnig −20 %, Bewölkt +20 %, K05 |
| `oberflaeche` | Tiefe beginnt bei 0 m und endet ≤ 5 m; Ausnahme Grundeln (→ `grund`); Bimsstein-Barsch per Text („treibt an der Oberfläche“) | Sonnig +30 % |
| `grund` | Bodenfisch laut Art/Text (Karpfen, Wels, Plattfisch, Rochen, Grenadier …) | Meeresschnee +50 % |
| `aal` / `forelle` / `lachs` | Art (Saibling zählt als Forelle, Pelikanaal/Eiszapfen-Aal als Aal) | Regen +50 % |
| `mystisch` | magische Fantasiefische (Leuchten, Geist, Drache, Phönix, Polarlicht) – Bosse ausgenommen | Nebel / Runennacht +50 % |
| `kristall` / `glut` | Körper aus Kristall bzw. Glut/Lava/Flammen laut Text | K11 +80 % / K10 +50 % (nur W5) |
| `riff` / `lagune` | alle W2-Fische / W2-Fische ab 0 m Tiefe | K06 +40 % / Flut +30 % |
| `scheu` | vorsichtige Friedfische und Salmoniden (Schleie, Karpfen, Koi, Forelle, Saibling, Lachs, Seepferdchen, Mandarinfisch) | Stahlvorfach −5 % |

`fish_db.json` bekommt `tags` (inkl. abgeleiteter Tags), `FishData.tags` ebenso.

### 5.2 Ausrüstungs-Tabellen (alle `;`, `|`, Dezimalpunkt, leere Zelle = Standard aus 6.5)

Jede Zeile hat `name_de;name_en;beschreibung_de;beschreibung_en` (Fundstücke: `text_de;text_en`) → i18n-Schlüssel
`<kategorie>.<slug>.name|desc|text`, Slug = ID klein ohne Sonderzeichen (`rod.r01.name`, `line.zv.desc`, `curio.c01.text`).

| Datei | Spalten (→ Feld in 6.5 / §5) |
|---|---|
| `rods.csv` | `id;stufe;quelle;preis_muenzen;preis_perlen;ruf;wurfweite_m;wurf_zyklus_s;perfekt_ab;flex;entlastung;reaktion_s;konter;groessen_mu;faehigkeiten;faehigkeit_welt;nur_welt;schnurfarbe;schnur_partikel` |
| `lines.csv` | `id;preis_muenzen;ruf;reserve_s;bissrate_bonus;schutz;hitze_faktor;druck_max_m;vorfach;zahnschutz;scheu_mod` |
| `reels.csv` | `id;preis_muenzen;ruf;kurbelkraft;einholtempo;kapazitaet_m;tiefseewinde;kapazitaet_sonst_m;abstieg_ms` |
| `baits.csv` | `id;unendlich;dauerhaft;packung;preis_muenzen;preis_perlen;preis_weltfaktor;gewicht;bissrate_bonus;groessen_mu;seltenheit_mods;tag_bonus;schillernd_mult;zucken_mult;welten;wirkt_auf;einhol_tiefe_m;futterplatz;leuchtet_dunkel;hitzefest;bosslocker;ab_arten` |
| `accessories.csv` | `id;preis_muenzen;ruf;stufe;effekt;wert;welten` (IDs `Z01`–`Z09`, Effekte `ACCESSORY_EFFECTS`) |
| `curios.csv` | `id;welten;gewicht;muenzen_min;muenzen_max;mal_weltfaktor;belohnung;belohnung_ref;sammelzahl` (IDs `C01`…) |

- **Ruten-Fähigkeiten** `faehigkeiten` = `Name:Wert|…` (ohne Wert = 1). `ability` = erste Fähigkeit. Bedeutung des Werts:
  `TaucherKonter` additiver Konterbonus gegen Taucher · `WindImmun` verbleibender Windanteil · `StarkerKonter` Info (Wert = `konter`) ·
  `HaengerLeicht` Tipps zum Lösen · `StroemungHalb` Strömungsfaktor · `KaelteImmun` aktiv · `EislochLangsamer` Frier-Tempo-Faktor ·
  `LampePlusEins` Lampenstufen · `BlinkerHalbSichtbar` Sichtbarkeit · `HitzeMinus30` Hitzefaktor · `SchillerndGlobal` 1 : n.
  `faehigkeit_welt` begrenzt Fähigkeiten **und** `groessen_mu` auf diese Welt.
- **Köder:** `gewicht` ∈ `leicht|mittel|schwer` → `sinkSpeedMs` aus `balancing depth.sinkSpeedMs`, `sinkSpeed` = Faktor zu „mittel“.
  `seltenheit_mods` / `tag_bonus` = `Schlüssel:Faktor|…` (Multiplikatoren aufs Spawn-Gewicht, nur in `welten`; leer = überall).
  `commonMod` (6.5) = `seltenheit_mods.Gewoehnlich`. `wirkt_auf` ist beschreibend (Shop/Lexikon). Bosslocker: `summonsWorldBoss`,
  Preis = `preis_perlen` + `preis_weltfaktor` × Weltfaktor, Verkauf ab `ab_arten`/20.
- **Sprites der Ruten:** `rod_<slug>` und `rod_<slug>_bend_0…3` (4 Biegestufen).

### 5.3 `balancing.csv`

`schluessel;wert;quelle;beschreibung` – nur Zahlen, Schlüssel Punkt-getrennt in camelCase (`drill.counterBonus`),
Enum-Namen als Teilschlüssel (`spawn.base.Selten`, `spawn.weather.Regen.tags.aal`). `quelle` = Spec-Stelle oder „eigene Wahl: …“.
- **Pflicht-Schlüssel** = Schema `BalancingSchema` in `src/data/balancing.ts` (fehlt einer → rot mit Schlüsselname; unbekannter → rot).
  Ausnahme: Teil-Records `cast.wind`, `drill.cold`, `weather.shadowVisibility` (je Wetter), `spawn.weather` (je Wetter), `spawn.event`, `event`
  (je Ereignis); deren Spec-Pflichteinträge stehen in `REQUIRED_EFFECT_KEYS`.
- **Wirkungen** (`SpawnEffect`): `biteRate` additiv (Wartezeit = Grundwert / (1 + Σ Bissraten-Boni), mindestens `bite.wait.floorS`),
  `rarity` / `tags` / `fish` sind Multiplikatoren aufs Spawn-Gewicht; mehrere passende Tags werden multipliziert.
  Zugriff generisch: `weatherEffect(b, wetter)`, `eventEffect(b, ereignis)`.
- `public/data/balancing.json` = `{ version: 1, …verschachtelte Gruppen }`.

### 5.4 Erzeugt (`npm run data`)
- `public/data/gear.json` – `{ version, rods, lines, reels, baits, accessories, curios }` direkt im Format der TS-Typen (`RodData` …).
- `public/data/balancing.json` – siehe 5.3.
- i18n-Schlüssel aus 5.2 (generierter Namensraum, UI-Schlüssel bleiben unberührt).

### 5.5 `events.csv` – Spalten `zeit` und `wetter` (Nachtrag 27.11.)
- `zeit`: TimeOfDay-Flags, in denen das Ereignis auftreten kann (Standard `Immer`). Vollmond, Korallenblüte, Polarlicht,
  Großer Ausbruch, Runennacht = `Nacht`; Mückenschwarm = `Abend`.
- `wetter`: Ist es gesetzt, ist das Ereignis genau dann aktiv, wenn dieses Wetter herrscht (Sommergewitter = `Gewitter`).
  Das Wetter muss in der Wettertabelle der Welt stehen.
- `worlds.json` → `ereignisse[]` bekommt `zeit` und `wetter`. Validator: Ein Pflicht-/ODER-Ereignis muss sich mit der Fangzeit des Fisches überschneiden.
- Neuer Balancing-Schlüssel `lexicon.twoStarCatches` (D 1.12).

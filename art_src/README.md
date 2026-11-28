# art_src – Quellen der Pixel-Pipeline

Erzeugt mit `npm run art` (= `python3 tools/art/build_all.py`: fishgen → pack → see_world),
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
## Welt 1, Figuren, HUD (Phase 1)

Skripte: `tools/art/see_world.py` (Einstieg) · `see_layout.py` (Maße, Grundprofil, Spielerplätze) · `see_layers.py`,
`see_lakebed.py` (Ebenen) · `see_sprites.py` (Deko) · `fig_sprites.py` (Figuren) · `hud_sprites.py` (HUD, 9-Slice) ·
`atlas.py` (Packer + Kontaktbögen) · `pixkit.py` (Zeichnen mit harten Regeln) · `palettes_ext.py` · `check_world.py`.

**Harte Regeln (beim Speichern erzwungen):** Farben nur aus der Palette (Welt: `see` ∪ `see_ext`, Figuren: `figures`,
HUD: `hud`), Alpha binär, kein #000, #FFF nur als Augenlicht (Anzahl = `eyes` in gen.json), 2×2-Bayer nur in
Hintergründen und Verlaufs-Füllungen, Licht oben links, selektive Outline (oben/links eine Stufe heller).
Augen kleiner als 2×2 px (Menschen, Ente, Reiher) haben keinen Lichtpunkt; Frosch/Fridolin haben 2×2-Pupillen mit 1 Lichtpunkt.

| Ordner/Datei | Inhalt |
|---|---|
| `palettes/see_ext.json` | 27 Zusatzfarben für W1 (Wolke, Nachtblau, Abendglut, Dunkelholz, Signalrot, Stein, Sand) – mit `see` 59 Farben |
| `palettes/figures.json`, `hud.json` | Rampen für Figuren (52) und HUD (53, inkl. Seltenheitsfarben B5) |
| `world/see/layer_*.gen.json`, `world/see/sprites/*.gen.json` | Parameter je Ebene/Sprite |
| `figures/*.gen.json`, `ui/*.gen.json` | Parameter je Figur/HUD-Element |
| `contact/see_world_contact.png` | Deko-Atlas 3× (hell/dunkel) |
| `contact/see_layers_contact.png`, `figures_contact.png`, `hud_contact.png` | Ebenen 1×, Figuren 3×, HUD 3× |
| `contact/see_scene_preview_{quer,quer_tief,hoch}.png` | zusammengesetzte Szene (2×), `_tageszeiten.png` (4 Tageszeiten, 1×) |

### Frame-Namen

Regel: `<objekt>[_<variante>]_<clip>_<n>`. Animations-Key = Name ohne `_<n>`. Standbilder haben den Clip `still`.
`meta.clips` = `{ key: fps }` (nur animierte Keys, wie bei den Fischen), `meta.anims` = `{ key: {frames, fps, loop, yoyo} }`.
Anker stehen je Frame unter `anchors` (Pixel im Frame; in Phaser über `frame.customData.anchors`).
Ausnahme `rod_bend_0..3`: Frame = Biegestufe (Spec 6.5 `bendFrames`), kein Zeit-Clip.

#### `public/assets/worlds/see/atlas_world_see` (Palette see + see_ext)
| Animation/Bild (`<key>_<n>`) | Frames | Größe | FPS | Anker |
|---|---|---|---|---|
| `see_seerose_blatt_a_still` | 1 | 19×7 | – | wasserlinie |
| `see_seerose_blatt_b_still` | 1 | 15×7 | – | wasserlinie |
| `see_seerose_blatt_c_still` | 1 | 23×7 | – | wasserlinie |
| `see_seerose_bluete_still` | 1 | 13×9 | – | fuss |
| `see_schilf_sway` | 3 | 16×40 | 3 yoyo | fuss |
| `see_wasserpest_sway` | 4 | 14×50 | 4 | fuss |
| `see_libelle_fly` | 2 | 15×8 | 16 | – |
| `see_ente_swim` | 2 | 20×16 | 4 | wasserlinie |
| `see_ente_dabble` | 2 | 16×20 | 5 | wasserlinie |
| `see_frosch_idle` | 1 | 14×11 | – | fuss |
| `see_frosch_quak` | 2 | 14×11 | 6 yoyo | fuss |
| `see_kaulquappen_swim` | 4 | 28×16 | 8 | – |
| `see_gluehwuermchen_glow` | 4 | 7×7 | 6 | – |
| `see_blase_s_wobble` | 4 | 6×7 | 8 | – |
| `see_blase_m_wobble` | 4 | 8×9 | 8 | – |
| `see_blase_l_wobble` | 4 | 10×11 | 8 | – |
| `see_lichtfleck_shimmer` | 4 | 20×5 | 5 | – |
| `see_regentropfen_still` | 1 | 1×5 | – | – |
| `see_regenring_splash` | 3 | 15×6 | 12 einmal | wasserlinie |
| `see_kruemelwolke_drift` | 4 | 34×26 | 4 | – |
| `see_sonne_still` | 1 | 22×22 | – | – |
| `see_mond_voll_still` | 1 | 15×15 | – | – |
| `see_mond_sichel_still` | 1 | 15×15 | – | – |
| `see_wolke_a_still` | 1 | 48×19 | – | – |
| `see_wolke_b_still` | 1 | 32×14 | – | – |
| `see_stern_twinkle` | 2 | 5×5 | 2 yoyo | – |
| `see_schwalbe_fly` | 2 | 13×7 | 10 | – |
| `see_reiher_still` | 1 | 18×32 | – | fuss |
| `see_wasserlaeufer_skate` | 2 | 9×4 | 6 | wasserlinie |
| `see_muecken_swarm` | 4 | 14×12 | 10 | – |
| `see_mondsaeule_shimmer` | 4 | 26×6 | 4 | oben |
| `see_blitz_a_still` | 1 | 28×88 | – | – |
| `see_blitz_b_still` | 1 | 28×88 | – | – |

#### `public/assets/figures/atlas_figures` (Palette figures)
| Animation/Bild (`<key>_<n>`) | Frames | Größe | FPS | Anker |
|---|---|---|---|---|
| `angler_a_sit_still` | 1 | 22×30 | – | hand, sitz |
| `angler_b_sit_still` | 1 | 22×30 | – | hand, sitz |
| `angler_c_sit_still` | 1 | 22×30 | – | hand, sitz |
| `angler_d_sit_still` | 1 | 22×30 | – | hand, sitz |
| `rod_bend` | 4 | 56×50 | 1 | griff, spitze, ende |
| `pose_idle` | 2 | 9×28 | 2 yoyo | wasserlinie |
| `pose_nibble` | 2 | 9×28 | 10 | wasserlinie |
| `pose_bite` | 2 | 9×28 | 8 einmal | wasserlinie |
| `bait_wurm_wiggle` | 2 | 11×15 | 4 | schnur |
| `kescher_still` | 1 | 30×24 | – | griff |
| `boat_ruderboot_rock` | 2 | 56×20 | 2 yoyo | wasserlinie, sitz |
| `otto_still` | 1 | 30×42 | – | – |
| `fridolin_still` | 1 | 25×34 | – | – |
| `wetter_sonnig_still` | 1 | 16×16 | – | – |
| `wetter_bewoelkt_still` | 1 | 16×16 | – | – |
| `wetter_regen_still` | 1 | 16×16 | – | – |
| `wetter_gewitter_still` | 1 | 16×16 | – | – |
| `wetter_nebel_still` | 1 | 16×16 | – | – |

#### `public/assets/ui/atlas_hud` (Palette hud)
| Animation/Bild (`<key>_<n>`) | Frames | Größe | FPS | Anker |
|---|---|---|---|---|
| `hud_panel_wood_still` | 1 | 24×24 | – | slice |
| `hud_power_frame_still` | 1 | 14×74 | – | fenster |
| `hud_power_fill_still` | 1 | 8×64 | – | – |
| `hud_power_marker_still` | 1 | 16×5 | – | – |
| `hud_tension_frame_still` | 1 | 168×16 | – | fenster |
| `hud_tension_zone_gruen_still` | 1 | 4×8 | – | – |
| `hud_tension_zone_gelb_still` | 1 | 4×8 | – | – |
| `hud_tension_zone_rot_still` | 1 | 4×8 | – | – |
| `hud_tension_zone_leer_still` | 1 | 4×8 | – | – |
| `hud_tension_needle_still` | 1 | 7×16 | – | spitze |
| `hud_distance_frame_still` | 1 | 104×10 | – | fenster |
| `hud_distance_fill_still` | 1 | 4×2 | – | – |
| `hud_icon_fisch_still` | 1 | 11×8 | – | – |
| `hud_icon_boot_still` | 1 | 12×8 | – | – |
| `hud_icon_uhr_still` | 1 | 13×13 | – | – |
| `hud_depth_scale_still` | 1 | 20×132 | – | fenster |
| `hud_depth_fill_see_still` | 1 | 8×120 | – | – |
| `hud_depth_marker_still` | 1 | 9×7 | – | spitze |
| `hud_arrow_left_pulse` | 2 | 17×17 | 6 yoyo | – |
| `hud_arrow_right_pulse` | 2 | 17×17 | 6 yoyo | – |
| `hud_arrow_down_pulse` | 2 | 17×17 | 6 yoyo | – |
| `hud_stamina_full_still` | 1 | 11×11 | – | – |
| `hud_stamina_half_still` | 1 | 11×11 | – | – |
| `hud_stamina_empty_still` | 1 | 11×11 | – | – |
| `hud_itemslot_still` | 1 | 30×30 | – | fenster |
| `hud_itemslot_active_still` | 1 | 30×30 | – | fenster |
| `hud_bite_pop` | 3 | 9×20 | 12 einmal | – |
| `hud_fake_pop` | 3 | 9×20 | 12 einmal | – |
| `hud_nibble_dots` | 3 | 15×5 | 4 | – |
| `hud_sparkle_perfect` | 4 | 17×17 | 12 einmal | – |
| `hud_rarity_gewoehnlich_still` | 1 | 13×13 | – | – |
| `hud_rarity_ungewoehnlich_still` | 1 | 13×13 | – | – |
| `hud_rarity_selten_still` | 1 | 13×13 | – | – |
| `hud_rarity_episch_still` | 1 | 13×13 | – | – |
| `hud_rarity_legendaer_still` | 1 | 13×13 | – | – |
| `hud_wind_right_flutter` | 2 | 18×9 | 4 | – |
| `hud_wind_left_flutter` | 2 | 18×9 | 4 | – |

`fenster` = Innenbereich eines Rahmens für die Füllung (x, y, w, h). Spannungszonen sind 4×8-Kacheln (waagerecht
ganzzahlig wiederholen); `hud_power_fill` per `setCrop` von unten.

### Ebenen W1 (`public/assets/worlds/see/`, Details in `world_see.json`)

| Datei | Größe | Welt-y | Parallax X | Hinweis |
|---|---|---|---|---|
| `layer_sky_{morgen,tag,abend,nacht}.png` | 960×124 | 0 | 0.1 | je Tageszeit ein Himmel |
| `layer_far.png` | 960×68 | 46 | 0.3 | Mischwald, Kirchturm, Grillhütte (entsättigt) |
| `layer_mid.png` | 960×38 | 76 | 0.6 | Ufer, Schilfgürtel, Weide, Badestrand, Sprungturm |
| `layer_water.png` | 960×520 | 120 | 1.0 | Wasserkörper, 4 Tiefenschichten per Bayer |
| `layer_godrays.png` | 960×230 | 120 | 1.0 | Lichtstrahlen (transparent) |
| `layer_surface_{0..3}.png` | 960×10 | 114 | 1.0 | Oberfläche, 4 Frames Glanzlinien (4 fps) |
| `layer_lakebed.png` | 960×520 | 120 | 1.0 | Grund, Pfähle, Seerosenstiele, Kraut, Wagen, Fahrrad, Wrack, Wurzelstock |
| `layer_steg.png` | 232×100 | 20 | 1.0 | Bootshaus + Steg (nicht kachelbar) |
| `layer_foreground.png` | 960×116 | 38 | 1.15 | Schilfhalme vorn |
| `layer_fog.png` | 960×40 | 92 | 0.8 | Nebel (nur Wetter Nebel) |

Maßstab: 20 Spielpixel = 1 m, Oberfläche y = 120, 25 m bei y = 620, Welt 960×640.
Tageszeit: Himmel tauschen + Multiplikations-Tönung `tageszeiten.<t>.tint.oben/unter` (Phaser `setTint`).

### 9-Slice fürs HTML-UI (`public/assets/ui/`)
`frame_wood.png`, `frame_parchment.png`: je 24×24, **Slice 8 px** (Ecken 8×8), Mitte kachelbar; CSS-Vorschlag in `frames.json`
(`border-image: url(frame_wood.png) 8 fill / 8px round`, Randbreite × ganzzahliger Zoom).

### Bekannte Schwächen / Platzhalter (Welt 1)
- Alles prozedural bzw. als Zeichenraster; keine Bild-KI. Figuren nur sitzend (keine Wurf-/Kurbelposen), Otto/Fridolin nur Standbild.
- Nur eine Rute (R01 Bambus) in 4 Biegestufen; weitere Ruten/Boote/Hüte folgen dem Namensschema (`rod_<id>_bend_<n>`).
- Tageszeit-Tönung bringt zur Laufzeit Farben außerhalb der Palette (gewollt laut F1 „Paletten-Overlays“).

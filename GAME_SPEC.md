# KÖDERKÖNIGE – Bau-Prompt für Claude Code (Browser-Version)

> **So benutzt du diese Datei:**
> 1. Erstelle auf GitHub ein neues, leeres Repository (z. B. `koederkoenige`) und lade diese Datei als `GAME_SPEC.md` hoch.
> 2. Öffne in der Claude-App den Bereich **Code**, wähle das Repository und schreib:
>    *„Lies GAME_SPEC.md komplett. Du bist der Lead-Entwickler dieses Spiels. Halte dich an jede Regel darin und starte mit Phase 0.“*
> 3. Claude arbeitet in der Cloud. Du testest jeden Stand über einen Vorschau-Link direkt im Browser, auch auf dem Handy.
>
> Der Arbeitstitel „Köderkönige“ ist ein Vorschlag und kann jederzeit geändert werden.

---

## TEIL A – DEINE ROLLE UND ARBEITSWEISE

### A1. Rolle

Du bist **Lead-Entwickler, technischer Architekt und Produktionsleiter** für ein 2D-Wettkampf-Angel- und Sammelspiel **im Browser**. Du baust kein Wegwerf-Prototyp, sondern ein **fertiges, poliertes Spiel**, das ich mit meinen Freunden per Link spiele.

Eckdaten (nicht verhandelbar):
- **Genre:** Angeln & Sammeln, **gegeneinander** mit 2–4 Freunden online (Beitritt per Raumcode oder Link)
- **Umfang:** **100 Fischarten** in **5 Welten** (je 20), davon 5 Bossfische
- **Grafik:** **sehr detaillierte Pixel-Art** in Seitenansicht (oben Himmel, Boot/Steg, Wasseroberfläche; darunter Querschnitt durch das Wasser mit Tiefenschichten). Detailliert heißt: saubere Schattierung, Schuppen, Flossenstrahlen, Lichtkanten, flüssige Animationen. **Nicht grob, nicht generisch.**
- **Plattform:** **Browser** auf Handy (Hoch- und Querformat, Touch) und PC (Maus/Tastatur, Controller). Installierbar als Web-App (PWA).
- **Technik:** Phaser 4 + TypeScript + Vite, Supabase für Multiplayer, Anmeldung und Speicherstände, Hosting als statische Webseite (Teil B).
- **Sprache im Spiel:** Deutsch (Standard) und Englisch
- **Nicht** auf PlayDrop oder ähnlichen Spiele-Plattformen veröffentlichen.

Ich bin kein Profi-Programmierer und arbeite oft vom Handy. Erkläre Entscheidungen in **kurzen, einfachen Sätzen**, frag mich nur, wenn eine Entscheidung wirklich meine ist (Geschmack, Geld, Namen), und gib mir nach jedem Schritt einen **Vorschau-Link** und einen Screenshot.

### A2. Volle Leistung: Arbeiten mit Agenten

Arbeite als **Orchestrator** mit Subagenten (Agent/Task-Tool). Du verteilst Arbeit, prüfst Ergebnisse und setzt sie zusammen. Regeln:

1. **Parallel, wo unabhängig.** Starte Agenten gleichzeitig, wenn ihre Aufgaben sich nicht gegenseitig brauchen (z. B. Fischdaten + Netzwerk-Grundgerüst + Pixel-Pipeline). Abhängige Schritte nacheinander.
2. **Klare Dateigrenzen.** Jeder Agent bekommt eigene Ordner (Tabelle unten). Zwei Agenten schreiben nie gleichzeitig in dieselbe Datei. Bei Überschneidung: eigener Git-Worktree bzw. Branch pro Agent, danach mergen.
3. **Vollständiger Auftrag.** Jeder Agent bekommt: Ziel, die relevanten Abschnitte dieser Datei (Nummern nennen), Dateigrenzen, Definition of Done und die Skills, die er laden soll. Agenten starten ohne dein Wissen, also nichts voraussetzen.
4. **Unabhängige Prüfung.** Nach jeder Phase prüft ein **eigener QA-Agent, der den Code nicht geschrieben hat**, das Ergebnis gegen die Definition of Done. Kein Agent bewertet seine eigene Arbeit.
5. **Ehrliche Berichte.** Agenten melden, was wirklich läuft, was nicht und was ungeprüft ist. Keine Erfolgsmeldung ohne Beweis (Build grün, Tests grün, Screenshot aus dem echten Browser).

**Lege diese Subagenten als Dateien in `.claude/agents/` an** (Markdown mit Frontmatter `name`, `description`, `tools`), damit sie in jeder Sitzung gleich arbeiten:

| Agent | Aufgabe | Darf schreiben in |
|---|---|---|
| `architekt` | Projektstruktur, Kern-Schnittstellen, Szenen-Aufbau, Entscheidungs-Log | `src/core/`, `docs/` |
| `gameplay-coder` | Angeln, Drill, Spawns, Wetter, Tageszeit, Punkte, Items (reine Logik + Phaser-Szenen) | `src/game/`, `src/scenes/` |
| `netcode-coder` | Räume, Supabase Realtime, Host-Logik, Runden-State-Machine, Reconnect, Edge Functions, Datenbank | `src/net/`, `supabase/` |
| `daten-designer` | `fish.csv`, Datenbau-Skript, Balancing-Tabellen, Übersetzungen | `Data/`, `tools/build-data.ts`, `src/data/`, `src/i18n/` |
| `pixel-artist` | Art-Pipeline-Skripte, Paletten, Sprites, Kontaktbögen, Animationen, Texture-Atlanten | `tools/art/`, `art_src/`, `public/assets/` |
| `ui-designer` | Menüs, HUD, Lexikon, Shop, Lobby | `src/ui/` |
| `audio-designer` | Soundliste, Platzhalter-Sounds, Musik-Briefing, Audio-Manager | `public/audio/`, `src/audio/` |
| `qa-pruefer` | Tests schreiben und ausführen, Browser-Tests, Phasen-Abnahme, Bugliste. **Ändert keinen Spielcode**, nur Tests und Berichte. | `tests/`, `docs/qa/` |

Zusätzlich: eine **`CLAUDE.md`** im Repository mit den wichtigsten Dauerregeln (Teil I in Kurzform, Ordnerstruktur, Namenskonventionen, Befehle wie `npm run dev / test / build / data / art`). Halte sie aktuell.

### A3. Skills – welche, wann

Lade den passenden Skill **bevor** du an dem Bereich arbeitest (Skill-Tool) und folge seinen Anweisungen. Gib den Namen jedes Skills, den ein Subagent braucht, in seinem Auftrag mit. Ist ein Skill in dieser Umgebung nicht verfügbar, sag es mir kurz und arbeite nach den Regeln in dieser Datei weiter.

| Bereich | Skills |
|---|---|
| Architektur, Systemaufbau | `engineering:architecture`, `engineering:system-design` |
| Tests, Fehlersuche, Review | `engineering:testing-strategy`, `engineering:debug`, `engineering:code-review` |
| Veröffentlichen | `engineering:deploy-checklist` |
| Menüs, HUD, Lexikon (visuelle Richtung) | `anthropic-skills:frontend-design`, `design-skills:interaction-design` |
| Texte im Spiel | `design-skills:ux-writing` |
| Barrierefreiheit | `design-skills:accessibility-audit` |
| Bildserien erzeugen (Konsistenz-Regeln) | `image-generation:image-generation` |
| Sound und Musik (nur Lizenz-Regeln) | `social-media-skills:ai-music-and-sound` |

### A4. Werkzeuge

- **Node.js (LTS) + npm**, Vite, TypeScript (strict), Vitest für Tests, **Playwright** für Browser-Tests und Screenshots (Desktop + Handy-Viewport, z. B. iPhone- und Android-Profil).
- **Python 3** mit Pillow für die Pixel-Pipeline (`tools/art/`).
- **Supabase CLI** für Migrationen, Edge Functions und lokale Tests. Wenn ein Supabase-MCP-Server verbunden ist, darfst du ihn nutzen. **Lege ein eigenes, neues Supabase-Projekt für dieses Spiel an** (nicht in einem bestehenden Projekt arbeiten). Der Free-Plan erlaubt nur 2 aktive Projekte – sag mir Bescheid, falls das Limit erreicht ist.
- **Git + GitHub.** Committe nach jedem abgeschlossenen Schritt mit klarer Nachricht, arbeite auf Branches, merge nach bestandener QA.
- **Bild-KI (optional):** Wenn ich einen **PixelLab-MCP-Server** oder einen **Retro-Diffusion-API-Schlüssel** einrichte, nutze sie für die Fische (Teil F). Diese Dienste kosten Credits: **Frag mich vor jedem Batch mit Kostenschätzung.** Ohne sie läuft der prozedurale Weg (F8).
- **Geheimnisse** (API-Schlüssel, Supabase Service-Role-Key) nur als Umgebungsvariablen bzw. Secrets, **nie** im Repository und **nie** im Browser-Code. Im Browser nur der öffentliche Anon-Key.

### A5. Wann du mich fragst – und wann nicht

**Frag mich** bei: Geld (Credits, kostenpflichtige Pläne), Spielname, Look-Freigabe der ersten Ankerfische pro Welt, Löschen von Arbeit, Echtgeld-Käufen, eigener Domain.
**Nicht fragen** bei: technischen Details, die in dieser Datei geregelt sind, Ordnernamen, Variablennamen, Reihenfolge innerhalb einer Phase. Entscheide selbst und schreib die Entscheidung in `docs/entscheidungen.md`.

---

## TEIL B – TECHNISCHE VORGABEN

### B1. Projekt und Stack

| Baustein | Wahl |
|---|---|
| Spiel-Engine | **Phaser 4** (aktuelle stabile Version prüfen und festschreiben; im Sommer 2026 war das 4.2.x) mit WebGL-Renderer |
| Sprache / Build | **TypeScript strict** + **Vite** |
| UI | Menüs und Lexikon als **HTML/CSS-Overlay** über dem Canvas (scharfe Schrift, Barrierefreiheit, einfache Listen); HUD während des Angelns direkt in Phaser |
| Tests | **Vitest** (Logik), **Playwright** (Browser, Multiplayer mit mehreren Tabs, Screenshots) |
| Backend | **Supabase**: Anonyme Anmeldung, Realtime (Broadcast + Presence), Postgres mit Row Level Security, Edge Functions |
| Hosting | statische Seite auf **Cloudflare Pages** oder **Vercel** (kostenlos), mit **Vorschau-Link pro Branch**. Wähle eins, notiere es. |
| Offline/Installieren | PWA mit Service Worker (Vite-PWA-Plugin), Assets werden gecacht |

**Startbefehle** (in `package.json`): `dev`, `build`, `preview`, `test`, `test:e2e`, `data` (Fischdaten bauen), `art` (Pixel-Pipeline), `lint`.

### B2. Ordnerstruktur und Namen

```
src/
  main.ts                 Phaser-Konfiguration, Start
  core/                   Event-Bus, Zufall (seedbar), Zeit, Speicher, Einstellungen
  game/                   reine Spiellogik ohne Phaser (Drill, Spawn, Punkte, Größe, Wetter …) → testbar
  scenes/                 Boot, Preload, Hafen, Welt, FangPraesentation, Ergebnis
  net/                    Raum, Host, Client, Nachrichten-Typen, Runden-State-Machine
  ui/                     HTML/CSS-Overlays: Menüs, Lexikon, Shop, Lobby, Einstellungen
  audio/                  Audio-Manager (Kanäle: Musik, SFX, Umgebung, Foley, UI)
  data/                   types.ts + Lader für fish_db.json
  i18n/                   de.json, en.json + kleiner t()-Helfer
public/
  assets/fish/<welt>/     Texture-Atlas pro Welt (atlas_fish_<welt>.png + .json)
  assets/worlds/<welt>/   Hintergrund-Ebenen, Tileset, Deko
  assets/ui/              UI-Atlas, Pixel-Schrift
  audio/                  mus_*, sfx_*, amb_*, fol_*, ui_* (OGG + M4A)
  data/fish_db.json       wird von tools/build-data.ts erzeugt
Data/fish.csv             Quelle der Wahrheit für alle 100 Fische (Teil G)
supabase/migrations/      Tabellen + RLS
supabase/functions/       Edge Functions (submit-round, save-progress)
tools/                    build-data.ts, art/ (Python-Pixel-Pipeline)
art_src/                  Rohbilder, Paletten, Kontaktbögen, *.gen.json
tests/                    unit/, e2e/
docs/                     entscheidungen.md, qa/, balancing.md, lizenzen.md, platzhalter.md
```

- Welt-Kürzel: `see`, `riff`, `fjord`, `tiefe`, `grotte`. Fisch-Sprites: `fish_<welt>_<nr>_<name>_<clip>` (z. B. `fish_riff_027_clownfisch_swim`).
- **Reine Logik gehört nach `src/game/`** und kennt Phaser nicht. So läuft sie gleich im Host-Browser, in Tests und in der Edge Function zur Prüfung.
- Keine hartcodierten Texte im Code. Alles über `t('schlüssel')`.

### B3. Pixel-Perfect-Grundlage (vor allen Grafiken einrichten)

- **Interne Auflösung 640×360** (Querformat) als feste Spielwelt-Größe, danach **nie mehr ändern**. Die Spielfläche wird **ganzzahlig** hochskaliert (2×, 3×, 4× …), Rest als Rand in Weltfarbe.
- **Hochformat auf dem Handy:** gleiche Spielwelt, Kamera zeigt einen schmaleren Ausschnitt (z. B. 360×640 intern) mit derselben Pixelgröße; HUD wird umgeordnet. Beide Formate früh testen.
- Phaser-Konfiguration: `pixelArt: true`, `roundPixels: true`, `antialias: false`, Scale-Modus mit ganzzahligem Zoom (eigene Resize-Logik, die den größten ganzzahligen Faktor wählt), CSS `image-rendering: pixelated` am Canvas.
- **Alle Texturen** mit Nearest-Filter, keine Mipmaps, keine Kompression mit Qualitätsverlust (PNG). Sprite-Positionen immer auf ganze Pixel runden (auch Kamera-Scroll).
- **Texture-Atlanten:** ein Atlas pro Welt für Fische, einer pro Welt für Hintergrund/Deko, einer für UI. Padding ≥ 2 px, Extrude 1 px gegen Kantenflimmern. Welten werden erst **beim Betreten geladen** (eigene Preload-Szene mit Fortschrittsbalken).
- **Licht und Leuchten (Welt 4/5):** Phaser-4-Lichtsystem bzw. Filter (Glow) sparsam einsetzen; Alternative: additive Leucht-Sprites. Tiefe = dunkler über eine Overlay-Ebene pro Tiefenschicht. Ergebnis per Screenshot prüfen, Leistung auf dem Handy messen.
- **Physik:** keine schwere Physik-Engine nötig. Schnur als **Verlet-Seil** in eigener Logik (gezeichnet als Pixel-Linie ohne Glättung), Köder mit einfacher Sink-/Auftriebsformel, Fische mit Skript-Steuerung (deterministisch, gut für Multiplayer).
- **Welten-Terrain:** Tilemaps (Tiled-Format oder per Code erzeugt) mit 16×16- oder 32×32-Tiles; Grund, Felsen, Riffe, Eis, Basalt, Seegras.

### B4. Multiplayer-Architektur (Supabase)

**Grundsatz: Der Browser des Gastgebers (Host) entscheidet über Zufall, Punkte und Zeit.** Die anderen Browser schicken nur Absichten und zeigen Ergebnisse an. Ein Angelspiel ist nicht zeitkritisch wie ein Shooter – Ereignisse statt Dauer-Streams reichen.

**Bausteine:**
- **Anmeldung:** Supabase **anonyme Anmeldung** beim ersten Start (kein Passwort nötig). Optional später: Konto mit E-Mail verknüpfen, damit der Spielstand aufs Handy und den PC kommt.
- **Raum:** 6-stelliger Code (ohne verwechselbare Zeichen wie 0/O, 1/I). Realtime-Kanal `raum:<CODE>`. Wer den Raum erstellt, ist Host.
- **Presence** im Kanal: wer ist da, Name, Hut/Boot, Bereit-Status.
- **Broadcast** im Kanal: alle Spielnachrichten (Tabelle unten), mit Typ, Absender, laufender Nummer, Zeitstempel.
- **Link:** `https://<seite>/?raum=ABC123` öffnet direkt den Beitritt. Knopf „Link teilen“ nutzt die Teilen-Funktion des Handys (Web Share API), sonst Kopieren.

| Was | Autorität | Nachricht |
|---|---|---|
| Boot-/Spielerposition | eigener Client, Host begrenzt Zone | `pos` nur bei Änderung, höchstens 5×/s |
| Wurf | Host | Client: `cast {kraft, ziel}` → Host prüft Phase, Abklingzeit, Reichweite → `rodState {spieler, zustand}` (Idle, Casting, Sinking, Waiting, Nibble, Bite, Reeling, Caught, Escaped) |
| Fisch-Schatten | Host | `shadows` alle 0,5 s: Position + Größenklasse pro Schatten. **Die Art bleibt geheim.** |
| Biss | Host | Host würfelt Wartezeit und Art (seedbarer Zufall, Spawn-Formel aus D 1.9). An den Client nur `bite {schwierigkeit, verhalten}` – nicht die Art. |
| Drill | Client spielt, Host prüft | Client sendet alle 0,5 s `reel {spannung, fortschritt}` und am Ende `reelResult`. Host prüft Mindestdauer und Plausibilität, dann entscheidet er. |
| Fang | Host | `catch {spieler, nr, länge, gewicht, schillernd, punkte}` an alle → Fang-Meldung und Feed |
| Punkte | Host | `scores` nach jeder Änderung (komplette Liste) |
| Timer | Host | **ein Wert:** `phaseEnd` (Zeitstempel). Clients rechnen lokal; Uhrzeit-Versatz beim Beitritt messen (Ping-Pong). |
| Phase, Welt, Modus, Wetter, Tageszeit | Host | `round {…}` bei jeder Änderung |
| Emotes | jeder | `emote {id}` („Petri Heil!“, „Nicht schon wieder!“, 🐟, 😂) – kein Text- oder Sprachchat in v1 |

**Nachrichten-Budget:** Der Supabase-Free-Plan hat (Stand Nov. 2026) **2 Mio. Realtime-Nachrichten pro Monat, 200 gleichzeitige Verbindungen und 100 Nachrichten pro Sekunde** pro Projekt. Halte eine 4-Spieler-Runde von 5 Minuten bei **unter 15.000 Nachrichten** (Ereignisse statt Dauer-Sync, Positionen nur bei Änderung). Baue einen Debug-Zähler ein, der Nachrichten pro Runde misst, und schreib das Ergebnis in `docs/entscheidungen.md`. Hinweis: Projekte im Free-Plan pausieren nach 7 Tagen ohne Nutzung.

**Runden-State-Machine (läuft im Host, reine Logik in `src/net/round.ts`):**
```
Lobby → Countdown (5 s) → Fishing (3/5/8 Min) → Finale (letzte 60 s, ×1,5)
      → LastCast (keine neuen Würfe, gehakte Fische dürfen 5 s fertig gedrillt werden)
      → Results (15 s, Host ruft Edge Function submit-round) → Lobby | nächste Turnierrunde
Jede Phase → Aborted (Host weg) → Hafen
```

**Warteraum:** Host wählt Welt, Modus, Dauer, Ausrüstungs-Regel; alle sehen die Teilnehmer; ein Knopf „Bereit (2/3)“ für alle; bei allen bereit startet der Countdown automatisch. Spieler, die später per Link kommen, dürfen bis zum Start noch rein. Nach dem Start ist der Raum gesperrt (Host lehnt neue Beitritte ab).

**Verbindungsabbruch:** Ein Client, der kurz weg ist (Handy gesperrt, Tab gewechselt), kommt mit derselben Spieler-ID (Supabase-User-ID) zurück und bekommt vom Host den aktuellen Stand (`sync`-Nachricht). Punkte gehören zur User-ID, nicht zur Verbindung. **Host verlässt das Spiel:** Runde endet, alle sehen den letzten Stand, ein anderer Spieler kann eine Revanche als neuer Host starten. **Achtung Handy-Browser:** Ein Host-Tab im Hintergrund wird gedrosselt. Zeig dem Host einen deutlichen Hinweis („Bleib in diesem Tab, sonst pausiert die Runde für alle“) und empfiehl, dass ein PC hostet, wenn einer dabei ist.

**Speicherstände und Schutz vor Schummeln:**
- Tabellen (Migrationen in `supabase/migrations/`): `profiles` (Name, Kosmetik), `progress` (Münzen, Perlen, Ruf, freigeschaltete Welten, Ausrüstung), `lexicon` (pro Spieler und Fisch: gefangen, Anzahl, Rekordlänge/-gewicht, Sterne, schillernd), `rounds` (Ergebnisse), `leaderboard` (Bestwerte pro Modus/Welt).
- **Row Level Security überall.** Spieler dürfen ihre eigenen Daten **lesen**, aber Münzen, Perlen, Ruf, Lexikon und Rekorde **nie direkt schreiben**.
- Geschrieben wird nur über **Edge Functions** mit Service-Role-Key auf dem Server:
  - `submit-round`: Host schickt am Rundenende alle Fänge. Die Funktion prüft Plausibilität (Fanganzahl ≤ Rundendauer / Mindestfangzeit, Werte passen zur Fischtabelle, Seltenheitsverteilung, Spieler waren im Raum) und schreibt erst dann.
  - `save-progress`: im **Freien Angeln** (Einzelspieler) alle 2 Minuten und beim Verlassen, gleiche Prüfungen.
  - `buy-item`: Käufe im Angelladen (Preis und Ruf-Voraussetzung prüft der Server).
- Die Prüf-Logik nutzt dieselben Funktionen aus `src/game/` (geteilter TypeScript-Code).
- Lokaler Zwischenspeicher (IndexedDB) für Einstellungen und als Puffer, falls kurz kein Internet da ist.

**Früh testen (Phase 2):** (1) 4 Spieler in 4 Browser-Tabs per Playwright, (2) Handy + PC zusammen, (3) Host-Tab im Hintergrund auf dem Handy, (4) Nachrichten pro Runde messen.

### B5. UI

- **HTML/CSS-Overlays** für Menüs, Lexikon, Shop, Lobby, Einstellungen, Ergebnis: scharfe Pixel-Schrift (frei lizenzierte Pixel-Font mit deutschen Umlauten, Lizenz in `docs/lizenzen.md`), `image-rendering: pixelated` für Pixel-Rahmen (9-Slice über `border-image`).
- **HUD im Spiel** (Wurfkraft, Tiefenanzeige, Spannungsbalken, Ausdauer, Richtungspfeil, Item-Slot, Timer, Mini-Rangliste, Fang-Feed, Wetter-Vorhersage) direkt in Phaser, pixelgenau.
- Sichere Bereiche auf dem Handy beachten (`env(safe-area-inset-*)`), Touch-Ziele mindestens 44×44 px, kein Zoomen/Scrollen beim Spielen, Vollbild-Knopf.
- Alles auch mit Tastatur und Controller (Gamepad-API) bedienbar.
- **UI-Stil:** warmes Holz- und Seemanns-Thema (Taue, Messing, Pergament fürs Lexikon). Seltenheitsfarben: Gewöhnlich `#B0B7C3`, Ungewöhnlich `#5BD16B`, Selten `#3FA9F5`, Episch `#A86BFF`, Legendär `#FFC83D`; zusätzlich Symbole für Farbenblinde.

**Bildschirme:** Titel → Hafen (Hub) → Angelladen, Lexikon, Aquarium, Anschlagtafel (Aufträge), Ticket-Bude (Weltkarte), Freunde/Raum (Erstellen, Beitreten, Warteraum) → Spiel-HUD → Fang-Präsentation → Ergebnis-Bildschirm → Einstellungen (Lautstärken, Sprache, Steuerung, Vibration, Bildschirmwackeln an/aus, Farbenblind-Modus).

### B6. Audio

- Eigener Audio-Manager (Web Audio über Phaser) mit Kanälen Musik, SFX, Umgebung, Foley, UI; jeder mit Lautstärkeregler. Ton startet erst nach der ersten Berührung (Browser-Regel). Unterwasser-Filter (Tiefpass) für die Fang-Kamera.
- Sound-Liste in `docs/sounds.md` mit Dateinamen (`sfx_cast_whoosh`, `fol_reel_click`, `fol_line_tension_loop` (Tonhöhe folgt der Spannung), `sfx_bite_plop`, `sfx_catch_fanfare_<seltenheit>`, `amb_<welt>_day/night`, `mus_<welt>_calm`, `mus_finale` …).
- Platzhalter-Sounds per Skript erzeugen (z. B. mit einer kleinen Synth-Bibliothek wie jsfxr), bis echte da sind. Nur Musik und Sounds mit klarer Lizenz; jede Quelle in `docs/lizenzen.md`.
- Handy-Vibration über die Vibration-API (abschaltbar; auf iPhones nicht verfügbar – dort weglassen).

### B7. Sprachen

`src/i18n/de.json` (Standard) und `en.json`, kleiner `t()`-Helfer mit Platzhaltern und Mehrzahl („{count} Fische gefangen“). Sprache aus dem Browser übernehmen, im Menü umschaltbar. Deutsche Buttons im Imperativ („Auswerfen!“). Vor jeder Phasen-Abnahme Vollständigkeits-Test: jeder Schlüssel in beiden Sprachen vorhanden und nicht leer.

### B8. Leistung und Veröffentlichung

- Ziel: **60 FPS** auf einem Mittelklasse-Handy (4 Jahre alt) und einem einfachen Laptop. Messen, nicht schätzen.
- Höchstens 40 sichtbare Fisch-Schatten, Objekt-Pools für Fische, Partikel und Blasen, Lichteffekte begrenzen.
- **Erster Download unter 10 MB** (Hafen + Welt 1), die anderen Welten werden nachgeladen. Audio als OGG + M4A (Safari).
- In **Chrome, Safari (iPhone) und Firefox** testen, jeweils Handy und Desktop.
- Veröffentlichung: Hauptbranch → automatisch auf die feste Adresse; jeder andere Branch → eigener Vorschau-Link. Umgebungsvariablen (Supabase-URL, Anon-Key) im Hosting-Dienst setzen.

---

## TEIL D – SPIELDESIGN

> Die Nummern 0–6 in Teil D, E und G sind die Kapitel des Spieldesigns. „Abschnitt 4/5“ meint Teil E, „Abschnitt 6“ meint Teil G. Alle Zahlen sind **erste Werte** und werden in Phase 5 per Simulation und Spieltest feinjustiert.

### 0. Spielidee in 30 Sekunden

Bis zu vier Freunde sitzen jeweils in ihrem eigenen kleinen Boot oder an einem Platz am Steg, alle in derselben Welt. Sie werfen aus, lassen den Köder auf die richtige Tiefe sinken, warten auf den Biss und liefern sich dann einen kurzen Drill, der sich wie ein kleines Kampfspiel anfühlt. Jeder Fang bringt Punkte für die laufende Runde, Münzen für den Angelladen und einen neuen Eintrag im **Fischlexikon**. Wer zuerst alle 100 Fische hat, darf sich *Köderkönig* nennen.

**Drei Säulen des Designs:**
1. **Gutes Gefühl in der Hand:** Der Drill ist ein Geschicklichkeitsspiel. Jede Verhaltensart (Springer, Taucher, Trickser …) verlangt eine andere Reaktion.
2. **Sammeln & Angeben:** Silhouetten im Lexikon, Größenrekorde und schillernde Varianten. Jeder seltene Fang wird allen Mitspielern groß angezeigt.
3. **Fairer Wettkampf unter Freunden:** Kurze Runden und Aufholregeln für alle, die hinten liegen. Schabernack-Items sind lustig, aber nie gemein. Der Stufenausgleich schützt neue Spieler vor Profis mit Top-Ausrüstung.

**Heimathafen (Hub):** *Möwenhafen*, ein kleines Hafenstädtchen. Dort gibt es:
- Opa Ottos Angelladen (Shop)
- das Aquarium (ausgestellte Fänge)
- die Lexikon-Bibliothek
- die Ticket-Bude am Pier (Weltenreisen)
- die Anschlagtafel (Tagesaufträge)

---

### 1. Kernschleife & Angelmechanik

#### 1.1 Kernschleife

```
Ausrüsten (Rute, Schnur, Rolle, Köder)
   → Auswerfen (Wurfkraft-Balken)
   → Köder auf Tiefe bringen (Sinken lassen / Stoppen)
   → Warten, Zupfer lesen, Biss! → Anschlag (Reaktionsfenster)
   → Drill (Spannungsbalken gegen das Fischverhalten)
   → Fang! (Größe, Gewicht, Schillernd-Prüfung, Lexikon-Eintrag, Punkte)
   → Verkaufen / Aquarium / Lexikon
   → Münzen → Upgrades → neue Tiefen, neue Welten, neue Fische
```

**Ziel-Taktung:** Ein normaler Fang dauert vom Wurf bis zum Kescher **20–45 Sekunden**, ein Episch-Fang 45–75 s und ein Boss 2–4 Minuten. In einer 5-Minuten-Runde schafft man so 8–14 Fänge.

#### 1.2 Steuerung

| Aktion | PC (Tastatur/Maus) | Handy (Touch) | Controller |
|---|---|---|---|
| Wurf aufladen / auslösen | Leertaste oder linke Maustaste halten, loslassen | Wurf-Knopf halten, loslassen | A halten |
| Köder sinken lassen / stoppen | S halten / loslassen | nach unten wischen und halten | Stick runter |
| Anschlag | Leertaste / Klick | Tippen | A |
| Kurbeln | Leertaste/Maustaste halten | Kurbel-Knopf halten | RT halten |
| Rute nach links/rechts führen (Konter) | A / D | linke/rechte Bildschirmhälfte gedrückt halten | Stick links/rechts |
| Rute hochreißen (gegen Taucher) | W | nach oben wischen | Stick hoch |
| Item benutzen | E | Item-Knopf | X |

#### 1.3 Auswerfen – der Wurfkraft-Balken

- Beim Halten füllt sich ein **Wurfkraft-Balken** von 0 auf 100 % und läuft dann wieder zurück (Ping-Pong). Ein ganzer Durchlauf dauert 1,2 s (die Rute kann das ändern).
- **Wurfweite** = `Wurfkraft × Rute.MaxWurfweite`. Die Weite bestimmt die **horizontale Zone**:
  - *Uferzone* (0–30 % der Weite)
  - *Freiwasser* (30–75 %)
  - *Kante* (75–100 %, nur mit guten Ruten erreichbar; viele seltene Fische leben hier)
- **Perfekter Wurf:** Wer bei 92–100 % loslässt, sieht einen goldenen Funken und hört ein „Pling!“. Belohnung: +10 % Bissrate für diesen Wurf und ×1,1 Punkte beim Fang. Die Rutenstufe vergrößert das Perfekt-Fenster (bis 86–100 %).
- **Fehlwurf:** Bei unter 10 % plumpst der Köder direkt vor das Boot. Er bleibt aber im Spiel (Uferzone).
- **Wind** (bei Sturm, Gewitter, Schneesturm) verschiebt den Landepunkt um ±10 %. Ein Windpfeil im HUD zeigt die Richtung.

#### 1.4 Ködertiefe

- Nach der Landung sinkt der Köder, solange der Spieler „Sinken“ hält. Lässt er los, bleibt der Köder auf der Tiefe stehen. Eine **Tiefenanzeige** am Bildschirmrand zeigt die Meter und die Tiefenschichten der Welt in Farbe.
- Die **maximale Tiefe** begrenzt die Rolle (Schnurkapazität). Fehlt Schnur, wackelt die Anzeige rot: „Schnur zu kurz!“.
- **Sinkgeschwindigkeit:** Sie hängt vom Köder ab (Gewicht leicht/mittel/schwer). In Welt 4 kommt die Tiefseewinde dazu, die den Abstieg beschleunigt.
- **Aktive Köderführung:** Kurzes Antippen von „Kurbeln“ während des Wartens lässt den Köder **zucken**. Raubfische (Hecht, Barrakuda, Viperfisch …) beißen auf einen zuckenden Köder um 25 % öfter. Friedfische mögen einen ruhigen Köder lieber.
- Im Wasser sieht man schwimmende Fische nur als **dunkle Schatten**. Ihre Art erkennt man erst beim Fang. Bereits gefangene Arten zeigen im Schatten ein kleines Lexikon-Symbol.

#### 1.5 Biss & Anschlag

1. **Annäherung:** Ein Fisch, der zur Tiefe, Zone, Zeit, zum Wetter und zum Köder passt, schwimmt zum Köder.
2. **Zupfer:** 0–3 Mal zuckt die Pose oder der Köder leicht (kleines „…“ über dem Schwimmer). Wer jetzt schon anschlägt, verscheucht den Fisch, und die Bissrate in dieser Zone sinkt für 5 s.
3. **Biss!:** Die Pose taucht ab, ein großes rotes „!“ erscheint, das Handy vibriert. Ab jetzt läuft das **Anschlagfenster**:
   - Grundwert 0,6 s
   - Gewöhnlich +0,2 s, Legendär −0,15 s
   - Rute „Reaktion“: +0,05 s je Stufe
4. **Anschlag zu spät:** Der Köder ist weg, du musst neu beködern (kostet bei teuren Ködern 1 Stück).
5. **Perfekter Anschlag** (in den ersten 40 % des Fensters): Der Fisch startet mit 15 % weniger Ausdauer.

Wie viele Zupfer kommen, hängt vom Fisch ab (`nibbleMin/Max` in den Daten). Trickser haben zusätzlich „Scheinbisse“: Ein „!“ flackert nur kurz auf und ist orange statt rot.

#### 1.6 Der Drill – Spannungsbalken-Minispiel

**Bildschirmaufbau während des Drills:**
- Ein waagerechter **Spannungsbalken** (0–100 %) mit einer **grünen Zone**. Darüber kommt eine gelbe Warnzone, ab 90 % eine rote Zone.
- Ein **Distanzbalken** (Fisch → Boot) und die **Ausdauer des Fisches** als kleine Herz- oder Flossenleiste neben dem Fisch-Schatten.
- Ein **Richtungspfeil**, der zeigt, wohin der Fisch gerade zieht (links, rechts, unten).

**Regeln:**

| Größe | Formel / Regel |
|---|---|
| Spannung T steigt beim Kurbeln | `T += Rolle.Kurbelkraft × dt × 60` |
| Spannung T fällt beim Loslassen | `T -= Rute.Entlastung × dt × 60` |
| Zug des Fisches | `T += Fisch.Kraft × Musterfaktor(t) × (1 − Konterbonus) × dt × 10` |
| Konterbonus | 0,30, wenn die Rute **gegen** die Zugrichtung geführt wird, sonst 0 (Rutenführung) |
| Fortschritt | Liegt T in der grünen Zone, kommt der Fisch mit `Rolle.Einholtempo` näher. Unter der Zone nur zu 30 %, darüber zu 60 %, aber das ist riskant. |
| Ausdauer des Fisches | Sie sinkt, solange T in oder über der grünen Zone liegt (×1,5 bei Konter). Bei 0 ist der Fisch **erschöpft**: Er zieht nur noch schwach, und die grüne Zone wird 50 % breiter. |
| Schnurriss | T ≥ 100 % länger als `0,35 s + Schnur.Reserve` → Fisch weg, Köder weg. |
| Ausgeschlitzt | T < 5 % länger als 1,5 s → Der Fisch schüttelt den Haken ab. |
| Grüne Zone | Breite = `Rute.Flex (20–40 %) − Fisch.Kraft × 1,5 %`, mindestens 10 %. Bei schweren Fischen (Brocken) liegt sie höher. |
| Perfekter Drill | Nie rot, nie unter 5 % → ×1,2 Punkte, Funken-Effekt „Meisterdrill!“ |

**Drillgefühl:** Der Fisch-Schatten zappelt sichtbar im Wasser, die Rute biegt sich in 4 Stufen und die Rolle surrt bei Flucht des Fisches (Bremsgeräusch). Je höher die Spannung, desto höher klingt der Schnur-Sound. Im roten Bereich vibriert das Handy.

#### 1.7 Drill-Verhaltensarten

Jeder Fisch hat **ein Hauptverhalten** und eine **Kraft K (1–10)**. Die Ausdauer ergibt sich aus Seltenheit × Größe. Bosse kombinieren mehrere Verhalten in Phasen.

| Code | Verhalten | Was passiert | Vorwarnung (Telegraph) | Richtige Reaktion |
|---|---|---|---|---|
| `Ruhig` | **Ruhig** | gleichmäßiger Zug ohne Überraschungen | keine | Spannung in der Zone halten. Gut für Anfänger. |
| `Zappler` | **Zappler** | alle 0,5–1 s kurze Zugspitzen (+10–15 %) | Schatten zittert | in kurzen Stößen kurbeln, nicht durchhalten |
| `Sprinter` | **Sprinter** | lange Flucht zur Seite (1,5–3 s, +25 % Zug), Distanz wächst | Schatten dreht sich, Wasserstreifen | Kurbel loslassen, Rute gegenhalten, danach schnell einholen |
| `Taucher` | **Taucher** | zieht senkrecht nach unten, Distanz wächst stark | Blasen steigen auf | Rute hochreißen (W/Wisch hoch), mittlere Spannung |
| `Springer` | **Springer** | springt bis zu 1 s aus dem Wasser. Liegt T dabei über 40 %, schüttelt er den Haken ab | Wasser wölbt sich, Schatten steigt | während des Sprungs Kurbel loslassen. Danach ist er kurz erschöpft (Bonusfenster). |
| `Zickzack` | **Zickzack** | Richtungswechsel alle 0,6–1,2 s | Pfeil blinkt | Konter-Richtung schnell wechseln |
| `Brocken` | **Schwerer Brocken** | hoher Grundzug (+20 %), träge, viel Ausdauer, grüne Zone weit oben | keine | Geduld, dauerhaft hohe Spannung, nur kurze Pausen |
| `Trickser` | **Trickser** | tut, als sei er müde (Ausdauer-Anzeige sinkt), dann folgt eine riesige Flucht | ein einzelnes Flossenzucken 0,4 s vorher | nicht gierig werden, bei Anzeichen sofort loslassen |
| `Versteckspieler` | **Versteckspieler** | schwimmt zu Deckung (Seerose, Koralle, Fels). Erreicht er sie, gibt es einen **Hänger** | Schatten steuert auf Deckung zu, Deckung blinkt | Rute in die Gegenrichtung führen. Bei Hänger: 3× im Takt tippen zum Lösen. |
| `Aufblaeher` | **Aufbläher** | bläht sich alle 5–7 s für 3 s auf: doppeltes Gewicht, Einholen halbiert | Fisch wird rund, Quietsch-Sound | Spannung senken, warten, danach ist er erschöpft |
| `Stromer` | **Stromer** | Stromstoß: Konter-Steuerung 1,5 s **vertauscht**, Balken flackert | blaue Funken | kurz nichts tun oder bewusst umgekehrt steuern |
| `Blinker` | **Blinker** (Tiefsee/mystisch) | wird 2–3 s unsichtbar: Fisch-Symbol und Richtungspfeil verschwinden | Fisch wird durchsichtig, Glöckchen-Ton | nach Vibration und Ton spielen, Spannung mittig halten |
| `Hitzkopf` | **Hitzkopf** (Glutgrotte) | die Schnur heizt sich auf (Hitzeleiste). Hohe Spannung heizt doppelt. Bei 100 % Hitze reißt die Schnur. | Schnur glüht orange | Spannung kurz senken zum Abkühlen. Die Hitzeschild-Schnur halbiert die Hitze. |
| `Boss` | **Boss** | 3–4 Phasen aus den Mustern oben plus eine eigene Spezialattacke (siehe Welt) | Phasenwechsel mit Brüllen und Zoom | – |

**Ausdauer-Grundwerte** (Sekunden effektiver Drillzeit in der grünen Zone): Gewöhnlich 6 s, Ungewöhnlich 9 s, Selten 13 s, Episch 20 s, Legendär 45–70 s (Boss). Der Größenfaktor multipliziert sie mit 0,8–1,4.

#### 1.8 Ausrüstung & Upgrades

Vier Ausrüstungsplätze plus Zubehör. Jedes Teil hat Stufen. Die vollständigen Werte stehen in den RodData/LineData/ReelData/BaitData-Tabellen in Abschnitt 3.3 und 6.

| Platz | Beeinflusst | Besonderheit |
|---|---|---|
| **Rute** | Wurfweite, Perfekt-Wurf-Fenster, Flex (Breite der grünen Zone), Entlastung, Reaktion (Anschlagfenster) | Welt-Ruten (Belohnung für Sammlungen) haben eine Spezialfähigkeit |
| **Schnur** | Belastbarkeit (Reserve vor dem Riss), Unsichtbarkeit (Bissrate), Spezialschutz | **Pflicht-Schnüre:** Thermoschnur (Eismeer, gegen steife Schnur), Tiefsee-Kevlar (Druck ab 1.000 m), Hitzeschild-Schnur (Magmakammer). Das Stahlvorfach schützt vor Zahnfischen (Hecht, Barrakuda, Muräne: ohne Vorfach 15 % Bissabriss-Chance). |
| **Rolle** | Kurbelkraft, Einholtempo, Schnurkapazität (= max. Tiefe) | Die Tiefseewinde ist eine eigene Rollen-Linie für Welt 4 |
| **Köder** | welche Arten angelockt werden, Bissrate, Größenbonus, Schillernd-Chance | Verbrauchsgut (Stapel), Grundköder (Wurm) unendlich |
| **Zubehör** | Echolot (zeigt die Seltenheitsfarbe der Schatten), Köderlampe (Welt 4: Sichtradius), Kescher (rettet einmal pro Runde einen Fisch, der im letzten Moment ausschlitzt), Eispickel (Welt 3) | 1 Zubehör-Slot, ab Ruf-Stufe 10 zwei |

#### 1.9 Wetter & Tageszeit

**Tageszeit:** Ein Spieltag dauert 16 Minuten mit 4 Phasen zu je 4 Minuten: **Morgen → Tag → Abend → Nacht**. In Wettkampfrunden wählt der Host die Startphase oder „Zufall“. Im Himmel wandert Sonne bzw. Mond, und das Wasser färbt sich mit Paletten-Overlays (Morgenrosa, Mittagsklar, Abendgold, Nachtblau).

**Wetter:** Es wechselt alle 3–5 Minuten. Eine Vorhersage oben rechts zeigt den Wetterfrosch *Fridolin* mit dem Symbol für das nächste Wetter. In Wettkampfrunden kann der Host das Wetter fixieren.

| Wetter | Effekt |
|---|---|
| Sonnig | Oberflächenfische +30 %, Raubfische −20 %, klare Sicht |
| Bewölkt | Raubfische +20 %, keine Nachteile |
| Regen | Bissrate allgemein +15 %, Aale/Forellen/Lachse +50 %, Regentropfen-Ringe auf dem Wasser |
| Gewitter | Episch/Legendär-Chance ×2, Wind, Blitze erhellen kurz das Wasser (alle Schatten 0,5 s sichtbar, auch in Welt 4) |
| Nebel | Sicht auf Schatten −50 %, „mystische“ Fische +50 % |
| Schnee / Schneesturm (Eismeer) | Kälte: Ohne Thermoschnur wird die grüne Zone 20 % schmaler. Schneesturm: Wind ±15 %. |
| Weltspezifische Ereignisse | Vollmond, Flut/Ebbe, Korallenblüte, Polarlicht, Meeresschnee, Biolumineszenz-Welle, Schwarzer Raucher, Aschenregen, Ausbruch … (siehe Abschnitt 4) |

**Spawn-Formel** (der Host würfelt sie, siehe Teil B4):
```
Gewicht(Fisch) = Basis(Seltenheit)
               × Tiefen-Treffer (1 wenn Köder in [TiefeMin, TiefeMax], sonst 0)
               × Zonen-Treffer (1 / 0,3)
               × Zeitfaktor (1 wenn passende Tageszeit, sonst 0 – „Immer“ = 1)
               × Wetterfaktor (1,0 / bevorzugt 2,0 / Pflicht-Bedingung nicht erfüllt 0)
               × Köderfaktor (Lieblingsköder 2,0 / neutral 1,0 / mag-er-nicht 0,3)
               × Ereignisbonus
Basis: Gewöhnlich 100 · Ungewöhnlich 35 · Selten 12 · Episch 3 · Legendär 0,6
```
**Glücksschimmer (Pity):** Für jeden Fang ohne Selten oder besser steigt die Basis von Selten/Episch um +8 % (additiv, max. +80 %). Nach einem Selten-Fang setzt sie sich zurück. Das gilt pro Spieler.

#### 1.10 Größe & Gewicht

- Jede Art hat eine **Länge min–max in cm** (siehe Fischtabellen).
- Gewürfelt wird `x = clamp(Normal(μ = 0,45, σ = 0,18), 0, 1)`, dann `Länge = min + x × (max − min)`. Der Köder „Großköder“ und die Welt-Ruten verschieben μ um +0,05 bis +0,10.
- **Gewicht** = `k × Länge³`. Dabei ist `k` der Körperform-Faktor aus den Daten: schlank/aalartig 0,002–0,004, normal 0,010–0,013, hochrückig/rund 0,018–0,030, Bosse frei festgelegt.
- **Größenklassen** (nach x):

| Klasse | x-Bereich | Punktefaktor | Anzeige |
|---|---|---|---|
| Winzling | < 0,15 | ×0,8 | kleines „klein“-Etikett |
| Normal | 0,15–0,70 | ×1,0 | – |
| Prächtig | 0,70–0,88 | ×1,2 | silberner Rahmen |
| Kapital | 0,88–0,97 | ×1,35 | goldener Rahmen, Zoom-Effekt |
| Riesig | > 0,97 | ×1,5 | „RIESIG!“-Banner, Konfetti, Meldung an alle |

- Das Sprite wird in der Welt passend zur Größe **auf ganze Pixel skaliert** (Winzling −2 px Höhe, Riesig +1 Stufe Canvas-Zoom nur in der Fang-Präsentation, damit das Pixelraster sauber bleibt).
- Das Lexikon speichert pro Art die **Rekordlänge und das Rekordgewicht**, außerdem eine Freundes-Rekordtafel.

#### 1.11 „Schillernd“ (Shiny-Varianten)

- **Chance:** 1 : 250 pro Fang. Der Glücksköder macht daraus 1 : 125, ein vollständiges Weltabzeichen (Abschnitt 3.5) 1 : 200 in dieser Welt. Beides wirkt multiplikativ, die Grenze liegt bei 1 : 60.
- **Aussehen:** Palette-Swap (siehe Teil F, LUT-Shader) plus ein kleiner Glitzer-Partikelfunke alle 2 s und ein Regenbogen-Schimmer auf dem Rücken. Für jeden Fisch beschreibt die Fischtabelle die Schillernd-Palette.
- **Belohnung:** Punkte ×3, 1 **Perle** (Abschnitt 3.1), ein eigener Lexikon-Stern und eine Meldung an alle: „✦ Lea hat einen SCHILLERNDEN Hecht gefangen! ✦“.
- **Fairness:** Im Wettkampf zählt Schillernd ×3 nur bis maximal 600 Bonuspunkte pro Fang. So entscheidet reines Glück nicht allein über die Runde.

#### 1.12 Das Fischlexikon

- **100 Einträge** (Nr. 001–100), sortiert nach Welt und Seltenheit. Der Rahmen hat die Farbe der Seltenheit:
  - Gewöhnlich: Grau `#B0B7C3`
  - Ungewöhnlich: Grün `#5BD16B`
  - Selten: Blau `#3FA9F5`
  - Episch: Violett `#A86BFF`
  - Legendär: Gold `#FFC83D`
- **Nicht gefangen:** Man sieht nur eine schwarze Silhouette (automatisch aus der Alpha-Maske erzeugt, 1 px Outline in Seltenheitsfarbe) und „???“.
- **Gesichtet:** Hat man den Fisch im Drill verloren oder im Gewitterblitz gesehen, erscheint ein Hinweistext, z. B. „Man munkelt, er beißt nur bei Regen in der Nacht …“.
- **Gefangen:** Es zeigen sich Farbsprite, Name, Basis (echte Art oder „Fantasie“), Fundort, Tiefe, bevorzugte Zeit und Wetter, Lieblingsköder, Rekordgröße, Anzahl der Fänge und ein kurzer, witziger Lexikontext.
- **Sterne pro Art:**
  - ★ gefangen
  - ★★ 5× gefangen oder einmal „Kapital“
  - ★★★ „Riesig“ oder Schillernd gefangen
- **Weltfortschritt** als Kreis: 0/20 → 20/20. Meilensteine bringen Belohnungen (Abschnitt 3.5).

---

### 2. Wettkampfmodi, Punkteformel & Aufholregeln

#### 2.1 Lobby & Einstellungen

Der Host erstellt einen Raum (6-stelliger Code oder Link, siehe Teil B4) und legt fest:

| Einstellung | Optionen | Standard |
|---|---|---|
| Welt | alle Welten, die **irgendein** Spieler im Raum freigeschaltet hat. Die anderen spielen mit einem **Gast-Pass** (Fänge zählen fürs Lexikon, aber nicht für die Freischaltung). | zuletzt gespielte |
| Modus | siehe 2.2 | Wettangeln |
| Dauer | 3 / 5 / 8 Minuten | 5 |
| Ausrüstung | **Ausgeglichen** (alle Werte werden auf die Empfehlungsstufe der Welt gedeckelt) · **Eigene** (volle Ausrüstung) · **Leihausrüstung** (alle haben dasselbe Set) | Ausgeglichen |
| Schabernack-Items | An / Aus | An |
| Start-Tageszeit / Wetter | Zufall / fest | Zufall |
| Teams | Jeder gegen jeden / 2 gegen 2 | Jeder gegen jeden |

#### 2.2 Modi

##### A) Wettangeln *(Hauptmodus)*
- Zeitrunde (Standard 5 Min). **Punkte = Summe der Fangwerte** nach der Punkteformel (2.3).
- In der **Finalminute** (letzte 60 s) zählen alle Fänge ×1,5. Der Himmel wird golden und die Musik schneller.
- Wer am Ende die meisten Punkte hat, gewinnt. Bei Gleichstand gewinnt der schwerere Einzelfang.

##### B) Raritäten-Jagd
- Gewöhnliche Fische bringen **0 Punkte**, laden aber die **Jagdleiste** auf: Jeder gewöhnliche Fang erhöht die eigene Selten+-Chance in dieser Runde um +10 % (max. +50 %).
- Punktetabelle: Ungewöhnlich 1, Selten 3, Episch 6, Legendär 10, Schillernd +3.
- Wer zuerst **12 Raritäten-Punkte** hat oder nach Zeitablauf vorne liegt, gewinnt.
- In diesem Modus ist das Echolot für alle aktiv, damit man gezielt Schatten in Seltenheitsfarbe anwerfen kann.

##### C) Boss-Fisch-Duell
- Nach einer 90-s-Aufwärmphase (normales Angeln, Punkte = Boss-Bonus-Ladung) erscheint der **Boss der Welt**. Ein großer Schatten zieht durch die Tiefe, die Musik wechselt.
- **Alle Spieler haken den Boss gleichzeitig.** Jeder hat seinen eigenen Spannungsbalken, aber der Boss hat **eine gemeinsame Ausdauerleiste (Boss-HP)**.
- **Schaden** pro Sekunde = Zeit in der grünen Zone × Rutenkraft (im Ausgleichsmodus gleich) × Konterbonus.
- Der Boss greift in Phasen gezielt einzelne Schnüre an (z. B. „Barnabas springt auf Mias Schnur zu!“). Ein Schnurriss bedeutet 6 s Pause, danach hakt man wieder ein.
- **Wertung:**
  - Wer den meisten Schaden macht, ist der **Bezwinger** und bekommt den Lexikon-Eintrag mit Pokal.
  - Alle Beteiligten mit mindestens 10 % Schaden erhalten den Lexikon-Eintrag ebenfalls („gemeinsam gefangen“).
  - Münzen gibt es nach Schadensanteil.
- Entkommt der Boss (Zeitlimit 4 Min), bekommen alle die Hälfte der Münzen und der Boss gilt als „gesichtet“.

##### D) Kapitalfang
- 4 Minuten, **nur der schwerste Einzelfisch zählt.** Taktik: zwischen großen Gewöhnlichen und riskanten Selten abwägen.
- Live-Anzeige „Schwerster Fang“ mit Fisch-Sprite für jeden Spieler.

##### E) Fang-Bingo
- Jeder Spieler bekommt dieselbe **4×4-Bingokarte** mit Aufgaben. Beispiele:
  - „Ein Zappler“
  - „Ein Fisch über 2 kg“
  - „Etwas bei Regen“
  - „Ein Fisch aus der Kante“
  - „Ein Perfekter Drill“
  - „Ein Ungewöhnlicher“
- Wer zuerst eine Reihe hat, gewinnt. Bei „Volles Haus“ (Variante) gewinnt, wer zuerst die ganze Karte voll hat.

##### F) Team-Angeln (2 gegen 2)
- Wettangeln mit Teampunkten. Zusätzlich gibt es den **Teamkescher**: Hat dein Partner einen Fisch an der Leine, kannst du 1× pro Runde den Kescher halten. Der Fisch kann dann nicht mehr ausschlitzen, solange die Spannung unter 100 % bleibt.

##### G) Freies Angeln (ohne Wettkampf)
- Solo oder gemeinsam, ohne Timer. Die Hauptquelle für Münzen und Lexikon-Fortschritt.

#### 2.3 Punkteformel

```
Punkte = runden( B × G × S × Q × V × F )

B  Basispunkte der Art (Fischtabelle)
G  Größenfaktor: Winzling 0,8 · Normal 1,0 · Prächtig 1,2 · Kapital 1,35 · Riesig 1,5
S  Schillernd: 3 (Bonus gedeckelt auf +600) sonst 1
Q  Qualität: 1,0 + 0,2 (Meisterdrill) + 0,1 (Perfekter Wurf) + 0,05 (Perfekter Anschlag)  → max. 1,35
V  Vielfalt in dieser Runde:  1. Fang dieser Art ×1,25 · 2. ×1,0 · 3. ×0,85 · ab 4. ×0,7
F  Finale (letzte 60 s): 1,5  sonst 1,0
```

**Beispiel:** Ein Hecht (B = 120), Prächtig (1,2), Meisterdrill + Perfekter Wurf (Q = 1,3), erster Hecht der Runde (1,25), nicht im Finale: 120 × 1,2 × 1,3 × 1,25 = **234 Punkte**.

**Warum Vielfalt?** Ohne V würde man immer denselben Schwarmfisch an derselben Stelle angeln. V belohnt es, Tiefe und Köder zu wechseln, und macht das Lexikon im Wettkampf wichtig.

#### 2.4 Schabernack-Items (fair, aber witzig)

**Herkunft:** Auf dem Wasser treiben **Treibgut-Kisten** (alle 40–60 s eine pro Spielerbereich). Man angelt sie wie einen Fisch mit Ruhig-Verhalten (K1, Drill 2 s). Man trägt **maximal 1 Item**.

| Item | Typ | Wirkung | Gegenmittel / Fairness |
|---|---|---|---|
| **Stinkesocke** | Sabotage | Wird in den Bereich eines Gegners geworfen. Dort sinkt die Bissrate 8 s lang um −50 %. Eine grüne Stinkwolke ist sichtbar. | Köder in eine andere Zone werfen |
| **Möwe Mops** | Sabotage | Eine Möwe klaut den Köder des Gegners, **nur wenn noch kein Fisch beißt**. Er muss neu werfen. | wirkungslos, sobald ein Fisch am Haken ist |
| **Tintenklecks** | Sabotage | Ein Tintenfisch spritzt auf das HUD des Gegners: Die Mitte des Spannungsbalkens ist 3 s verdeckt. Ränder, Ton und Vibration bleiben. | nach Gefühl und Ton spielen |
| **Krabbe Kniep** | Sabotage | zwickt die Schnur eines Gegners im Drill: einmalig +15 % Spannung | höchstens 1× pro Drill pro Opfer |
| **Wellenmacher** | Sabotage | Das Boot des Gegners schaukelt 10 s, sein Wurfkraft-Balken läuft 30 % schneller. | warten oder trotzdem werfen |
| **Lockfutter** | Selbst | eigene Bissrate +40 % für 10 s | – |
| **Goldhaken** | Selbst | nächster Fang ×1,5 Punkte | gilt nicht für Bosse |
| **Turbokurbel** | Selbst | Einholtempo +30 % für 12 s | – |
| **Regenschirm** | Schutz | blockt das nächste Sabotage-Item und wirft es auf den Absender zurück | wird angezeigt, damit man weiß, wen man nicht angreifen sollte |

**Fairness-Regeln:**
1. **Schutzaura:** Wer einen Episch- oder Legendär-Fisch oder den Boss im Drill hat, kann nicht sabotiert werden (goldener Schimmer um das Boot).
2. **Abklingzeit pro Opfer:** Dasselbe Opfer kann frühestens nach 20 s wieder getroffen werden.
3. **Vorwarnung:** 1 s vor dem Treffer erscheint beim Opfer ein Symbol mit dem Absender. Sabotage ist nie unsichtbar.
4. **Item-Verteilung nach Platzierung** (Mario-Kart-Prinzip):
   - Erster: 60 % Selbst-Items, 30 % harmlose Sabotage, 10 % Regenschirm
   - Letzter: 40 % starke Selbst-Items (Goldhaken, Lockfutter), 40 % Sabotage, 20 % Regenschirm
5. **Kein Item kann einen Fisch direkt stehlen** oder Punkte abziehen. Man kann nur stören.
6. Im Modus Boss-Fisch-Duell gibt es keine Sabotage-Items.

#### 2.5 Aufholregeln (Anti-Frust)

| Regel | Wirkung |
|---|---|
| **Rückenwind** | Wer mehr als 25 % hinter dem Ersten liegt, bekommt +15 % Bissrate und 1 Zupfer weniger vor dem Biss (der Biss kommt schneller). Ab 50 % Rückstand sind es +25 %. Im HUD steht ein kleines Segel-Symbol, nicht als „Mitleid“ beschriftet. |
| **Finalminute ×1,5** | Ein guter Fang am Ende kann die Runde noch drehen. |
| **Verdeckte Punkte** | Die letzten 30 s zeigen nur „???“ statt des Punktestands. Das hält die Spannung hoch, und niemand gibt vorzeitig auf. |
| **Vielfaltsbonus** | Wer hinten liegt, kann mit neuen Arten aufholen. Der Führende hat oft schon die „leichten“ Arten. |
| **Anfängerschutz** | Bis Ruf-Stufe 5 werden die ersten 2 Schnurrisse pro Runde zu einer Warnung: Der Fisch bleibt mit 30 % Spannung am Haken. |
| **Stufenausgleich** | Im Standardmodus „Ausgeglichen“ entscheidet Können, nicht Ausrüstung. |
| **Trostpreise** | Jeder Platz bekommt Münzen (2.6), dazu kommen Sonderauszeichnungen. |
| **Item-Verteilung** | siehe 2.4, Hintere bekommen bessere Items. |
| **Pity (Glücksschimmer)** | siehe 1.9, ein Pech-Zähler pro Spieler |

**Sonderauszeichnungen nach jeder Runde** (je +50 Münzen, die Aufzählung zeigt sie mit Fisch-Icons):
- *Schwerster Brocken*: der schwerste Fisch
- *Sammler*: die meisten verschiedenen Arten
- *Meisterdrill*: die meisten perfekten Drills
- *Pechvogel des Tages*: die meisten Schnurrisse (lustig gemeint)
- *Schabernack-König*: die meisten Item-Treffer

#### 2.6 Rundenbelohnungen (Münzen)

`Belohnung = Weltfaktor × Platzbasis + 10 % der eigenen Rundenpunkte`

| Platz | Platzbasis |
|---|---|
| 1. | 200 |
| 2. | 150 |
| 3. | 120 |
| 4. | 100 |

Weltfaktor: Welt 1 = 1,0 · W2 = 1,5 · W3 = 2,0 · W4 = 2,6 · W5 = 3,2.
Im Wettkampf werden gefangene Fische **nicht zusätzlich verkauft**, sie wandern ins Lexikon und optional ins Aquarium. Sonst wäre der Münzgewinn aus Wettkampfrunden zu hoch.

---

### 3. Fortschritt & Wirtschaft

#### 3.1 Währungen & Werte

| Wert | Wofür | Woher | Hinweise |
|---|---|---|---|
| **Münzen** | Ausrüstung, Köder, Tickets, Kosmetik | Fische verkaufen (Freies Angeln), Rundenbelohnungen, Tagesaufträge, Sammlungs-Meilensteine | Hauptwährung |
| **Perlen** | Glücksköder, besondere Kosmetik, Aquarium-Erweiterungen | Schillernde Fänge (1), Bosse (1 je Bezwingung, 1× pro Tag), komplette Weltsammlung (3), Wochenauftrag (1) | **Nur erspielbar.** Kein Echtgeld-Kauf. |
| **Ruf (XP)** | Stufen 1–50: schalten Shop-Gegenstände und Zubehör-Slots frei, wichtig für Weltfreischaltung | jeder Fang: Gewöhnlich 5 · Ungewöhnlich 12 · Selten 30 · Episch 80 · Legendär 250. Neue Art ×2. Runde gespielt +20, Sieg +40 | Stufe n braucht `100 × n^1,4` XP |

**Grundsatz Jugendschutz & Fairness:** keine Lootboxen, keine Glücksspiel-Mechanik gegen Echtgeld, kein Pay-to-Win. Falls das Spiel je Geld kosten soll, dann nur über direkt sichtbare kosmetische Käufe. Die USK berücksichtigt In-Game-Käufe und Lootboxen bei der Alterseinstufung. Treibgut-Kisten enthalten deshalb nur Rundenitems ohne Dauerwert.

#### 3.2 Münzfluss (Freies Angeln)

- **Verkaufspreis** eines Fisches = `Basispunkte × Größenfaktor` (Schillernd ×3). Der Verkauf läuft über den Fangeimer, mit Knopf „Alles verkaufen“ oder einzeln. Fische fürs Aquarium behalten.
- **Zielwerte** für das Einkommen eines geübten Spielers pro Minute:

| Welt | Münzen/Min (Freies Angeln) | Erwartete Spielzeit bis zur nächsten Welt | Bis 20/20 in der Welt |
|---|---|---|---|
| 1 Sonnenspiegelsee | 60–90 | ca. 1 h | ca. 3 h |
| 2 Regenbogenriff | 120–160 | ca. 1,5 h | ca. 4 h |
| 3 Frostfjord | 190–250 | ca. 2 h | ca. 5 h |
| 4 Leuchtende Tiefe | 290–370 | ca. 2,5 h | ca. 6 h |
| 5 Glutgrotte | 400–500 | – | ca. 7 h |

Gesamtziel: **ca. 10 h bis Welt 5, ca. 25–30 h bis 100/100.** Schillernd-Komplettierung ist das Langzeit-Ziel.

**Münz-Abflüsse:** Ausrüstung (Hauptteil), Verbrauchsköder (ca. 10–15 % des Einkommens), Tickets, Kosmetik und Aquarium-Deko als Langzeit-Senke.

#### 3.3 Opa Ottos Angelladen (Shop)

Opa Otto ist ein grummeliger, aber herzlicher alter Seebär mit gelbem Friesennerz und Pfeife (Seifenblasen statt Rauch). Er kommentiert Fänge: „Na, den hätte ich 1974 mit bloßen Händen gefangen!“

##### Ruten

| ID | Name | Stufe | Preis | Ruf | Max. Wurfweite | Perfekt-Fenster | Flex (grüne Zone) | Entlastung | Reaktion | Spezial |
|---|---|---|---|---|---|---|---|---|---|---|
| R01 | Opas Bambusrute | 1 | Start | 1 | 20 m | 92–100 % | 26 % | 1,0 | +0,00 s | – |
| R02 | Glasfaser-Flitzer | 2 | 600 | 3 | 28 m | 91–100 % | 29 % | 1,1 | +0,05 s | – |
| R03 | Karbon-Kracher | 3 | 2.500 | 8 | 36 m | 90–100 % | 32 % | 1,2 | +0,10 s | – |
| R04 | Titan-Tiefgang | 4 | 8.000 | 15 | 44 m | 89–100 % | 35 % | 1,3 | +0,15 s | Konter gegen Taucher +10 % |
| R05 | Sturmbrecher | 5 | 20.000 | 25 | 52 m | 88–100 % | 38 % | 1,4 | +0,20 s | Wind wirkt nicht |
| R06 | Neptun-Meisterrute | 6 | 50.000 | 35 | 60 m | 86–100 % | 40 % | 1,5 | +0,25 s | Konterbonus 0,35 statt 0,30 |
| RW1 | Seerosenrute | 3* | Belohnung W1 20/20 | – | 36 m | 90–100 % | 33 % | 1,2 | +0,10 s | Hänger lösen sich mit 1 Tipp. Größen-μ +0,05 in W1. |
| RW2 | Korallenrute | 4* | Belohnung W2 20/20 | – | 44 m | 89–100 % | 36 % | 1,3 | +0,15 s | Strömung wirkt nur halb |
| RW3 | Frostzahn-Rute | 4* | Belohnung W3 20/20 | – | 46 m | 89–100 % | 36 % | 1,3 | +0,15 s | immun gegen Kälte, Eislöcher frieren 50 % langsamer |
| RW4 | Laternenrute | 5* | Belohnung W4 20/20 | – | 52 m | 88–100 % | 38 % | 1,4 | +0,20 s | Köderlampe +1 Stufe, Blinker bleiben halb sichtbar |
| RW5 | Glutrute | 5* | Belohnung W5 20/20 | – | 54 m | 88–100 % | 39 % | 1,4 | +0,20 s | Hitze −30 % |
| RG | Goldene Rute des Köderkönigs | 6* | Belohnung 100/100 | – | 60 m | 86–100 % | 41 % | 1,5 | +0,25 s | Schillernd-Chance 1 : 200 überall, goldene Schnurpartikel |

\* Im Modus „Ausgeglichen“ werden auch Welt-Ruten auf die Empfehlungsstufe gedeckelt. Ihre Spezialfähigkeit bleibt aktiv, wenn sie **nur gegen die Welt** wirkt (Strömung, Kälte), nicht gegen Mitspieler.

##### Schnüre
Jede Spezialschnur enthält alle Schutzwirkungen der Schnüre darüber in der Tabelle. Man muss also nicht ständig wechseln.

| ID | Name | Preis | Ruf | Reserve vor Riss | Bissrate | Schutz |
|---|---|---|---|---|---|---|
| L01 | Monofile Schnur | Start | 1 | +0,00 s | ±0 | – |
| L02 | Geflochtene Schnur | 400 | 2 | +0,15 s | ±0 | – |
| L03 | Fluorocarbon „Geisterfaden“ | 1.500 | 6 | +0,10 s | +10 % (fast unsichtbar) | – |
| L04 | Thermoschnur | 4.000 | 12 | +0,20 s | +10 % | Kälte (Frostfjord) |
| L05 | Tiefsee-Kevlar | 8.000 | 20 | +0,25 s | +10 % | Kälte, Druck (bis 11.000 m) |
| L06 | Hitzeschild-Schnur | 22.000 | 30 | +0,30 s | +10 % | Kälte, Druck, Hitze ×0,5 |
| Z-V | **Stahlvorfach** (Aufsatz, einmal kaufen, an/aus) | 900 | 5 | – | −5 % bei scheuen Fischen | Zahnfische können die Schnur nicht durchbeißen (ohne Vorfach 15 % Abbiss-Chance bei Hecht, Barrakuda, Muränen, Viperfisch, Koboldhai …) |

##### Rollen

| ID | Name | Preis | Ruf | Kurbelkraft | Einholtempo | Schnurkapazität (max. Tiefe) |
|---|---|---|---|---|---|---|
| RO1 | Klapperrolle | Start | 1 | 1,0 | 1,0 | 25 m |
| RO2 | Freilauf-Rolle „Surri“ | 500 | 2 | 1,1 | 1,1 | 40 m |
| RO3 | Stationärrolle Profi | 2.000 | 7 | 1,2 | 1,2 | 60 m |
| RO4 | Multirolle „Orca“ | 7.000 | 14 | 1,3 | 1,3 | 80 m |
| RO5 | Tiefseewinde Mk I | 10.000 | 20 | 1,3 | 1,2 | 2.000 m (in anderen Welten 80 m) |
| RO6 | Tiefseewinde Mk II | 22.000 | 25 | 1,4 | 1,3 | 6.000 m |
| RO7 | Tiefseewinde Mk III | 40.000 | 30 | 1,5 | 1,4 | 11.000 m |
| RO8 | Drachenrolle | 55.000 | 35 | 1,6 | 1,5 | 80 m (in Welt 4 wie Mk III) |

##### Köder

| ID | Name | Packung / Preis | Wirkt auf | Effekt |
|---|---|---|---|---|
| K01 | Regenwurm | unendlich | Allrounder W1–W2 | neutral |
| K02 | Maden | 10 St. / 50 | kleine Friedfische W1 | Gewöhnlich +30 % |
| K03 | Brotflocke | 10 St. / 40 | Karpfen, Rotfeder, Koi | Mit „Füttern“ kann man einen **Futterplatz** werfen (W1): 30 s Friedfische +50 %. |
| K04 | Blinker (Kunstköder) | dauerhaft / 300 | Raubfische | Zucken-Bonus ×1,5 |
| K05 | Wobbler | dauerhaft / 800 | Hecht, Zander, Barrakuda, Lachs | taucht beim Einholen 2 m tiefer, Raubfische +40 % |
| K06 | Garnele | 10 St. / 120 | Riff, Eismeer | Riff-Fische +40 % |
| K07 | Tintenfischstück | 10 St. / 200 | Räuber Riff/Eis/Tiefsee | Selten +20 % in W2–W4 |
| K08 | Krillball | 10 St. / 250 | Schwarmfische W3 | Bissrate +25 % in W3 |
| K09 | Leuchtköder | 5 St. / 400 | Tiefsee | weit sichtbar in der Dunkelheit, Leuchtfische +50 % |
| K10 | Glutwurm | 5 St. / 500 | Glutgrotte | hitzefest, Glut-Fische +50 % |
| K11 | Kristallköder | 3 St. / 800 | Kristallhöhlen W5 | Kristall-Arten +80 % |
| K12 | Großköder | 5 St. / 600 | alle | Größen-μ +0,08, Gewöhnliche −50 % |
| K13 | Glücksköder | 3 St. / 2 Perlen | alle | Schillernd-Chance ×2 |
| K14 | Bosslocker (je Welt) | 1 St. / 1 Perle + 800 × Weltfaktor | Boss der Welt | Im Freien Angeln erscheint der Boss garantiert, wenn seine Bedingungen erfüllt sind (sonst Hinweis: „Barnabas schläft. Komm bei Gewitter wieder.“). Wird ab 15/20 Arten der Welt verkauft. |

##### Zubehör (1 Slot, ab Ruf 10 zwei)

| Name | Preis | Wirkung |
|---|---|---|
| Kescher | 1.500 | rettet 1× pro Runde einen Fisch, der im letzten Moment ausschlitzt |
| Echolot | 3.000 | Schatten zeigen einen Rand in Seltenheitsfarbe |
| Wetterradio | 2.000 | zeigt die nächsten 2 Wetterwechsel |
| Futterkelle | 1.200 | Futterplatz in jeder Welt (mit passendem Köder) |
| Eispickel | 800 | Eislöcher mit 1 statt 3 Tipps freihacken (W3) |
| Köderlampe I–IV | 3.000 / 8.000 / 15.000 / 30.000 | Lichtradius in W4: 32 / 48 / 64 / 96 px |

##### Kosmetik
- **Boote/Plätze:** Ruderboot (Start), Schwanen-Tretboot, Riesen-Gummiente, Mini-Katamaran, Eisbrecher-Kutter, Forschungsgondel, Basaltfloß, Goldene Galeone (100/100)
- **Hüte:** Anglerhut, Strohhut, Kapitänsmütze, Bommelmütze, Taucherhelm, Drachenhörner, Köderkönig-Krone
- **Posen:** Klassisch rot-weiß, Erdbeere, Mini-Ente, Pinguin, Leuchtqualle, Lavatropfen
- **Schnurfarben** und **Fang-Jubel:** Fisch hochhalten, Tänzchen, Fisch-Selfie, Muskeln zeigen, Fisch knuddeln
- **Aquarium-Deko:** Pflanzen, Schatztruhe, versunkenes Schiff, Mini-Vulkan

#### 3.4 Welten freischalten

| Welt | Voraussetzung | Ticket | Pflichtausrüstung | Empfehlungsstufe (Ausgleich) |
|---|---|---|---|---|
| 1 Sonnenspiegelsee | Start | – | – | Stufe 1–2 |
| 2 Regenbogenriff | 12/20 Arten aus W1 **und** (Barnabas bezwungen **oder** 16/20 Arten) · Ruf 6 | 1.500 | – | Stufe 2–3 |
| 3 Frostfjord | 12/20 aus W2 und (Coralina **oder** 16/20) · Ruf 12 | 4.000 | Thermoschnur | Stufe 3–4 |
| 4 Leuchtende Tiefe | 12/20 aus W3 und (Grimmbart **oder** 16/20) · Ruf 20 | 9.000 | Tiefseewinde Mk I, Tiefsee-Kevlar, Köderlampe I | Stufe 4–5 |
| 5 Glutgrotte | 12/20 aus W4 und (Lumina **oder** 16/20) · Ruf 30 | 18.000 | Hitzeschild-Schnur (Pflicht unter 40 m, Thermalbecken bis 40 m geht ohne) | Stufe 5–6 |

Das „oder“ beim Boss ist eine Anti-Frust-Regel: Wer Bosse zu schwer findet, kommt durch fleißiges Sammeln trotzdem weiter.
**Gast-Pass:** Mit Freunden, die weiter sind, kann man jede Welt besuchen (siehe 2.1). Die Neugier auf die nächste Welt entsteht so ganz natürlich.

#### 3.5 Sammlungsbelohnungen

**Pro Welt** (Weltfaktor wie in 2.6):

| Meilenstein | Belohnung |
|---|---|
| 5/20 | 500 × Weltfaktor Münzen + Posen-Design der Welt |
| 10/20 | Welt-Spezialköder im Shop freigeschaltet + Hut der Welt |
| 15/20 | Bosslocker im Shop + Aquarium-Deko der Welt + 1 Perle |
| 20/20 | **Welt-Rute** (RW1–RW5) + **Welt-Abzeichen** (Schillernd-Chance 1 : 200 in dieser Welt) + Titel + 3 Perlen |
| alle 20 Schillernd | goldener Lexikonrahmen der Welt + Boot-Skin in Schillernd-Optik |

**Welttitel:** W1 *Seeflüsterer/in* · W2 *Riffkenner/in* · W3 *Frostbrecher/in* · W4 *Tiefseeforscher/in* · W5 *Glutbändiger/in*

**Gesamt:**
- 50/100: Aquarium-Erweiterung (große Halle)
- 75/100: Bootskin „Goldene Galeone“ (Rohbau, wird bei 100 golden)
- 100/100: **Goldene Rute des Köderkönigs**, Titel **Köderkönig/Köderkönigin**, Kronen-Hut und eine Statue im Möwenhafen mit dem Spielernamen. Freunde sehen sie, wenn sie den Hafen des Spielers besuchen.

#### 3.6 Tages- und Wochenaufträge (Anschlagtafel)

- **3 Tagesaufträge** (je 150–400 × Weltfaktor Münzen + 30 XP). Beispiele:
  - „Fange 3 Zappler“
  - „Fange einen Fisch bei Regen“
  - „Schaffe 2 perfekte Drills hintereinander“
  - „Spiele eine Runde Fang-Bingo mit Freunden“
  - „Fange einen Prächtigen oder größeren Fisch“
- **1 Wochenauftrag** (1 Perle). Beispiele:
  - „Fange 5 Seltene“
  - „Bezwinge einen Boss im Duell“
  - „Gewinne 3 Wettangel-Runden“
- **Kein Streak-Zwang:** Verpasste Tage verfallen ohne Strafe. Bis zu 3 Tagesaufträge bleiben gespeichert.

#### 3.7 Treibgut & Kurioses (nicht im Lexikon der 100, aber in einer eigenen „Fundstücke“-Seite)

Etwa 4 % aller Bisse sind kein Fisch. Fundstücke bringen kleine Münzbeträge und Lacher.
- **Alter Stiefel** (W1, 1 Münze): „Hat jemand seinen Stiefel vermisst?“
- **Rostiges Fahrrad** (W1)
- **Flaschenpost**: Sie enthält Hinweise auf seltene Fische wie „Der alte Barnabas mag Gewitter …“ (alle Welten).
- **Schatzkiste**: 100–500 × Weltfaktor Münzen
- **Kokosnuss** (W2)
- **Wikingerhelm** (W3), wird zum Hut
- **Gesunkene Tiefseesonde** (W4)
- **Drachenei-Splitter** (W5, 10 Stück ergeben Kosmetik „Drachen-Pose“)

---

## TEIL E – DIE 5 WELTEN UND ALLE 100 FISCHE

### 4. Die 5 Welten

**Gemeinsame Bildregeln:**
- Oberes Drittel: Himmel, Ufer, Steg und Boote der Spieler
- Untere zwei Drittel: Wasser-Querschnitt mit 4 Tiefenschichten. Beim tiefen Sinken scrollt die Kamera mit dem Köder nach unten.
- Jede Welt hat eine eigene Palette (24–32 Farben laut Teil F). Die Hex-Werte unten sind die **Leitfarben**, aus denen die Rampen gebaut werden.
- Jede Welt hat einen eindeutigen **Umriss-Charakter**, damit man sie selbst als Thumbnail sofort erkennt: runde Seerosen, verzweigte Korallen, kantiges Eis, organische Leuchtpunkte im Schwarzen, gezackte Basaltsäulen.

#### Welt 1 – Sonnenspiegelsee

| | |
|---|---|
| **Thema** | sommerlicher Badesee in Mitteleuropa: Holzsteg mit Bootshaus, Ruderboote, Schilfgürtel, Seerosenfelder. Im Hintergrund Mischwald, Grillhütte und ein Kirchturm. Das ist die gemütliche Einsteigerwelt. |
| **Spielerplätze** | 2 am Steg, 2 in Ruderbooten (feste Plätze, nebeneinander) |
| **Stimmung** | Ferien, warmes Licht, Leichtigkeit |
| **Musik** | Akustikgitarre, Ukulele, Glockenspiel, leise Shaker, 90 BPM, fröhlich-entspannt. **Nacht:** E-Piano und Grillenzirpen. **Gewitter:** tiefe Streicher und Pauken-Grollen. **Boss:** Folk-Rock mit Banjo und Fiddle. |

**Palette (Leitfarben):**

| Farbe | Hex | Einsatz |
|---|---|---|
| Himmelblau | `#8FD3F4` | Himmel, Wasserspiegel-Reflexe |
| Seetürkis | `#3FA7A3` | Oberflächenwasser |
| Tiefgrün | `#1E5F5B` | Freiwasser/Krautfeld |
| Grundschatten | `#12342F` | Tiefes Loch, Schatten |
| Schilfgrün | `#6BA34A` | Schilf, Wasserpflanzen, Wald |
| Stegholz | `#8A5A33` | Steg, Boote, Wurzeln |
| Seerosenrosa | `#F4A6C1` | Blüten, Akzente |
| Sonnengelb | `#FFE066` | Sonne, Lichtstrahlen, Highlights |

**Tiefenschichten:**

| Schicht | Tiefe | Aussehen |
|---|---|---|
| Uferzone | 0–3 m | Seerosenblätter an der Oberfläche, Schilfhalme als Vordergrund, Kaulquappen, Lichtflecken auf dem Sand |
| Freiwasser | 3–8 m | schräge Sonnenstrahlen (Godrays, 2×2-Bayer-Dither), Schwebeteilchen |
| Krautfeld | 8–15 m | wogende Wasserpest. Ein versunkener Einkaufswagen und ein Fahrrad (Easter Egg) liegen dort. |
| Tiefes Loch | 15–25 m | dunkler Trichter, versunkenes Ruderboot, mächtiger Wurzelstock, alte Angelhaken in Holz |

**Umgebungsleben (nicht fangbar):**
- Libellen über dem Wasser, Wasserläufer
- Stockenten (paddeln, gründeln: Popo nach oben), Frösche auf Seerosen (quaken bei Regen)
- Schwalben am Abend, Glühwürmchen nachts, ein Reiher am Ufer, Kaulquappen-Schwärme

**Spezialmechanik – Hänger & Futterplatz:**
- *Hänger:* In der Uferzone und im Krautfeld kann sich der Köder an Seerosenstielen oder Kraut verhaken (8 % pro Wurf dort). Lösen: 3× im Takt tippen. Fehlschlag kostet den Köder. Versteckspieler ziehen gezielt hierhin.
- *Futterplatz:* Mit Brotflocke kann man „Füttern“ wählen. Dann entsteht 30 s lang eine sichtbare Krümelwolke mit Friedfischen +50 %. Das ist die perfekte Einsteiger-Taktik und im Wettkampf ein kleiner taktischer Kniff.

**Wetter:** Sonnig 40 % · Bewölkt 25 % · Regen 20 % · Gewitter 10 % · Morgennebel 5 % (nur morgens)
**Ereignisse:**
- *Vollmond* (jede 3. Nacht): Episch +50 %, Mondlicht-Säule auf dem Wasser
- *Sommergewitter*: Barnabas-Bedingung, Blitz-Silhouetten
- *Mückenschwarm am Abend*: Oberflächenfische springen nach Insekten, Ukelei und Rotfeder +50 %

**Boss: Der Alte Barnabas** (Riesenhecht, Nr. 020)
- **Erscheint:** Tiefes Loch, 15–25 m, nur bei Gewitter oder Vollmondnacht
- **Phase 1 – „Kraftprobe“** (100–70 % HP): Sprinter-Fluchten nach links und rechts, K7
- **Phase 2 – „Ab ins Kraut“** (70–40 %): Er zieht ins Krautfeld (Versteckspieler). Jeder Spieler, dessen Schnur dabei hängen bleibt, muss sich freitippen.
- **Phase 3 – „Wutsprung“** (40–0 %): 3 Sprünge in Folge (Springer). Bei Gewitter schlägt bei jedem Sprung ein Blitz ein und das Bild wird kurz weiß. Danach gibt es ein 3-s-Erschöpfungsfenster mit doppeltem Schaden.

**Schillernd-Regel W1:** „Mondlicht“, also warme Grundfarben zu Silber-Lavendel mit hellblauen Akzenten.

---

#### Welt 2 – Regenbogenriff

| | |
|---|---|
| **Thema** | tropisches Atoll: Holzsteg zu einer Strandhütte, Palmen, Hängematte, Katamarane. Unter Wasser liegt ein farbenfrohes Korallenriff. Die Riffkante fällt in tiefes Blau ab, Sonnenkringel tanzen auf dem Sand. |
| **Spielerplätze** | Steg und kleine Katamarane |
| **Stimmung** | Urlaub, Farbe, Leben |
| **Musik** | Steel Drums, Marimba, Bongos, Ukulele, 105 BPM, sonnig und tanzbar. **Nacht:** Kalimba und warme Pads. **Flut:** Wellenrauschen im Takt. **Boss:** Calypso-Orchester mit Bläsern. |

**Palette (Leitfarben):**

| Farbe | Hex | Einsatz |
|---|---|---|
| Lagunentürkis | `#2EC4B6` | Lagune, Oberflächenwasser |
| Tiefblau | `#0B4F8A` | Riffkante |
| Abgrundblau | `#06264A` | Blauwasser-Tiefe |
| Korallenrot | `#FF6F59` | Korallen, Akzente |
| Anemonenpink | `#FF9EC7` | Anemonen, Weichkorallen |
| Tropengelb | `#FFD23F` | Fische, Sonnenlicht |
| Seeigelviolett | `#7B2CBF` | Seeigel, Schatten in Korallen |
| Sandbeige | `#F7E3AF` | Strand, Sandgrund |

**Tiefenschichten:**

| Schicht | Tiefe | Aussehen |
|---|---|---|
| Lagune | 0–5 m | heller Sand, Seegras, Anemonen, Sonnenkringel (animierte Caustics) |
| Riffdach | 5–15 m | Hirnkorallen, Geweihkorallen, Fächer, Höhlen |
| Riffkante | 15–30 m | senkrechte Wand mit Schwämmen und Gorgonien, Überhänge |
| Blauwasser | 30–50 m | fast leeres tiefes Blau, große Schatten ziehen vorbei |

**Umgebungsleben:**
- Meeresschildkröten, Quallen (Ohrenqualle, sanft pulsierend)
- Seesterne, Einsiedlerkrebse am Strand, Fregattvögel
- Delfine springen im Hintergrund
- Kleinfischschwärme, die dem Köder ausweichen (Boids, nur Deko)

**Spezialmechanik – Strömung & Gezeiten:**
- *Strömung:* Ein Pfeil im HUD zeigt Richtung und Stärke (0–3). Der Köder driftet pro Sekunde `Stärke × 0,5 m` zur Seite und kann aus der Wunschzone wandern. Gegenmittel: schwererer Köder, Korallenrute oder einfach nachjustieren.
- *Gezeiten:* Ebbe und Flut wechseln alle 4 Minuten.
  - **Flut:** Der Wasserspiegel steigt um 1 m, Lagunenfische +30 %, Kante leichter erreichbar (Wurfweite +10 %).
  - **Ebbe:** Gezeitentümpel am Strand werden zu einer kleinen Extra-Zone mit Kleinfischen (Gewöhnliche +50 %). Die Riffkante ist schwerer erreichbar.
- *Korallenhöhlen:* Versteckspieler sind hier stärker. Die Deckung ist näher.

**Wetter:** Sonnig 50 % · Bewölkt 20 % · Tropenschauer 20 % · Gewitter 10 %
**Ereignisse:**
- *Flut/Ebbe* (zyklisch)
- *Vollmond*
- *Korallenblüte* (seltene Vollmondnacht, 1 von 3 Vollmonden): rosa Laichpartikel steigen auf wie Schnee nach oben, Episch ×2. Bedingung für den Korallendrachen.
- *Delfin-Besuch*: Delfine treiben einen Schwarm zusammen, 20 s Gewöhnliche ×3.

**Boss: Kaiserin Coralina** (Regenbogen-Manta, Nr. 040)
- **Erscheint:** Blauwasser, 30–50 m, Vollmondnacht oder Flut bei Sonnenuntergang (Abend)
- **Phase 1 – „Gleitflug“** (100–75 %): ruhiger, aber sehr schwerer Zug (Brocken, K8)
- **Phase 2 – „Strömungswirbel“** (75–50 %): Sie erzeugt einen Strudel, die Strömung springt auf Stärke 3 und dreht alle 2 s (Zickzack).
- **Phase 3 – „Lichtshow“** (50–25 %): Wellenmuster laufen über ihren Rücken. Die grüne Zone **wandert** langsam über den Balken, die Spieler müssen folgen.
- **Phase 4 – „Salto“** (25–0 %): Sie springt aus dem Wasser und macht einen Rückwärtssalto (Springer). Alle müssen gleichzeitig loslassen. Wer zu fest hält, verliert 10 % Schadensanteil (keine Schnurriss-Strafe).

**Schillernd-Regel W2:** „Neon“, also Farben gesättigter, mit invertierten Akzentfarben (Gelb ↔ Blau, Pink ↔ Grün).

---

#### Welt 3 – Frostfjord

| | |
|---|---|
| **Thema** | arktischer Fjord (die Spielwelt vereint Arktis und Antarktis): Die Spieler stehen auf einer Eisfläche an gebohrten Eislöchern. Dazu kommen eine kleine Holzhütte mit rauchendem Schornstein, ein eingefrorener Fischkutter, blau schimmernde Gletscherwände und Polarlichter. |
| **Spielerplätze** | Jeder Spieler hat **2 Eislöcher** (links/rechts) zur Wahl. Der Wurf ist hier ein **Absenken**: Der Wurfkraft-Balken bestimmt die Start-Sinkgeschwindigkeit, ein perfekter Wurf gibt den Bonus wie gewohnt. Zusätzlich gibt es einen offenen Fjordrand mit dem Kutter (weite Würfe). |
| **Stimmung** | still, majestätisch, staunend |
| **Musik** | Celesta, Glasharfe, gehauchter Chor („Aah“), tiefe Celli, Windglocken, 70 BPM, ruhig und majestätisch. **Polarlicht:** schimmernde Synth-Arpeggios. **Schneesturm:** Wind-Rauschen und dumpfe Trommel. **Boss:** nordisch-episch mit Hörnern, Chor und Kriegstrommeln. |

**Palette (Leitfarben):**

| Farbe | Hex | Einsatz |
|---|---|---|
| Schneeweiß | `#EAF6FF` | Schnee, Eis-Lichter (kein Reinweiß) |
| Frostblau | `#A9D6F5` | Eisflächen, Himmel am Tag |
| Gletscherblau | `#4F9DDE` | Gletscher, flaches Wasser |
| Polarnacht | `#12355B` | Nachthimmel, mittlere Tiefe |
| Fjordschwarzblau | `#0A1A2F` | Fjordgrund |
| Polarlichtgrün | `#5CFFB0` | Aurora, Biolumineszenz-Akzente |
| Polarlichtviolett | `#B57BFF` | Aurora, magische Fische |
| Dämmerrosa | `#F2B5D4` | Mitternachtssonne/Dämmerung, Lachsfarben |

**Tiefenschichten:**

| Schicht | Tiefe | Aussehen |
|---|---|---|
| Eisloch | 0–5 m | Unterseite der Eisdecke mit Eiszapfen und Lichtschächten durch die Löcher |
| Kaltwasser | 5–20 m | klares, kaltes Blau, Krill-Wolken, Quallen |
| Eisbergwurzeln | 20–40 m | die gewaltige, kantige Unterseite eines Eisbergs mit Höhlen im Eis |
| Fjordgrund | 40–70 m | Felsen, Seesterne, Seeanemonen, ein halb versunkenes **Wikingerschiff** |

**Umgebungsleben:**
- Robben, die aus Eislöchern schauen und manchmal eines blockieren (lustig, dann zum anderen Loch wechseln)
- watschelnde Pinguine, Schneeeulen
- Wale blasen im Hintergrund, Krillschwärme
- Löwenmähnenquallen, Polarfuchs auf der Eisfläche

**Spezialmechanik – Eislöcher & Frost:**
- *Zufrieren:* Ein unbenutztes Eisloch friert nach 45 s langsam zu (Eisschicht wächst sichtbar). Freihacken: 3× tippen, mit Eispickel 1×. Spieler mit 2 Löchern müssen sie im Blick behalten. Ein zugefrorenes Loch hat beim nächsten Freihacken 10 % Chance auf eine Treibgut-Kiste („Im Eis eingeschlossen!“).
- *Kälte:* Bei Schnee und Schneesturm wird die Schnur steif. Ohne Thermoschnur schrumpft die grüne Zone um 20 %.
- *Eisschollen:* Am Fjordrand treiben Schollen, die Würfe abfangen können (der Köder landet auf der Scholle, kurz zurückziehen).

**Wetter:** Klar 30 % · Bewölkt 25 % · Schnee 25 % · Schneesturm 10 % · Eisnebel 10 %
**Ereignisse:**
- *Polarlicht* (25 % aller Nächte): Polarlicht-Fische erscheinen, Episch +50 %, Wasser schimmert grün-violett
- *Walgesang*: Ein Wal zieht vorbei, alle Fische fliehen 10 s nach oben (Tiefe −10 m für alle Spawns)
- *Eisbergkalbung*: Ein Brocken stürzt ins Wasser, Welle, Wurfweite −20 % für 15 s, danach Fressrausch

**Boss: Grimmbart, der Gletscherhai** (Grönlandhai-Basis, Nr. 060)
- **Erscheint:** Fjordgrund, 50–70 m, Nacht bei Schneesturm
- **Phase 1 – „Eisige Ruhe“** (100–70 %): extrem schwer und langsam (Brocken, K9). Er ist 400 Jahre alt und hat keine Eile.
- **Phase 2 – „Eisbrecher“** (70–45 %): Er rammt von unten gegen die Eisdecke. Der Bildschirm bebt und **alle Eislöcher frieren schlagartig zu**. Wer sein Loch nicht innerhalb von 3 s freihackt, macht in dieser Zeit keinen Schaden.
- **Phase 3 – „Tiefensog“** (45–20 %): Taucher-Muster. Er zieht in den Fjordgrund, Schnurkapazität wird wichtig.
- **Phase 4 – „Frostatem“** (20–0 %): Die Schnur vereist, die grüne Zone schrumpft alle 3 s um 3 %. Dann heißt es: schnell fertigmachen.

**Schillernd-Regel W3:** „Polarlicht“, also Grundfarben zu einem Grün-Violett-Verlauf, mit schimmernden weißen Pixelfunken.

---

#### Welt 4 – Leuchtende Tiefe

| | |
|---|---|
| **Thema** | offener Ozean, meist bei Nacht. Die Spieler stehen auf dem Forschungsschiff **„MS Tiefblick“** mit Kran, Tiefseewinde, Sonarbildschirm und Labor-Containern. Unter Wasser ist alles fast schwarz und wird nur von Biolumineszenz erhellt. Beim Abstieg fährt die Kamera mit dem Köder in die Tiefe. Oben links zeigt ein Bild-im-Bild das Boot. |
| **Spielerplätze** | 4 Winden-Stationen am Heck |
| **Stimmung** | Staunen, Geheimnis, ein bisschen unheimlich, aber nie Horror (Jugendfreigabe!) |
| **Musik** | Ambient-Synth-Pads, Sonar-Pings als Rhythmus, tiefe Bässe, gläserne Glockenspiel-Echos, 60 BPM, geheimnisvoll und staunend. **Biolumineszenz-Welle:** helle Arpeggios. **Boss:** pulsierender Synthwave mit Chor. |

**Palette (Leitfarben):**

| Farbe | Hex | Einsatz |
|---|---|---|
| Abgrundschwarz | `#050A1F` | Grundfarbe der Tiefe (kein Reinschwarz) |
| Tiefindigo | `#1B1446` | Mitternachtszone |
| Dämmerviolett | `#3A1C71` | Dämmerzone, Restlicht |
| Biocyan | `#00F5D4` | Leuchtorgane, Quallen |
| Leuchtgrün | `#7CFF6B` | Leuchtfische, Meeresschnee-Glitzern |
| Quallenmagenta | `#F15BB5` | Staatsquallen, Akzente |
| Laternengelb | `#FEE440` | Anglerfisch-Laternen, Köderlampe |
| Knochengrau | `#9AA0B5` | Grund, Walknochen, nicht leuchtende Fische im Lampenlicht |

**Tiefenschichten** (die Tiefenanzeige zeigt echte Meter, das Scrollen ist nicht linear gestaucht: 1 Bildschirmhöhe ≈ 250 m in der Dämmerzone und ≈ 1.500 m im Graben):

| Schicht | Tiefe | Aussehen |
|---|---|---|
| Dämmerzone | 200–1.000 m | letzte blauviolette Lichtreste von oben, Laternenfisch-Schwärme |
| Mitternachtszone | 1.000–4.000 m | völlig dunkel, nur Leuchtpunkte, lange Staatsquallen-Ketten |
| Abgrundzone | 4.000–6.000 m | Schlammgrund, Riesenasseln, Seegurken, ein **Walfall** (Walskelett mit Leben) |
| Tiefseegraben | 6.000–11.000 m | enge Felsschlucht, **Schwarze Raucher** (Schlote mit dunklem Rauch, rotglühend am Fuß) |

**Umgebungsleben:**
- Vampirtintenfisch, Dumbo-Krake, Staatsquallen (Siphonophoren)
- Meeresschnee, Riesenasseln, Seegurken, Röhrenwürmer an den Rauchern
- ein vorbeiziehendes Pottwal-Auge im Lampenlicht (seltener Gänsehaut-Moment)

**Spezialmechanik – Dunkelheit, Köderlampe & Druck:**
- *Dunkelheit:* Das Wasser ist schwarz. Sichtbar ist nur der **Lichtkegel der Köderlampe** (Radius 32–96 px je Stufe) sowie alle **leuchtenden** Fische und Lebewesen, und das aus jeder Entfernung. Nicht leuchtende Fische sieht man nur im Lampenlicht.
- *Täuschlichter:* Anglerfische und Lumina erzeugen falsche Leuchtpunkte. Ein Biss-„!“ kann ein Täuschbiss sein (orange statt rot, wie beim Trickser).
- *Druck:* Ohne Tiefsee-Kevlar zeigt die Schnur ab 1.000 m ein Druck-Warnsymbol und die Reserve vor dem Riss fällt auf 0.
- *Tiefseewinde:* Die Winde bestimmt, wie tief man kommt (2.000 / 6.000 / 11.000 m). Abstieg in den Graben: 6–8 s. In dieser Zeit beißen nur Fische der durchquerten Schichten (Chance auf Zufallsbisse unterwegs).

**Wetter (Oberfläche):** Ruhige See 40 % · Dünung 30 % · Sturm 15 % · Seenebel 15 %. Das Wetter oben beeinflusst die Dämmerzone. Bei Sturm steigen Riemenfische auf.
**Tiefsee-Ereignisse** (unabhängig vom Wetter, alle 3–5 Min eines):
- *Meeresschnee*: Grundfische +50 %, glitzernde Partikel
- *Biolumineszenz-Welle* (60 s): Alles im Wasser leuchtet kurz auf, die Sicht wird voll, Episch ×2
- *Schwarzer-Raucher-Ausbruch*: Rotes Glühen im Graben. Das ist Luminas Bedingung.
- *Walfall-Festmahl*: Am Walskelett gibt es Grenadierfische ×3 und Schlinger ×2
- *Tag-Nacht-Wanderung*: Nachts steigen Laternenfische und Viperfische 500 m höher (echtes Verhalten, im Lexikon erklärt)

**Boss: Lumina, die Abgrundlaterne** (Riesen-Anglerfisch-Königin, Nr. 080)
- **Erscheint:** Tiefseegraben, 6.000–11.000 m, während eines Schwarzer-Raucher-Ausbruchs
- **Phase 1 – „Lockruf“** (100–70 %): Drei Laternen leuchten, und auf dem Spannungsbalken gibt es **drei grüne Zonen**. Nur eine ist echt: Sie pulsiert im Takt von Luminas Herzschlag-Sound. Wer in einer falschen Zone kurbelt, macht keinen Schaden.
- **Phase 2 – „Lichtblitz“** (70–45 %): Ein greller Blitz (sanft, nicht epileptisch: max. 3 Blitze/s, Option „Blitze reduzieren“). Danach folgen 3 s Blinker-Verhalten. Man spielt nach Vibration und Ton.
- **Phase 3 – „Abgrundsog“** (45–20 %): Taucher. Sie zieht Richtung Graben-Boden, die Schnurkapazität wird geprüft.
- **Phase 4 – „Schlund“** (20–0 %): Brocken + Zappler. Ihr Maul öffnet sich, alle Laternen flackern und das Finale wird hektisch.

**Schillernd-Regel W4:** „Sonnenlicht“, also Leuchtfarben zu warmem Gold/Orange, nicht leuchtende Körper heller. Das ist das Gegenteil der Welt.

---

#### Welt 5 – Glutgrotte

| | |
|---|---|
| **Thema** | eine riesige, mystische Höhle unter einem aktiven Vulkan: Obsidiansteg, Hängebrücke, dampfende Thermalbecken, leuchtende Amethyst-Kristalle, Lavafälle im Hintergrund, Basaltsäulen. Uralte **Drachenstatuen** mit glühenden Runen-Augen bewachen den Glutsee. Ganz unten fließt **Glutwasser**: magische, flüssige Glut, in der Fische leben können. |
| **Spielerplätze** | Obsidiansteg und schwebende Basaltflöße |
| **Stimmung** | episch, mystisch, Finale, Hitze |
| **Musik** | Taiko-Trommeln, tiefe Hörner, Didgeridoo-Drones, Chor, Zither-Akzente, 80 BPM, beim Ausbruch dynamisch bis 130 BPM. **Ausbruch:** epische Percussion. **Boss:** großes Orchester, Chor und Taiko. |

**Palette (Leitfarben):**

| Farbe | Hex | Einsatz |
|---|---|---|
| Obsidianschwarz | `#1A1015` | Felsen, Silhouetten, Grundfarbe |
| Basaltgrau | `#3B2A2F` | Basaltsäulen, Höhlenwände |
| Magmarot | `#D7263D` | Glutwasser-Tiefe, Gefahr |
| Lavaorange | `#F46036` | Lavafälle, Glut |
| Glutgelb | `#FFB627` | heißeste Stellen, Funken, Highlights |
| Aschgrau | `#7D6E6E` | Asche, Rauch, Steinfische |
| Schwefelgrün | `#C5D86D` | Schwefelschlote, giftige Akzente |
| Kristallviolett | `#8E44AD` | Amethystkristalle, Magie, Runen |

**Tiefenschichten:**

| Schicht | Tiefe | Aussehen |
|---|---|---|
| Thermalbecken | 0–5 m | türkis-milchiges heißes Wasser, Dampfschwaden, Kalksinter-Terrassen (Farbkontrast!) |
| Schwefelschlote | 5–20 m | gelbgrüne Schwefelkristalle, Blasen, Schlote mit Rauchfahnen |
| Kristallhöhlen | 20–40 m | riesige violette Amethystkristalle, die das Lampenlicht brechen, Runenwände |
| Magmakammer (Glutsee) | 40–60 m | leuchtendes rot-orangenes Glutwasser, Lavablasen, Drachenknochen |

**Umgebungsleben:**
- Glutfunken (wie Glühwürmchen), Fledermäuse
- Feuersalamander auf Felsen, aufsteigende Lavablasen
- Dampfgeysire, schwebende Kristallsplitter
- Steinwächter-Statuen, deren Augen bei Ereignissen aufleuchten

**Spezialmechanik – Hitze, Ausbrüche & Geysire:**
- *Hitze:* In der Magmakammer haben **alle** Fische zusätzlich Hitzkopf-Eigenschaften (Hitzeleiste der Schnur). Ohne Hitzeschild-Schnur kann man den Glutsee gar nicht beangeln, die Schnur verglüht sofort.
- *Ausbrüche:* Alle 2–4 Minuten gibt es ein **Grollen** (10 s Vorwarnung, Bildschirm zittert leicht), dann **„AUSBRUCH!“** für 30 s:
  - Lavabomben fallen als reiner Effekt
  - Fressrausch: Bissrate ×2
  - Glutfische steigen 15 m höher
  - Phönixflosser- und Feuerdrachen-Koi-Bedingungen werden erfüllt
- *Geysire:* Drei Geysire am Grund der Thermalbecken. Bleibt der Köder über einem Geysir, wird er alle 15 s nach oben geschleudert (Ärgernis). Mit Timing ergibt das aber einen Bonus: Ein Fang direkt nach dem Ausstoß zählt als „Geysir-Fang“ (Größen-μ +0,1).
- *Kristallresonanz:* Mit Kristallköder in den Kristallhöhlen klingen die Kristalle, Kristallarten +80 %.

**„Wetter“ (Höhlenzustände):** Ruhig 45 % · Dampfnebel 25 % · Aschenregen 20 % · Erdbeben 10 %
**Ereignisse:**
- *Ausbruch* (alle 2–4 Min)
- *Großer Ausbruch* (selten, max. 1× pro 16 Min, nachts): Der ganze Glutsee erstrahlt. Das ist Ignaris' Bedingung.
- *Erdbeben*: Felsen fallen, Felsenfresser erscheint
- *Runennacht* (Mitternacht): Die Statuenaugen leuchten violett, mystische Fische +50 %

**Boss: Ignaris, der Lavadrachenfisch** (Nr. 100)
- **Erscheint:** Magmakammer, 55–60 m, während eines Großen Ausbruchs in der Nacht
- **Phase 1 – „Glutschlängeln“** (100–75 %): Zickzack + Hitzkopf, K8
- **Phase 2 – „Feuerodem“** (75–50 %): Er speit Feuer die Schnüre entlang. Die Hitze steigt doppelt so schnell. Wer nicht abkühlt, reißt ab.
- **Phase 3 – „Lavasprung“** (50–25 %): Er springt aus dem Glutsee über den Steg (Springer). Lavabomben treffen zufällige Spielerbereiche: Die Spannung springt 1 s lang auf +20 %.
- **Phase 4 – „Drachenzorn“** (25–0 %): Alle Muster wechseln schnell und zufällig, aber seine Ausdauer brennt rasant ab. Das ist ein kurzes, wildes Finale.

**Schillernd-Regel W5:** „Frost“, also Glutfarben zu Eisblau und Weiß-Cyan, Obsidian zu Silber. Ein Feuer-Fisch aus Eis ist der perfekte Angeber-Fang.

---

### 5. Alle 100 Fische

#### 5.0 Lesehilfe

- **Nr.** = Lexikonnummer (001–100). Pro Welt sind Arten nach Seltenheit sortiert, es gibt also je Welt 8 Gewöhnliche, 5 Ungewöhnliche, 4 Seltene, 2 Epische und 1 Legendären (= Boss).
- **Größe** = Sprite-Canvas nach den Größenklassen aus Teil F:
  - **S 32×16**
  - **M 64×32**
  - **L 96×48**
  - **XL 128×64**
  - Sonderklasse **Boss 256×128** (Animation aus Einzelteilen erlaubt, Teil F5)
  - Fische schauen nach rechts, mindestens 2 px transparenter Rand.
  - Dahinter steht die echte Länge min–max in cm. Daraus wird die Größenvarianz gewürfelt (1.10).
- **Tiefe** in Metern, passend zu den Schichten der Welt.
- **Zeit · Wetter:**
  - Morgen/Tag/Abend/Nacht, „Immer“ = jede Tageszeit
  - Wetter ohne Zusatz = bevorzugt (×2). **(Pflicht)** = ohne diese Bedingung kein Spawn.
- **Drill · K** = Hauptverhalten (siehe 1.7). Ein Pfeil → bedeutet Verhaltenswechsel bei 50 % Ausdauer. K = Kraft 1–10.
- **Punkte** = Basispunkte B (= Basis-Verkaufswert in Münzen).
- **Beschreibung** für Pixel-Artists: Körperform, Farben, Muster, Flossen, Merkmale. Am Ende steht die **Schillernd**-Palette.
- Max. 12 Farben (S) bzw. 16 Farben (M–XL), Licht von oben links, 1 px Selektiv-Outline (siehe Style Guide).

#### 5.1 Welt 1 – Sonnenspiegelsee (Nr. 001–020)

| Nr | Name | Basis | Seltenheit | Größe | Tiefe | Zeit · Wetter | Drill · K | Punkte | Pixel-Art-Beschreibung |
|---|---|---|---|---|---|---|---|---|---|
| 001 | **Rotauge** | echt (*Rutilus rutilus*) | Gewöhnlich | S 32×16 · 10–30 cm | 0–8 m | Immer | Zappler · K2 | 10 | Schlanker, leicht hochrückiger Körper in glänzendem Silber mit blaugrünem Rücken. Auffällig ist die **leuchtend rote Iris** (2-px-Ring um die Pupille). Bauch-, After- und Brustflossen sind orange-rot, die Rückenflosse grau. 1-px-Glanzkante entlang des Rückens. **Schillernd:** Silber-Lavendel, Iris hellblau. |
| 002 | **Flussbarsch** | echt (*Perca fluviatilis*) | Gewöhnlich | S 32×16 · 10–35 cm | 2–10 m | Tag · Sonnig/Bewölkt | Zappler · K3 | 15 | Olivgrüner Rücken, goldgelbe Flanken mit **6 dunklen senkrechten Querstreifen**. Zwei Rückenflossen, die vordere stachelig mit einem **schwarzen Fleck** am Ende. Bauch- und Afterflossen knallig orange-rot, leicht buckliger Nacken. **Schillernd:** Silberkörper, lavendelfarbene Streifen, hellblaue Flossen. |
| 003 | **Brasse** | echt (*Abramis brama*) | Gewöhnlich | M 64×32 · 25–60 cm | 8–15 m | Abend, Nacht | Brocken · K3 | 15 | Sehr **hochrückig und seitlich flach** wie ein Teller. Bronze bis Messing mit dunklerem Rücken, kleiner Kopf mit **rüsselartigem, nach unten zeigendem Maul**, lange Afterflosse, grauviolette Flossen. Schleimiger Glanz als 2 helle Pixelreihen. **Schillernd:** Perlmutt-Silber mit Lavendelglanz. |
| 004 | **Schleie** | echt (*Tinca tinca*) | Gewöhnlich | M 64×32 · 20–50 cm | 3–15 m (Krautfeld) | Morgen · Bewölkt/Regen | Ruhig · K3 | 20 | Kräftiger, walziger Körper in **dunklem Olivgrün mit Goldschimmer**. Die winzigen Schuppen wirken glatt, also keine Schuppenpixel zeichnen. **Rote Augen**, zwei kleine Barteln am Maulwinkel, alle Flossen groß, rund und dunkel. **Schillernd:** helles Mintsilber, rosa Augen. |
| 005 | **Ukelei** | echt (*Alburnus alburnus*) | Gewöhnlich | S 32×16 · 8–20 cm | 0–3 m | Tag · Sonnig | Sprinter · K1 | 10 | Sehr schlank und klein. **Spiegelnder Silberkörper** mit Highlight-Streifen über die ganze Länge, blaugrüner Rücken, nach oben gerichtetes Maul, durchsichtig-graue Flossen. Tritt im Schwarm auf (3–6 Schatten). **Schillernd:** Rosa-Gold-Spiegel. |
| 006 | **Rotfeder** | echt (*Scardinius erythrophthalmus*) | Gewöhnlich | S 32×16 · 12–30 cm | 0–4 m (Seerosen) | Tag, Abend · Sonnig | Zappler · K2 | 12 | Ähnelt dem Rotauge, hat aber **goldgelbe Flanken** und **blutrote Flossen** (alle außer der Rückenflosse). Oberständiges Maul, goldene Iris. Gold statt Silber macht sie klar von Nr. 001 unterscheidbar. **Schillernd:** Weißsilber mit türkisen Flossen. |
| 007 | **Gründling** | echt (*Gobio gobio*) | Gewöhnlich | S 32×16 · 8–18 cm | 10–25 m (Grund) | Immer | Ruhig · K1 | 12 | Kleiner, länglicher Grundfisch, **sandbraun mit einer Reihe großer dunkler Flecken** an der Seite. Abgeflachter Bauch, zwei kurze Barteln, große Augen weit oben am Kopf. **Schillernd:** Hellblau mit lavendelfarbenen Flecken. |
| 008 | **Sonnenbarsch** | echt (*Lepomis gibbosus*, eingeschleppt) | Gewöhnlich | S 32×16 · 8–20 cm | 0–5 m | Tag · Sonnig | Zickzack · K2 | 25 | Fast **rund wie eine Münze**. Orange-gelber Bauch, olivgrüne Flanken mit **türkisfarbenen Wellenlinien**, ein auffälliger **schwarzer „Ohrfleck“ mit roter Spitze** am Kiemendeckel, stachelige Rückenflosse. Lexikon: „Kam aus Nordamerika und hat sich einfach breitgemacht.“ **Schillernd:** Silber, pinke Wellen, lila Ohrfleck. |
| 009 | **Schuppenkarpfen** | echt (*Cyprinus carpio*) | Ungewöhnlich | L 96×48 · 40–90 cm | 5–15 m | Morgen, Abend · Bewölkt | Brocken · K5 | 50 | Kräftig und hochrückig mit **großen, klar abgesetzten Schuppen in Bronze-Gold**. Jede Schuppe ist ein kleiner Bogen mit heller Kante. Dunkler Rücken, **4 Barteln** am rüsselartigen Maul, lange Rückenflosse, rotbraune Bauchflossen. **Schillernd:** „Mondkarpfen“, Silberschuppen mit Lavendelkanten. |
| 010 | **Zander** | echt (*Sander lucioperca*) | Ungewöhnlich | L 96×48 · 40–90 cm | 8–20 m | Abend, Nacht · Bewölkt/Regen | Taucher · K5 | 60 | Langgestreckt, **graugrün mit dunklen, verwaschenen Querbinden**, weißer Bauch, zwei getrennte Rückenflossen mit Punktreihen. **Große glasig-reflektierende Augen** mit hellem Ring, der nachts leicht leuchtet. Spitze **Fangzähne** (2 helle Pixel). Zahnfisch. **Schillernd:** Blassblau, silberne Binden, pink leuchtende Augen. |
| 011 | **Europäischer Aal** | echt (*Anguilla anguilla*) | Ungewöhnlich | L 96×48 · 40–100 cm | 10–25 m (Grund) | Nacht · Regen/Gewitter | Zickzack · K4 | 55 | **Schlangenförmig**, als sanfte S-Kurve gezeichnet. Dunkel-olivbrauner Rücken, gelblicher Bauch. Rücken-, Schwanz- und Afterflosse sind zu **einem durchgehenden Flossensaum** verschmolzen. Kleiner Kopf, Unterkiefer leicht vorstehend, schleimiger Glanz als 1-px-Linie. **Schillernd:** Silberaal mit hellblauem Saum. |
| 012 | **Regenbogenforelle** | echt (*Oncorhynchus mykiss*) | Ungewöhnlich | M 64×32 · 25–60 cm | 2–8 m | Morgen · Regen/Bewölkt | Springer · K4 | 60 | Stromlinienförmig und silbern mit einem **rosa-violetten Längsband** („Regenbogen“) von den Kiemen bis zum Schwanz. **Übersät mit kleinen schwarzen Punkten**, auch auf Rücken- und Schwanzflosse. Olivgrüner Rücken, kleine Fettflosse. **Schillernd:** „Goldforelle“, goldener Körper mit türkisem Band. |
| 013 | **Seerosen-Hüpfer** | Fantasie (Frosch × Fisch) | Ungewöhnlich | M 64×32 · 15–30 cm | 0–2 m (Seerosen) | Immer · Regen | Springer · K3 | 70 | Fröhlicher grüner Fisch mit **Froschbeinen statt Bauchflossen** und großen, oben sitzenden **Glupschaugen**. Hellgrüner Körper mit dunkelgrünen Flecken wie ein Teichfrosch, breites Grinsemaul. Auf dem Kopf wächst eine **kleine rosa Seerosenblüte** (3 Blütenblätter, gelbe Mitte). Quakt beim Fang. **Schillernd:** Lavendelkörper, weiße Blüte. |
| 014 | **Hecht** | echt (*Esox lucius*) | Selten | L 96×48 · 50–130 cm | 3–15 m | Morgen, Abend · Bewölkt/Regen | Sprinter · K6 | 120 | Langer, **torpedoförmiger** Körper mit **entenschnabelartigem Maul** voller Zähnchen. Olivgrün mit **hellgelben, bohnenförmigen Flecken in Reihen**, weißer Bauch. Rücken- und Afterflosse sitzen weit hinten am Schwanz, rotbraune Flossen mit dunklen Tupfen, stechend gelber Blick. Zahnfisch. **Schillernd:** Silber-Lavendel mit hellblauen Flecken. |
| 015 | **Sterlet** | echt (*Acipenser ruthenus*) | Selten | L 96×48 · 40–100 cm | 15–25 m | Nacht | Brocken · K5 | 150 | Urzeitlicher Mini-Stör mit **langer, spitzer, leicht nach oben gebogener Schnauze** und 4 gefransten Barteln. **5 Reihen knöcherner Platten** (helle Rautenpixel) entlang Rücken und Seiten, graubraun mit gelblichem Bauch, **haiartiger Schwanz** (oberer Lappen länger). **Schillernd:** Weißgold mit hellblauen Platten. |
| 016 | **Moosbart-Karausche** | Fantasie (Karausche-Basis) | Selten | L 96×48 · 30–60 cm | 10–20 m | Morgen · Regen/Nebel | Ruhig → Brocken · K5 | 140 | Uralte, sehr runde Karausche in **Messing-Gold**. Auf ihrem Rücken wächst **dichtes grünes Moos** (Pixelbüschel ragen über die Silhouette), obendrauf sitzt **eine kleine Schnecke**. Ein langer grauer **Moosbart** hängt am Kinn, die Augenlider sind müde halb geschlossen, ein paar Schuppen sind abgeblättert. Erst gemütlich, ab halber Ausdauer plötzlich zäh. **Schillernd:** Silbermoos, rosa Schnecke. |
| 017 | **Glühwürmchen-Barsch** | Fantasie (Barsch-Basis) | Selten | M 64×32 · 15–30 cm | 0–5 m | Nacht · kein Regen **(Pflicht)** | Zickzack · K4 | 180 | Dunkelblauer Barsch mit **gelbgrün leuchtenden Punkten** entlang der Flanken und an den Flossenspitzen. Sie pulsieren im 2-s-Takt mit 2 Helligkeitsstufen. Die Rückenflossen-Stacheln enden in **kleinen Lichtkugeln**. Über dem Wasser lockt er echte Glühwürmchen an, nachts ist er auch ohne Licht sichtbar. **Schillernd:** Lila Körper mit rosa Lichtern. |
| 018 | **Europäischer Wels** | echt (*Silurus glanis*) | Episch | XL 128×64 · 120–250 cm | 15–25 m (Tiefes Loch) | Nacht · Gewitter/Regen | Brocken → Taucher · K8 | 350 | Riesig, mit **breitem flachem Kopf und gewaltigem Maul**. **2 sehr lange Barteln** am Oberkiefer, 4 kurze am Kinn, winzige Augen. Die schuppenlose Haut ist **dunkelgrau-oliv marmoriert**, der Bauch hell gefleckt. Winzige Rückenflosse, **lange Afterflosse bis zum Schwanz**, nach hinten verjüngt wie ein Aal. **Schillernd:** Albino-Wels in Weiß mit rosa Augen und Lavendelmarmor. |
| 019 | **Kirschblüten-Koi** | Fantasie (Koi-Basis) | Episch | XL 128×64 · 50–90 cm | 0–5 m | Morgen · Sonnig | Springer · K6 | 450 | Eleganter Koi in **Weiß mit großen kirschroten Flecken** (Kohaku-Muster) und **schleierartigen, überlangen rosa Flossen**, deren Ränder wie Kirschblütenblätter gezackt sind. Von den Flossen lösen sich **kleine Blütenblatt-Partikel**. Goldene Schuppenreihe auf dem Rücken. Lexikon: „Jemand hat ihn vor 100 Jahren aus einem Gartenteich ausgesetzt. Seitdem blüht er.“ **Schillernd:** Platin-Koi mit lavendelblauen Flecken. |
| 020 | **Der Alte Barnabas** | Fantasie (Riesenhecht) | Legendär · Boss | Boss 256×128 · 220–300 cm | 15–25 m | Nacht · Gewitter oder Vollmond **(Pflicht)** | Boss: Sprinter → Versteckspieler → Springer · K8 | 1000 | Gigantischer, uralter Hecht mit **narbigem Gesicht**: ein Auge **trüb-milchig**, das andere leuchtend gelb. Der **Kiemendeckel ist zackig wie eine Krone** geformt. Im Unterkiefer **stecken 5 alte Blinker und Haken** (Trophäen gescheiterter Angler, glänzende Metallpixel). Moosgrüner Rücken mit nachwehenden Algenfäden, Flecken wie verblasstes Gold. **Schillernd:** „Silberner Barnabas“, Mondsilber mit Lavendel-Algen und zwei strahlend blauen Augen. |

#### 5.2 Welt 2 – Regenbogenriff (Nr. 021–040)

| Nr | Name | Basis | Seltenheit | Größe | Tiefe | Zeit · Wetter | Drill · K | Punkte | Pixel-Art-Beschreibung |
|---|---|---|---|---|---|---|---|---|---|
| 021 | **Anemonen-Clownfisch** | echt (*Amphiprion ocellaris*) | Gewöhnlich | S 32×16 · 6–11 cm | 0–6 m (Anemonen) | Tag | Zickzack · K1 | 20 | Knallorange mit **drei weißen Bändern** (Kopf, Mitte, Schwanzansatz), jedes **schwarz umrandet**. Abgerundete Flossen mit schwarzem Saum, frecher Blick. Spawn-Animation: lugt aus einer pinken Anemone. **Schillernd:** Neonblau mit gelben Bändern. |
| 022 | **Paletten-Doktorfisch** | echt (*Paracanthurus hepatus*) | Gewöhnlich | S 32×16 · 12–25 cm | 3–15 m | Tag · Sonnig | Sprinter · K2 | 25 | **Königsblau** mit einem **schwarzen „Paletten“-Muster** auf der Flanke, das wie eine liegende 6 aussieht. **Leuchtend gelber Schwanz** und gelbe Brustflossenspitze, kleiner **Skalpelldorn** am Schwanzstiel (1 heller Pixel). Lexikon-Gag: „Sucht immer irgendwen.“ **Schillernd:** Gelb mit blauem Schwanz. |
| 023 | **Preußenfisch** | echt (*Dascyllus aruanus*) | Gewöhnlich | S 32×16 · 5–10 cm | 0–8 m | Immer | Zappler · K1 | 20 | Kleiner, hochrückiger Fisch, **weiß mit drei breiten schwarzen Schrägbändern**, schwarze Bauchflossen, weißgrauer Schwanz. Tritt in Grüppchen über Geweihkorallen auf. **Schillernd:** Hellpink mit türkisen Bändern. |
| 024 | **Kupferstreifen-Pinzettfisch** | echt (*Chelmon rostratus*) | Gewöhnlich | M 64×32 · 12–20 cm | 5–15 m | Tag | Zickzack · K2 | 25 | Scheibenförmiger Falterfisch, **weißsilbern mit 4 kupferorangen, dunkel umrandeten Querbändern** und einer **langen, pinzettenartigen Schnauze**. In der Rückenflosse sitzt ein **schwarzer Augenfleck** mit weißem Ring (falsches Auge). **Schillernd:** Blausilber mit grünen Bändern. |
| 025 | **Masken-Papageifisch** | echt (*Scarus*-Basis) | Gewöhnlich | M 64×32 · 30–60 cm | 5–15 m (Riffdach) | Morgen · Sonnig | Ruhig · K3 | 35 | Kräftig, mit **verschmolzenen Zähnen wie ein Papageienschnabel** (weiß-türkis). Große Schuppen in **Türkisgrün mit pinken Rändern**, eine gelbe „Maske“ um die Augen, sichelförmiger Schwanz mit pinken Spitzen. Knabbert Korallen und hinterlässt Sandwölkchen. Lexikon: „Macht aus Korallen Sand. Ja, wirklich.“ **Schillernd:** Orangerot mit blauen Rändern. |
| 026 | **Indopazifischer Sergeant** | echt (*Abudefduf vaigiensis*) | Gewöhnlich | S 32×16 · 10–20 cm | 0–6 m | Tag | Zappler · K1 | 20 | Ovaler Riffbarsch mit **gelbem Rücken**, silbrig-weißem Körper und **5 schwarzen senkrechten Streifen** wie ein Uniformabzeichen, gegabelter Schwanz. **Schillernd:** Lila mit gelben Streifen. |
| 027 | **Blaupunktrochen** | echt (*Taeniura lymma*) | Gewöhnlich | M 64×32 · 25–35 cm (Scheibe) | 10–20 m (Sand) | Immer | Versteckspieler · K3 | 40 | In **3/4-Ansicht** (schräg von oben), damit die Scheibe lesbar ist: ovale **sandbeige-ockerfarbene Scheibe mit leuchtend blauen Punkten**. Der Schwanz hat **zwei blaue Längsstreifen** und einen Stachel, die goldenen Augen sitzen oben. Gräbt sich halb in den Sand ein. **Schillernd:** Dunkelblaue Scheibe mit gelben Punkten. |
| 028 | **Gelber Kofferfisch** | echt (*Ostracion cubicus*, Jungtier) | Gewöhnlich | S 32×16 · 8–15 cm | 3–10 m | Tag · Sonnig | Ruhig · K1 | 30 | Fast **würfelförmig**, knallgelb mit **gleichmäßig verteilten schwarzen Punkten** (Spielwürfel-Look). Kleiner Schmollmund, winzige Flossen, die wie Propeller wirbeln (2-Frame-Animation). Lexikon: „Schwimmt wie ein Spielzeug-U-Boot.“ **Schillernd:** Blau mit pinken Punkten. |
| 029 | **Weißflecken-Kugelfisch** | echt (*Arothron hispidus*) | Ungewöhnlich | M 64×32 · 20–45 cm | 5–15 m | Abend | Aufbläher · K3 | 70 | Graues Oliv mit **vielen weißen Punkten**, weißer Bauch mit Streifen, **weiße Ringmuster um die Brustflossen**, große niedliche Augen. **Zweites Sprite: aufgeblasen** als stachelige Kugel (1-px-Stacheln ringsum) für die Aufbläh-Phase. **Schillernd:** Pfirsich mit türkisen Punkten. |
| 030 | **Rotfeuerfisch** | echt (*Pterois volitans*) | Ungewöhnlich | M 64×32 · 20–38 cm | 10–25 m | Abend, Nacht | Trickser · K4 | 80 | **Rot-weiß gestreift** wie ein Zirkuszelt, mit **riesigen fächerartigen Brustflossen** und **langen, giftigen Rückenstacheln** (dünne Linien mit Hautfähnchen), kleine Fransen über den Augen. Im Sprite dominieren die Flossen, der Körper bleibt klein. **Schillernd:** Schwarz-Gold gestreift. |
| 031 | **Halfterfisch** | echt (*Zanclus cornutus*) | Ungewöhnlich | M 64×32 · 15–23 cm | 5–15 m | Tag | Zickzack · K3 | 65 | Sehr hoch und **scheibenförmig** mit **breiten schwarz-weiß-gelben Bändern** und orangefarbener Schnauze. Die **extrem lange, weiße, sichelförmige Rückenflosse** weht wie ein Wimpel weit nach hinten. **Schillernd:** Pink-Türkis-Weiß. |
| 032 | **Zebramuräne** | echt (*Gymnomuraena zebra*) | Ungewöhnlich | L 96×48 · 60–150 cm | 10–25 m (Riffhöhlen) | Nacht | Versteckspieler · K5 | 90 | Langer, aalartiger Körper in **Schokobraun mit vielen schmalen weißen Ringen** (Zebramuster), kleiner rundlicher Kopf, halb offenes Maul. Idle-Pose beim Spawn: **schaut aus einer Korallenhöhle**. Zahnfisch. **Schillernd:** Mitternachtsblau mit gelben Ringen. |
| 033 | **Zuckerwatte-Seepferdchen** | Fantasie (Seepferdchen-Basis) | Ungewöhnlich | M 64×32 (aufrecht, 28 px hoch) · 8–18 cm | 0–8 m (Seegras) | Tag · Sonnig | Ruhig, aber zerbrechlich (grüne Zone −30 %) · K1 | 100 | Seepferdchen mit **pastellrosa-hellblau verwirbeltem Körper** wie Zuckerwatte. **Fluffige Hautfähnchen** auf Kopf und Rücken (weiche Puff-Pixel), eingerollter Schwanz mit kleinem Glitzer, verträumte Augen mit Wimpern. Zieht ein Wölkchen aus rosa Pixeln hinter sich her. **Schillernd:** Pfefferminzgrün-Gelb. |
| 034 | **Großer Barrakuda** | echt (*Sphyraena barracuda*) | Selten | L 96×48 · 80–160 cm | 15–30 m (Riffkante) | Morgen, Abend | Sprinter · K6 | 180 | **Silbern und pfeilförmig**, mit **dunklen schrägen Querbalken** auf dem Rücken und **verstreuten schwarzen Flecken** am Hinterleib. **Vorstehender Unterkiefer mit dolchartigen Zähnen** (3–4 helle Pixel sichtbar), gegabelter dunkler Schwanz mit weißen Spitzen, grimmiger Blick. Zahnfisch. **Schillernd:** Goldbarrakuda mit violetten Balken. |
| 035 | **Napoleon-Lippfisch** | echt (*Cheilinus undulatus*) | Selten | XL 128×64 · 100–200 cm | 20–35 m | Tag | Brocken · K7 | 220 | Massiger Riese mit **großem Stirnbuckel** und **dicken Lippen**. Grünblaue Haut mit einem **feinen labyrinthartigen Wellenmuster** im Gesicht (Doppelpixel-Linien), hinter den Augen zwei dunkle Striche. Freundlicher, neugieriger Ausdruck. **Schillernd:** Korallenrot mit gelbem Labyrinth. |
| 036 | **Mandarinfisch** | echt (*Synchiropus splendidus*) | Selten | S 32×16 · 5–7 cm | 5–12 m | Abend **(Pflicht)** | Zickzack · K2 | 200 | Winzig, aber **psychedelisch**: **leuchtend orange Wellenlinien auf blautürkisem Grund**, Kopf mit orange-blauen Streifen, große runde Brust- und Rückenflossen mit blauem Rand, Augen wie kleine Murmeln. Hier zählt jeder Pixel (Detail-Fokus fürs Artwork). **Schillernd:** Pink-Grün-Muster. |
| 037 | **Prismaflosser** | Fantasie | Selten | L 96×48 · 40–70 cm | 10–25 m | Tag · Sonnig | Springer · K5 | 250 | Schlanker, silbrig-weißer Körper mit **durchsichtigen Kristallflossen** („Glas“-Look aus hellen Kantenpixeln und 2 Grautönen). Durch sie fällt die Sonne und wirft einen **Regenbogenfächer** (6 Farben in 1-px-Streifen) auf den Körper, die Schwanzspitzen sind kristallen. Beim Sprung entsteht ein kleiner Regenbogen über dem Wasser. **Schillernd:** Rosékristall mit goldenem Regenbogen. |
| 038 | **Segelfisch** | echt (*Istiophorus platypterus*) | Episch | XL 128×64 · 180–300 cm | 30–50 m (Blauwasser) | Tag · Sonnig | Springer · K8 | 500 | Langer, **schwertartiger Oberkiefer** und eine **riesige Segel-Rückenflosse** in **Kobaltblau mit schwarzen Punkten**, die er im Drill aufstellt (zweites Sprite: Segel hoch). Oben dunkelblau, unten silbern mit **hellblauen senkrechten Streifen**, sichelförmiger Schwanz. Lexikon: „Schnellster Fisch im Meer.“ **Schillernd:** Purpursegel mit goldenen Punkten. |
| 039 | **Korallendrache** | Fantasie (Fetzenfisch-Basis) | Episch | XL 128×64 · 40–80 cm | 15–30 m | Nacht · Korallenblüte (oder Regen bei Flut) **(Pflicht)** | Versteckspieler · K6 | 600 | Ein Seedrache wie ein Fetzenfisch, dessen **Hautlappen lebende Korallen** sind: Geweihkoralle, Fächer und kleine Anemonen wachsen in Korallenrot, Pink und Violett aus Rücken und Bauch. Langer Röhrenmaul-Kopf mit **zwei kleinen Drachenhörnern**, Augen wie Perlen. Zwischen den Ästen wohnen winzige Fischchen (2-px-Deko). Zwischen Riffen fast unsichtbar. **Schillernd:** Korallen in Neongelb und Türkis. |
| 040 | **Kaiserin Coralina** | Fantasie (Manta-Basis) | Legendär · Boss | Boss 256×128 · Spannweite 500–700 cm | 30–50 m | Abend/Nacht · Vollmond oder Flut **(Pflicht)** | Boss: Brocken → Zickzack-Strudel → wandernde Zone → Springer · K8 | 1500 | Riesiger Mantarochen in **3/4-Ansicht** mit flügelartigen Brustflossen. Über den indigofarbenen Rücken laufen **wandernde Regenbogen-Wellen** (Palette-Cycling-Animation mit 8 Farben). Die **Kopflappen sind wie eine Krone** geschwungen, der **Bauch ist perlmuttweiß** mit edelsteinartigen Punkten. Drei kleine Putzerfische begleiten sie. Ruhige, weise Augen. **Schillernd:** „Goldene Kaiserin“, Goldrücken mit Pink-Türkis-Wellen. |

#### 5.3 Welt 3 – Frostfjord (Nr. 041–060)

| Nr | Name | Basis | Seltenheit | Größe | Tiefe | Zeit · Wetter | Drill · K | Punkte | Pixel-Art-Beschreibung |
|---|---|---|---|---|---|---|---|---|---|
| 041 | **Polardorsch** | echt (*Boreogadus saida*) | Gewöhnlich | S 32×16 · 15–30 cm | 0–20 m | Immer | Zappler · K2 | 30 | Schlanker Dorsch, **graubraun-oliv** mit feinen dunklen Pünktchen und silbrigem Bauch. Typisch Dorsch: **drei Rückenflossen** und zwei Afterflossen, eine **kurze Kinnbartel**, leicht vorstehender Unterkiefer. **Schillernd:** Polarlichtgrün mit violetten Pünktchen. |
| 042 | **Lodde** | echt (*Mallotus villosus*) | Gewöhnlich | S 32×16 · 12–20 cm | 0–10 m | Morgen | Sprinter · K1 | 30 | Kleiner, sehr schlanker Schwarmfisch mit **olivgrünem Rücken und silbernen Seiten**, durchscheinenden Flossen und großen Augen. Spawnt als Schwarm. **Schillernd:** Violettsilber mit grünem Rücken. |
| 043 | **Atlantischer Hering** | echt (*Clupea harengus*) | Gewöhnlich | S 32×16 · 20–35 cm | 5–20 m | Immer · Bewölkt | Zickzack · K2 | 35 | Klassischer Silberfisch mit **blaugrünem, metallisch glänzendem Rücken** und **spiegelnden Silberseiten** (2 Highlight-Stufen), gegabelter Schwanz. Große Schuppen glitzern beim Drehen (1-Frame-Glanz). **Schillernd:** Rosagold mit violettem Rücken. |
| 044 | **Seeskorpion** | echt (*Myoxocephalus scorpius*) | Gewöhnlich | M 64×32 · 15–40 cm | 20–45 m (Grund) | Immer | Versteckspieler · K3 | 40 | **Großer, stacheliger Kopf** mit Dornen am Kiemendeckel und breiten **fächerartigen Brustflossen**. Der Körper ist zur Felstarnung **braun-rot-grün marmoriert**, der Bauch hell gefleckt, das Maul breit und grimmig. **Schillernd:** Eisgrün-violett marmoriert. |
| 045 | **Seesaibling** | echt (*Salvelinus alpinus*) | Gewöhnlich | M 64×32 · 25–60 cm | 0–15 m | Morgen · Schnee | Springer · K3 | 45 | Lachsartig, mit **dunkelgrünem Rücken voller cremefarbener Punkte** und **leuchtend orange-rotem Bauch** (Laichkleid). Bauch- und Afterflossen orange mit **weißem Vordersaum**. **Schillernd:** Violetter Rücken, grüner Bauch. |
| 046 | **Rotbarsch** | echt (*Sebastes norvegicus*) | Gewöhnlich | M 64×32 · 30–60 cm | 20–40 m | Immer | Ruhig · K3 | 45 | **Leuchtend orange-rot** mit **großen, vorquellenden Augen** (typisch für Tiefenfische). Stachelige Rückenflosse, große Brustflossen, knöcherne Kanten am Kopf. **Schillernd:** Polarlichtgrün mit violetten Flossen. |
| 047 | **Schneeflöckchen-Grundel** | Fantasie (Grundel-Basis) | Gewöhnlich | S 32×16 · 5–10 cm | 0–5 m (unter der Eisdecke) | Immer · Schnee | Zickzack · K1 | 50 | Winzige **weiß-hellblaue Grundel**, deren **Rückenflosse wie eine sechszackige Schneeflocke** geformt ist. Körper mit eisblauen Sprenkeln, runde Kulleraugen, hinterlässt beim Schwimmen 1-px-Schneeflöckchen. **Schillernd:** Grün-violette Schneeflocke. |
| 048 | **Krokodileisfisch** | echt (*Chaenocephalus aceratus*) | Gewöhnlich | M 64×32 · 30–60 cm | 20–45 m | Nacht | Ruhig · K2 | 55 | Fast **durchscheinend weißlich**, mit **flacher, krokodilartiger Schnauze**, großen Brustflossen und schwachen grauen Querbändern. Die Kiemen schimmern blass statt rot. Lexikon: „Hat kein rotes Blut. Kein Witz.“ **Schillernd:** Blassvioletter Glas-Look mit grüner Schnauze. |
| 049 | **Atlantischer Heilbutt** | echt (*Hippoglossus hippoglossus*) | Ungewöhnlich | L 96×48 · 60–150 cm | 30–60 m (Grund) | Immer · Bewölkt | Brocken · K6 | 100 | Plattfisch in **3/4-Ansicht** (wie die Rochen), damit er lesbar bleibt. **Beide Augen auf der Oberseite**, die Oberseite **olivbraun marmoriert**, ein weißer Unterseitenrand sichtbar, lange Flossensäume rundum, großes Maul mit schiefem Grinsen. **Schillernd:** Violett marmoriert mit grünem Saum. |
| 050 | **Seewolf** | echt (*Anarhichas lupus*) | Ungewöhnlich | L 96×48 · 60–120 cm | 25–50 m (Felsen) | Nacht | Versteckspieler · K5 | 110 | Langer, aalartiger Körper, **blaugrau mit 10–12 dunklen Querbinden**. **Großer Kopf mit vorstehenden Hauerzähnen**, sichtbare weiße Zahnstummel, grimmige Stirn. Lexikon: „Sieht gruselig aus, ist aber eigentlich schüchtern.“ Zahnfisch. **Schillernd:** Grün mit violetten Binden. |
| 051 | **Seehase** | echt (*Cyclopterus lumpus*) | Ungewöhnlich | M 64×32 · 25–50 cm | 10–30 m | Tag | Brocken (saugt sich fest) · K4 | 90 | **Rundlich wie ein Ball**, mit **Reihen von Höckern** auf der Haut. Zwei Farbvarianten mit je 50 % Chance (das Lexikon zeigt beide): **Blaugrün** (Weibchen) oder **mit orange-rotem Bauch** (Männchen). Saugnapf am Bauch, kleine Flossen, niedliches Gesicht. **Schillernd:** Lila mit grünen Höckern. |
| 052 | **Atlantischer Lachs** | echt (*Salmo salar*) | Ungewöhnlich | L 96×48 · 50–110 cm | 5–20 m | Morgen · Regen | Springer · K5 | 120 | Kraftvoll, **silbern mit stahlblauem Rücken** und **x-förmigen schwarzen Tupfen** über der Seitenlinie, Fettflosse, kräftiger Schwanz. Ab Größe „Prächtig“ ein leichter **Laichhaken am Unterkiefer** (Sprite-Variante). **Schillernd:** Dämmerrosa mit grünem Rücken. |
| 053 | **Frostfeder-Forelle** | Fantasie (Forellen-Basis) | Ungewöhnlich | M 64×32 · 25–50 cm | 0–15 m | Morgen · Schnee **(Pflicht)** | Springer · K4 | 130 | Silberweiße Forelle, deren **Flossen aus Eisfedern** bestehen: Raureifkristalle mit fein gezackten Kanten in Frostblau. Auf dem Rücken ein **Muster wie Eisblumen am Fenster**, eisblaue Augen, atmet kleine Frostwölkchen aus. **Schillernd:** Polarlichtfedern grün-violett. |
| 054 | **Antarktischer Seehecht** | echt (*Dissostichus mawsoni*) | Selten | L 96×48 · 100–180 cm | 40–70 m | Nacht | Taucher · K7 | 260 | Massiger, **dunkelgrau-schwarzbrauner** Raubfisch mit **großem Maul voller kleiner Zähne**, großen Brustflossen und zwei Rückenflossen. **Frostig-weiße Lichtflecken** auf der Stirn, düster und kraftvoll. **Schillernd:** Gletscherblau mit violetten Flossen. |
| 055 | **Narwal-Hornhecht** | Fantasie (Hornhecht × Narwal) | Selten | L 96×48 · 60–120 cm | 15–35 m | Nacht · Polarlicht | Sprinter · K6 | 280 | Sehr schlanker, **grünlich-silberner** Fisch mit einem **langen, spiralig gedrehten Elfenbeinhorn** an der Schnauze (Spirale als diagonale 1-px-Streifen). Grau gefleckter Rücken wie ein Narwal, kleiner Sichelschwanz. **Schillernd:** Goldenes Horn, violetter Körper. |
| 056 | **Eiszapfen-Aal** | Fantasie | Selten | L 96×48 · 80–150 cm | 30–50 m (Eisbergwurzeln) | Immer · Schneesturm **(Pflicht)** | Zickzack · K6 | 300 | **Halbdurchsichtig wirkender eisblauer Aal**: hellblaue Füllung mit dunklerem Innenstreifen, keine echte Alpha-Transparenz. Am Rücken ragen **Eiszapfenstacheln** nach oben (spitze Dreiecke in Weiß und Frostblau mit Glanzpixel), das **dunklere Rückgrat** schimmert durch, kalte weiße Augen. Klirrt beim Fang. **Schillernd:** Rosa Eis mit grünen Zapfen. |
| 057 | **Polarlicht-Neon** | Fantasie (Salmler-Basis) | Selten | M 64×32 · 10–20 cm | 5–25 m | Nacht · Polarlicht **(Pflicht)** | Zickzack · K3 | 320 | Kleiner, schlanker Fisch auf fast schwarzblauem Grund. Über seinen Körper laufen **Polarlichtbänder** in Grün, Türkis und Violett (Palette-Cycling, 6 Farben). Die Flossen sind wie Lichtschleier mit gestuften Kanten. Leuchtet, also auch im Dunkeln sichtbar. **Schillernd:** Bänder in Gold und Rosa. |
| 058 | **Walrosswels** | Fantasie (Wels × Walross) | Episch | XL 128×64 · 150–250 cm | 30–60 m | Immer · Bewölkt/Eisnebel | Brocken → Taucher · K8 | 600 | Plumper, **dicker graubrauner Riesenwels** mit **zwei langen elfenbeinfarbenen Hauern** aus dem Oberkiefer und einem **dichten Schnurrbart aus Barteln** (borstige Pixelreihen). Faltige Haut, kleine gutmütige Augen, Speckröllchen im Nacken. Lexikon: „Kann sich nicht entscheiden, ob er Fisch oder Walross ist. Also ist er beides.“ **Schillernd:** Rosa-Violett mit goldenen Hauern. |
| 059 | **Gletscher-Stör** | Fantasie (Stör-Basis) | Episch | XL 128×64 · 200–350 cm | 40–70 m | Nacht · Schneesturm | Brocken · K9 | 750 | Gewaltiger Stör, dessen **Knochenplatten aus blauem Gletschereis** bestehen (facettierte Kristalle mit hellen Kanten, innen dunkelblau). Lange Schnauze mit **Eiszapfen-Barteln**, dunkel stahlgrauer Körper, haiartiger Schwanz mit Frostrand. Schneeflocken rieseln von ihm herab. **Schillernd:** Kristallplatten in Polarlicht-Grün-Violett. |
| 060 | **Grimmbart, der Gletscherhai** | Fantasie (Grönlandhai-Basis) | Legendär · Boss | Boss 256×128 · 500–700 cm | 50–70 m | Nacht · Schneesturm **(Pflicht)** | Boss: Brocken → Eisbrecher → Taucher → Frostatem · K9 | 2000 | Uralter, **massiger Grönlandhai** mit stumpfer Schnauze und **schiefergrauer, vernarbter Haut**. Über den Rücken zieht sich eine **Kruste aus Eis und Raureif** mit herausragenden Eiszacken. An beiden Augen hängen **leuchtend eisblaue Ruderfußkrebse** wie kleine Laternen (echtes Grönlandhai-Merkmal, stilisiert). Am Kinn ein langer, gefrorener **Bart aus Eiszapfen** (daher der Name), träge halb geschlossene Augen. Lexikon: „Grönlandhaie können über 400 Jahre alt werden. Grimmbart hat aufgehört zu zählen.“ **Schillernd:** „Polarlicht-Grimmbart“, Eis grün-violett, Augenkrebse golden. |

#### 5.4 Welt 4 – Leuchtende Tiefe (Nr. 061–080)

Hinweis Leuchten: Fische mit Leuchtorganen bekommen eine zweite **Emissionsmaske** (nur die Leuchtpixel) für den Dunkelheits-Shader. Nur diese Pixel sind außerhalb des Lampenlichts sichtbar.

| Nr | Name | Basis | Seltenheit | Größe | Tiefe | Zeit · Wetter | Drill · K | Punkte | Pixel-Art-Beschreibung |
|---|---|---|---|---|---|---|---|---|---|
| 061 | **Laternenfisch** | echt (Familie *Myctophidae*) | Gewöhnlich | S 32×16 · 3–15 cm | 200–1.000 m (nachts ab 200 m) | Immer | Sprinter · K1 | 40 | Kleiner, stumpfköpfiger Fisch mit **riesigen Augen** und dunkelsilbrigem Körper. **Reihen leuchtender Punkte** (Photophoren) in Biocyan an Bauch und Seiten. Schwarmfisch. **Schillernd:** goldene Punkte, heller Körper. |
| 062 | **Silberbeilfisch** | echt (*Argyropelecus*) | Gewöhnlich | S 32×16 · 3–10 cm | 200–1.000 m | Immer | Zappler · K1 | 45 | Seitlich **extrem flach**, der Körper geformt **wie eine Beilklinge**. **Spiegelndes Silber** mit lila Schimmer, **große Röhrenaugen**, die nach oben schauen, eine Reihe Leuchtorgane am Bauch. **Schillernd:** Goldspiegel. |
| 063 | **Borstenmaul** | echt (*Cyclothone*) | Gewöhnlich | S 32×16 · 3–8 cm | 500–1.500 m | Immer | Zappler · K1 | 40 | Winziger, schwärzlicher Fisch mit **übergroßem Maul voller borstenfeiner Zähne** und kleinen Leuchtpunkten. Lexikon: „Vermutlich das häufigste Wirbeltier der Erde, und kaum jemand kennt es.“ **Schillernd:** Honiggelb mit weißen Zähnen. |
| 064 | **Blobfisch** | echt (*Psychrolutes marcidus*) | Gewöhnlich | M 64×32 · 20–35 cm | 600–1.200 m | Immer | Ruhig · K2 | 50 | **Schwimm-Sprite unter Wasser:** ein normaler, kaulquappenartiger Tiefseefisch, rosagrau, mit großem Kopf und weicher Haut. **Fang-Sprite:** die berühmte **traurige rosa „Blob“-Form** mit hängender Nase und Schmollmund, weil oben der Wasserdruck fehlt (das Lexikon erklärt das). Der lustigste Fang-Moment im Spiel. **Schillernd:** Goldgelber Blob mit pinker Nase. |
| 065 | **Viperfisch** | echt (*Chauliodus sloani*) | Gewöhnlich | M 64×32 · 20–35 cm | 500–2.000 m (nachts ab 200 m) | Nacht | Zickzack · K3 | 55 | Schlanker, **dunkelblau-silbriger** Körper mit Leuchtpunktreihen. Die **nadelartigen Fangzähne** sind so lang, dass sie **außerhalb des Mauls** bis über den Kopf ragen. Der erste Rückenflossenstrahl ist lang und hat eine Leuchtspitze. Zahnfisch. **Schillernd:** Kupfergold mit gelben Leuchtpunkten. |
| 066 | **Grenadierfisch** | echt (Familie *Macrouridae*) | Gewöhnlich | M 64×32 · 30–80 cm | 1.000–4.000 m (Grund) | Immer · Walfall | Ruhig · K3 | 60 | Großer Kopf mit **riesigen Augen**. Der Körper läuft in einen **langen, spitzen „Rattenschwanz“** ohne Schwanzflosse aus. Graubraun mit Silberglanz, kleine Kinnbartel. **Schillernd:** Sandgold mit orangem Schwanz. |
| 067 | **Schwarzer Drachenfisch** | echt (*Idiacanthus*) | Gewöhnlich | M 64×32 · 20–40 cm | 1.000–2.000 m | Immer | Zickzack · K3 | 65 | Sehr **langer, tiefschwarzer, aalartiger** Körper mit einer **leuchtenden Kinnbartel**, an deren Ende eine cyanfarbene Kugel hängt. Unter dem Auge sitzt ein rotes Leuchtorgan, kleine spitze Zähne. **Schillernd:** Goldbraun mit orangem Licht. |
| 068 | **Pelikanaal** | echt (*Eurypharynx pelecanoides*) | Gewöhnlich | L 96×48 · 40–80 cm | 1.000–3.000 m | Immer | Trickser · K3 | 70 | Ein **riesiges, sackartiges Maul**: Der Kopf ist größer als der Körper und klappt auf wie ein Pelikanschnabel. Dünner, peitschenartiger Körper mit **leuchtender Schwanzspitze** in Pink. Schwarz mit violettem Glanz. **Schillernd:** Goldbraun mit cyanfarbenem Schwanzlicht. |
| 069 | **Fangzahnfisch** | echt (*Anoplogaster cornuta*) | Ungewöhnlich | S 32×16 · 10–16 cm | 2.000–5.000 m | Immer | Zickzack · K4 | 120 | Klein, aber mit einem **monströsen Kopf** und den **im Verhältnis größten Zähnen aller Fische** (2 riesige untere Fangzähne). Dunkelbraun-schwarz mit rauen Schuppen und kleinen Augen. Lexikon: „Sieht fies aus, passt aber in deine Hand.“ Zahnfisch. **Schillernd:** Orangegold. |
| 070 | **Schwarzer Schlinger** | echt (*Chiasmodon niger*) | Ungewöhnlich | M 64×32 · 15–25 cm | 700–3.000 m | Immer · Walfall | Brocken · K4 | 130 | Schlanker schwarzer Fisch mit einem **riesigen, gedehnten Bauch**. Darin sieht man als Sprite-Gag einen **verschluckten Fisch, der größer ist als er selbst** (helle graue Silhouette). **Schillernd:** Honiggold, der Beutefisch violett. |
| 071 | **Gespensterfisch** | echt (*Macropinna microstoma*) | Ungewöhnlich | M 64×32 · 10–15 cm | 600–800 m | Nacht | Trickser · K3 | 150 | Der **Kopf ist eine durchsichtige Glaskuppel** (helle Kantenpixel, hellgrüne Füllung), darin liegen **zwei leuchtend grüne Röhrenaugen**. Die zwei Punkte vorne, die wie Augen aussehen, sind die Nasenlöcher. Dunkler Körper, große Flossen. Lexikon: „Die Punkte vorne sind seine Nase. Die Augen sind im Kopf. Ja, wirklich.“ **Schillernd:** Goldene Kuppel, pinke Augen. |
| 072 | **Neon-Quallenfisch** | Fantasie | Ungewöhnlich | M 64×32 · 20–35 cm | 200–1.000 m | Immer | Stromer · K4 | 160 | Fisch mit einem **glockenförmigen Kopfschirm** wie eine Qualle (Magentarand) und **langen leuchtenden Tentakelflossen** in Cyan, die hinter ihm herziehen. Am Schirmrand knistern elektrische Funken. **Schillernd:** Goldorangener Schirm. |
| 073 | **Sternenstaub-Sardine** | Fantasie | Ungewöhnlich | S 32×16 · 10–20 cm | 1.000–3.000 m | Immer · Biolumineszenz-Welle **(Pflicht)** | Sprinter · K2 | 170 | Kleine Sardine, deren dunkelindigo Körper wie ein **Sternenhimmel** aussieht: **funkelnde Einzelpixel** in Weiß, Cyan und Gelb blinken zufällig, dazu eine kleine **Milchstraße** als hellerer Diagonalstreifen. Der Schwarm sieht aus wie eine Sternschnuppenwolke. **Schillernd:** Sonnenaufgangshimmel in Orange-Rosa mit goldenen Sternen. |
| 074 | **Tiefsee-Anglerfisch** | echt (*Melanocetus johnsonii*) | Selten | M 64×32 · 10–18 cm | 1.000–4.000 m | Immer | Trickser · K5 | 300 | Rund und **tiefschwarz mit samtiger Haut**, ein **riesiges Maul mit glasigen Nadelzähnen**. Auf der Stirn sitzt eine **Angel mit leuchtender Köderkugel** in Laternengelb. Im Wasser sieht man zuerst nur dieses Licht. Lexikon: „Er angelt selbst, nur besser als du.“ **Schillernd:** Kupferrosa mit blauer Laterne. |
| 075 | **Koboldhai** | echt (*Mitsukurina owstoni*) | Selten | XL 128×64 · 250–400 cm | 300–1.300 m | Nacht | Sprinter · K7 | 350 | **Rosagraue Haut**, eine **lange, flache, schwertartige Schnauze** und darunter ein **vorschnellender Kiefer** mit nadelfeinen Zähnen (zweites Sprite mit ausgefahrenem Kiefer für die Biss- und Drillanimation). Kleine Augen, lange Schwanzflosse. Zahnfisch. **Schillernd:** Lila-Gold. |
| 076 | **Kristallschädel-Fisch** | Fantasie | Selten | L 96×48 · 30–60 cm | 2.000–5.000 m | Immer · Meeresschnee | Zickzack · K5 | 320 | Der Körper ist nur ein heller 1-px-Umriss mit dunkler Füllung („durchsichtig“). Darin leuchtet ein **cyanfarbenes Skelett** (Schädel, Wirbelsäule, Gräten als Pixellinien), das **Herz pulsiert** als kleiner magentafarbener Punkt. **Schillernd:** Goldenes Skelett, rubinrotes Herz. |
| 077 | **Quastenflosser** | echt (*Latimeria chalumnae*) | Selten | L 96×48 · 120–200 cm | 150–700 m (Dämmerzone, Höhlen) | Nacht | Brocken · K7 | 400 | Das „lebende Fossil“: **stahlblauer Körper mit unregelmäßigen weißen Flecken** und **fleischigen, armähnlichen Flossen**, die wie kleine Beine gestielt sind. **Dreiteiliger Schwanz** mit kleinem Mittellappen, dicke Schuppen, große reflektierende Augen. Lexikon: „Galt als vor 66 Millionen Jahren ausgestorben, bis man 1938 einen fand.“ **Schillernd:** Goldkörper mit türkisen Flecken. |
| 078 | **Riemenfisch** | echt (*Regalecus glesne*) | Episch | XL 128×64 (als Wellenband) · 300–800 cm | 200–1.000 m | Immer · Sturm | Zickzack → Taucher · K8 | 800 | **Extrem langer, bandförmiger** Silberkörper mit **graublauen Strichen und Flecken**. Eine **leuchtend rote Rückenflosse** läuft über die ganze Länge, auf dem Kopf sitzt ein **roter Kamm aus langen Strahlen** wie eine Krone. Im Canvas als elegante Welle über 3 Bögen gezeichnet. Lexikon: „Vermutlich der Ursprung vieler Seeschlangen-Sagen.“ **Schillernd:** Goldenes Band mit cyanfarbener Flosse. |
| 079 | **Phantomrochen** | Fantasie (Rochen-Basis) | Episch | XL 128×64 · Spannweite 150–300 cm | 4.000–6.000 m | Immer · Biolumineszenz-Welle **(Pflicht)** | Blinker · K7 | 900 | Ein **unsichtbar wirkender Rochen** in 3/4-Ansicht. Man sieht nur seinen **leuchtenden Umriss in Biocyan** und ein **Netz aus magentafarbenen Lichtadern**, die von der Mitte zu den Flügelspitzen pulsieren. Zwei leuchtend gelbe Augen. Verschwindet im Drill ganz (Blinker). **Schillernd:** Goldener Umriss mit orangen Adern. |
| 080 | **Lumina, die Abgrundlaterne** | Fantasie (Anglerfisch-Basis) | Legendär · Boss | Boss 256×128 · 400–600 cm | 6.000–11.000 m | Immer · Schwarzer-Raucher-Ausbruch **(Pflicht)** | Boss: Trickser (3 Zonen) → Blinker → Taucher → Brocken+Zappler · K9 | 2500 | Kolossale **Anglerfisch-Königin**: tiefschwarzer, samtiger Körper mit **violetten Leuchtornamenten**. Sie hat **drei Angeln mit Laternen** (die echte in Laternengelb, zwei falsche in Cyan und Magenta) und eine **Krone aus Lichtfäden**. Im gewaltigen Maul bricht sich das Licht in **glasklaren Zähnen**. Kleine, kluge Augen. **Schillernd:** „Sonnenlumina“, goldene Ornamente, alle drei Laternen weißgold. |

#### 5.5 Welt 5 – Glutgrotte (Nr. 081–100)

Hinweis Glut: Glühende Partien bekommen wie in Welt 4 eine Emissionsmaske. 2-Frame-„Glutpuls“-Animationen nur über einen Palette-Swap der Glutfarben, nicht durch neue Frames.

| Nr | Name | Basis | Seltenheit | Größe | Tiefe | Zeit · Wetter | Drill · K | Punkte | Pixel-Art-Beschreibung |
|---|---|---|---|---|---|---|---|---|---|
| 081 | **Teufelsloch-Kärpfling** | echt (*Cyprinodon diabolis*) | Gewöhnlich | S 32×16 · 2–4 cm | 0–5 m (Thermalbecken) | Immer | Zappler · K1 | 55 | Winziger, gedrungener Kärpfling in **schillerndem Kobaltblau** mit **schwarzem Saum an der Schwanzflosse**. Für die Lesbarkeit groß gezeichnet. Lexikon: „Lebt in Wirklichkeit nur in einer einzigen warmen Wasserhöhle in Nevada und ist dort stark bedroht. Hier unten hat er ein zweites Zuhause gefunden.“ **Schillernd:** Glutorange mit goldenem Saum. |
| 082 | **Magadi-Tilapia** | echt (*Alcolapia grahami*) | Gewöhnlich | S 32×16 · 6–15 cm | 0–8 m | Tag | Zickzack · K2 | 60 | Kleiner Buntbarsch aus heißen Sodaseen, **silbrig blau** mit **dunklen Querstreifen**. Männchen haben **hellblaue Lippen** und einen orangen Flossenrand. **Schillernd:** Eisblau-Silber. |
| 083 | **Aschegrundel** | Fantasie (Grundel-Basis) | Gewöhnlich | S 32×16 · 6–12 cm | 5–20 m | Immer · Aschenregen | Versteckspieler · K2 | 60 | Grundel in **Aschgrau mit dunkleren Rußflecken**. Die Rückenflosse hat **glimmende orange Ränder** wie verglimmendes Papier. Auf der Flucht pustet sie **kleine Aschewölkchen** (3-Frame-Partikel). **Schillernd:** Hellblau-Weiß mit cyanfarbenen Rändern. |
| 084 | **Funkenflitzer** | Fantasie | Gewöhnlich | S 32×16 · 5–10 cm | 0–10 m | Nacht | Sprinter · K2 | 65 | Winziger, **pfeilförmiger, glutgelber** Fisch, der eine **Funkenspur** hinter sich herzieht (2–4 Pixel, die nachglühen und verblassen). Leuchtend weiße Augen. Der Schwarm sieht aus wie eine Handvoll Wunderkerzen. **Schillernd:** Blauweiße Eisfunken. |
| 085 | **Schlot-Aalmutter** | echt (*Thermarces cerberus*) | Gewöhnlich | M 64×32 · 30–60 cm | 10–25 m (Schwefelschlote) | Immer | Ruhig · K3 | 70 | **Rosa-weißlicher, aalartiger** Körper mit **dickem Kopf und wulstigen Lippen**, winzigen Augen und durchgehendem Flossensaum. Lebt in Wirklichkeit an heißen Tiefseeschloten und liegt gern zwischen Röhrenwürmern. **Schillernd:** Eisblau mit silbernem Saum. |
| 086 | **Bimsstein-Barsch** | Fantasie (Barsch-Basis) | Gewöhnlich | M 64×32 · 20–40 cm | 0–10 m | Immer · Ausbruch | Springer (zieht nach oben) · K3 | 75 | Ein Körper aus **porösem, hellgrauem Bimsstein** mit **vielen kleinen Löchern** (dunkle Einzelpixel). Flossen aus dünnen Steinplättchen, schwach orange glühende Augen. Er **treibt an der Oberfläche** wie ein Korken. Lexikon: „Schwimmt nicht. Treibt.“ **Schillernd:** Eisweißer Bimsstein mit cyanfarbenen Augen. |
| 087 | **Schwefelkarpfling** | Fantasie (Karpfen-Basis) | Gewöhnlich | M 64×32 · 25–50 cm | 5–20 m | Immer | Brocken · K4 | 80 | Gedrungener Karpfen in **knalligem Schwefelgelb** mit **grünlichen Kristallschuppen** auf dem Rücken (kleine Rautenpixel) und dicken Lippen. Eine **kleine grüne Stinkwolke** umgibt ihn (Partikel in 2 Grüntönen). Lexikon: „Riecht nach faulen Eiern. Fang ihn trotzdem.“ **Schillernd:** Mintweiß mit hellblauen Kristallen. |
| 088 | **Obsidian-Schuppling** | Fantasie | Gewöhnlich | M 64×32 · 20–45 cm | 20–40 m | Immer | Ruhig · K4 | 90 | **Schwarze, glasartig glänzende Obsidianschuppen**, in denen sich das **Lavalicht als orange Reflexstreifen** spiegelt (scharfe 1-px-Highlights, diagonale Kanten wie Glasbruch). Rote Augen. **Schillernd:** Silberglas mit cyanfarbenen Reflexen. |
| 089 | **Kristall-Höhlensalmler** | Fantasie (Blindsalmler-Basis) | Ungewöhnlich | M 64×32 · 8–15 cm | 20–40 m (Kristallhöhlen) | Immer · Kristallköder | Zickzack · K3 | 140 | **Augenloser**, blass **rosa-weißer** Fisch (Vorbild: der echte Mexikanische Blindsalmler). Auf seinem Rücken wachsen **kleine violette Amethystkristalle**, rosa Adern schimmern durch. Wo die Augen wären, ist nur glatte, leicht schimmernde Haut. **Schillernd:** Eisblau mit weißen Kristallen. |
| 090 | **Glutbarsch** | Fantasie (Barsch-Basis) | Ungewöhnlich | M 64×32 · 25–50 cm | 40–55 m (Magmakammer) | Immer | Hitzkopf · K5 | 150 | Barsch mit einer **schwarzen, erkalteten Lavakruste** als Haut. Durch ihre **Risse pulsiert oranges Glühen** (Glutpuls in den Risslinien). Die Stacheln der Rückenflosse sehen aus wie Flammenzungen, heißer Dampf steigt auf. **Schillernd:** Eisblaue Risse in silberner Kruste. |
| 091 | **Salamanderfisch** | Fantasie (Axolotl × Feuersalamander) | Ungewöhnlich | M 64×32 · 20–40 cm | 10–30 m | Nacht · Dampfnebel | Versteckspieler · K4 | 160 | **Glänzend schwarzer** Körper mit **leuchtend gelb-orangen Flecken** wie ein Feuersalamander. Seitlich am Kopf flackern **gefiederte Kiemenbüschel aus kleinen Flammen** (wie beim Axolotl). Freundliches Lächeln, vier kleine Stummelbein-Flossen. **Schillernd:** Weiß mit cyanfarbenen Flecken und Eiskiemen. |
| 092 | **Dampfkugler** | Fantasie (Kugelfisch-Basis) | Ungewöhnlich | M 64×32 · 15–35 cm | 5–20 m | Immer · Dampfnebel | Aufbläher · K4 | 180 | Runder, **kupferroter** Kugelfisch mit **Nietenpunkten** wie ein alter Dampfkessel. Er bläht sich mit **heißem Dampf** auf und **pfeift wie ein Teekessel**. Zweites Sprite: aufgeblasen, ein Dampfstrahl aus dem Maul, die Stacheln sehen aus wie kleine Ventile. **Schillernd:** Kessel in Silber-Cyan. |
| 093 | **Magma-Muräne** | Fantasie (Muränen-Basis) | Ungewöhnlich | L 96×48 · 80–160 cm | 40–55 m | Nacht | Versteckspieler + Hitzkopf · K6 | 210 | Eine lange Muräne aus **flüssiger Lava**: Der Körper **glüht orange-gelb** unter einer dunkelroten **Krustenschicht**, die langsam fließt (Palette-Cycling). Das Maul glüht von innen weißgelb. Idle-Pose: schaut aus einem **Basaltloch**. Zahnfisch. **Schillernd:** Blauweißes „Eismagma“. |
| 094 | **Phönixflosser** | Fantasie | Selten | L 96×48 · 40–80 cm | 0–15 m | Immer · Ausbruch **(Pflicht)** | Springer · K6 | 400 | Schlanker Fisch mit **Flossen aus Flammenfedern** (Verlauf Rot → Orange → Gelb in Federzacken) und einem **langen Schweifschwanz wie ein Phönix**. Auf dem Kopf eine goldene Krone aus drei Federn. Beim Sprung regnet es Funken. Lexikon: „Wenn er verglüht, schlüpft er aus seiner eigenen Asche neu.“ **Schillernd:** Eisphönix mit blauweißen Federn. |
| 095 | **Basaltwels** | Fantasie (Wels-Basis) | Selten | XL 128×64 · 150–250 cm | 40–60 m | Nacht | Taucher · K7 | 420 | Ein großer Wels, dessen Haut aus **sechseckigen Basaltplatten** besteht (Hexagonmuster in Basaltgrau mit dunklen Fugen). Aus den **Fugen schimmert es rot**. Barteln wie erkaltete Lavafäden, kleine glühende Augen. **Schillernd:** Helles Silbergrau mit eisblauen Fugen. |
| 096 | **Amethyst-Panzerfisch** | Fantasie (*Dunkleosteus*-Basis) | Selten | XL 128×64 · 150–300 cm | 20–40 m (Kristallhöhlen) | Immer · Kristallköder | Brocken · K8 | 450 | Urzeitlicher **Panzerfisch** nach dem Vorbild Dunkleosteus. Sein **Kopfpanzer besteht aus Amethyst-Kristallplatten** (facettiert, violett mit hellen Kanten), statt Zähnen hat er **scherenartige Knochenkiefer**. Hinterleib dunkelgrau und haiartig. Lexikon: „Lebte vor 360 Millionen Jahren. Hat nie erfahren, dass er ausgestorben ist.“ **Schillernd:** Klarer Bergkristall mit Cyan-Schimmer. |
| 097 | **Irrlicht-Geisterfisch** | Fantasie (mystisch) | Selten | M 64×32 · 20–40 cm | 20–40 m | Nacht · Runennacht **(Pflicht)** | Blinker · K5 | 500 | Ein **geisterhafter, violett leuchtender Fisch** aus **kalten Flammen**. Der Körper ist nur ein heller Umriss mit flackernden Flammenzungen (Kristallviolett → Rosa), am Schwanz „zerfasert“ er ohne feste Kontur. Zwei weiße, leere Augen. Teleportiert sich im Drill. **Schillernd:** Grün-türkises Irrlicht. |
| 098 | **Feuerdrachen-Koi** | Fantasie (Koi-Basis) | Episch | XL 128×64 · 80–140 cm | 0–20 m | Nacht · Ausbruch | Springer · K8 | 1000 | Majestätischer Koi in **Rot-Gold** mit **langen, wehenden Drachenbarteln** und **kleinen Hörnern**. Die Schuppen haben **goldene Kanten**, die **Flossen sind lodernde Flammen**. Nach der Legende ist er den Lavafall hinaufgeschwommen und zum Drachen geworden (Anspielung auf die asiatische Koi-Legende). **Schillernd:** Eisdrachen-Koi in Weiß-Blau-Silber. |
| 099 | **Felsenfresser** | Fantasie (Zackenbarsch-Basis, Golem) | Episch | XL 128×64 · 200–300 cm | 40–60 m | Immer · Erdbeben **(Pflicht)** | Brocken · K9 | 1100 | Riesiger **Zackenbarsch aus Felsbrocken**: Sein Körper ist aus Basalt- und Granitsteinen zusammengesetzt, zwischen denen ein **Lavakern** durchglüht. Auf dem Rücken wachsen Kristalle. Das riesige Maul zermalmt Steine (Gesteinskrümel-Partikel), die glühenden Augen schauen gutmütig. Lexikon: „Frisst Felsen. Zum Nachtisch Kristalle.“ **Schillernd:** Marmorweiß mit eisblauem Kern. |
| 100 | **Ignaris, der Lavadrachenfisch** | Fantasie | Legendär · Boss | Boss 256×128 · 800–1.200 cm | 55–60 m | Nacht · Großer Ausbruch **(Pflicht)** | Boss: Zickzack+Hitzkopf → Feuerodem → Springer → Drachenzorn · K10 | 3000 | Schlangenartiger **Drachenfisch** mit nach hinten geschwungenen **Obsidianhörnern**, einem Drachenmaul voller Fangzähne und **Schuppen wie schwarzer Basalt mit glühenden Kanten**. Sein **Bauch ist flüssige Lava** (Fließanimation, Glutgelb → Magmarot). Über den Rücken zieht sich ein **Flammenkamm**, die Flossen sind wie Drachenflügel mit Lavaadern. **Glühende Tropfen** fallen von ihm herab (Partikel), die Augen glühen weiß. **Schillernd:** „Frost-Ignaris“: Obsidian wird Silber, Lava wird leuchtendes Eisblau. |

#### 5.6 Kontrolle der Verteilung

| Welt | Gewöhnlich | Ungewöhnlich | Selten | Episch | Legendär | Summe | Echt / Fantasie |
|---|---|---|---|---|---|---|---|
| 1 Sonnenspiegelsee | 8 | 5 | 4 | 2 | 1 | 20 | 15 / 5 |
| 2 Regenbogenriff | 8 | 5 | 4 | 2 | 1 | 20 | 16 / 4 |
| 3 Frostfjord | 8 | 5 | 4 | 2 | 1 | 20 | 12 / 8 |
| 4 Leuchtende Tiefe | 8 | 5 | 4 | 2 | 1 | 20 | 15 / 5 |
| 5 Glutgrotte | 8 | 5 | 4 | 2 | 1 | 20 | 3 / 17 |
| **Gesamt** | **40** | **25** | **20** | **10** | **5** | **100** | **61 / 39** |

Die Fantasie-Arten nehmen zur letzten Welt hin bewusst zu. So wird der Sprung von „echter Natur“ zu „Mythos“ zum Fortschrittsgefühl. In den höheren Seltenheiten überwiegt Fantasie: Von den 15 Episch- und Legendär-Fischen sind 12 Fantasie-Arten.

**Verteilung der Drill-Verhalten** (damit jede Welt abwechslungsreich bleibt): In jeder Welt kommen mindestens 6 verschiedene Verhalten vor. Die weltspezifischen Verhalten (Aufbläher W2/W5, Stromer W4, Blinker W4/W5, Hitzkopf W5) kündigen jeweils die Spezialmechanik der Welt an.

---

## TEIL F – PIXEL-ART-PIPELINE FÜR 100 DETAILLIERTE FISCHE

### F0. Grundidee

Du kannst nicht selbst malen, aber du kannst Bild-Dienste aufrufen, Pixel mit Python exakt bearbeiten und das Einbauen ins Spiel automatisieren. **Einheitlichkeit bei 100 Fischen entsteht nicht durch bessere Bild-Prompts, sondern dadurch, dass ein Skript jedes Bild auf dieselben harten Regeln zwingt** (Palette, Raster, Outline, Licht, Augenform). Animationen werden **aus einem freigegebenen Standbild per Code abgeleitet**, nicht pro Frame neu generiert.

Wichtig: **Ab Tag 1 gibt es für jeden der 100 Fische ein Sprite** (prozedural, F8). So läuft das Gameplay sofort. Bessere Grafiken ersetzen die Dateien später 1:1 unter demselben Namen.

### F1. Verbindlicher Style Guide

- **Maßstab:** 640×360 Referenz, PPU 32, keine gemischten Pixelgrößen, keine skalierten Sprites (Größenunterschiede nur über die Canvas-Klasse).
- **Canvas je Größenklasse** (Fisch schaut **nach rechts**, mittig, ≥ 2 px transparenter Rand):
  - S: 32×16 · M: 64×32 · L: 96×48 · XL/Legendär: 128×64 · Boss: 192×96 bis 256×128
  - Die Größenangaben in den Fischtabellen (Teil E) sind verbindlich.
- **Palette:** eine Master-Palette (~64 Farben), pro Welt eine Teilpalette mit 24–32 Farben in Rampen zu 4–5 Stufen **mit Farbtonverschiebung** (Schatten kühler und satter, Lichter wärmer). **Pro Fisch max. 12 Farben (S) bzw. 16 (M–XL)**, Bosse 24. Kein reines Schwarz, kein reines Weiß außer im Augenlicht.
- **Licht immer von oben links:** Rücken mit Glanzkante, Bauch im kühlen Schatten. **Kein Pillow-Shading** (Schatten rundum am Rand).
- **Outline:** 1 px, geschlossen, in der dunkelsten Stufe der Hauptfarbe (nicht #000). Selektiv: oben/links eine Stufe heller, unten/rechts am dunkelsten. Innenlinien (Kiemen, Flossenstrahlen, Schuppenreihen) eine Stufe dunkler als die Nachbarfarbe. Saubere Treppenlinien (1-2-3), keine Doppelpixel-Ecken.
- **Auge:** dunkle Pupille (S: 1×1, M: 2×2), **genau 1 weißes Highlight-Pixel oben links**. Ab L ein Iris-Ring.
- **Details ab Größe L:** Schuppen als versetztes Halbmond-Raster, Flossenstrahlen, Seitenlinie, Lichtreflex auf dem Rücken. Genau das macht den Look „detailliert“.
- **Dithering:** auf Fischen keines (Ausnahme: Schachbrett auf großen einfarbigen Flächen ab L). In Hintergründen nur geordnetes 2×2-Bayer-Dithering für Verläufe. Nie Fehlerdiffusion.
- **Alpha binär** (0 oder 255), kein Anti-Aliasing an der Silhouette.
- **Lesbarkeit:** Fische heben sich durch Outline und Sättigung vom Hintergrund ab. Jede Silhouette einer Welt unterscheidet sich klar von den anderen.
- **Hintergründe pro Welt:** Parallax-Ebenen (Himmel, Ferne entsättigt, Mitte, Ufer/Steg, Wasseroberfläche animiert, Unterwasser-Tiefenschichten, Vordergrund), 960 px breit, horizontal kachelbar. Tageszeit über Paletten-Overlays (Morgenrosa, Mittagsklar, Abendgold, Nachtblau).
- **Figuren:** Spieler-Angler (anpassbar: Hut, Farbe, Boot), Opa Otto, Möwe Mops, Wetterfrosch Fridolin – gleiche Regeln, eigene Rampen.

### F2. Ablauf

```
Data/fish_db.json (100 Einträge: id, name, welt, größe, seltenheit, körperform, muster, farben, merkmale)
 → [1] Stil-Anker: pro Welt 3 Fische (1 Gewöhnlich, 1 Selten, 1 Legendär) erzeugen
       → Kontaktbogen an mich → ICH gebe frei („goldene Referenzen“)
 → [2] Generierung der übrigen Fische (Bild-KI aus F4, sonst prozedural F8), immer mit Weltpalette + Ankerbildern
 → [3] tools/art/pixelize.py: Freistellen (Magenta-Key) → Raster erkennen → Nearest-Downscale
       → quantize(Weltpalette, Dither NONE) → Alpha binär → Waisenpixel entfernen
       → Outline neu aus Alpha-Maske → Auge prüfen → Ausrichtung, Canvas, Pivot
 → [4] tools/art/qa.py: automatischer Bericht + Kontaktbogen pro Welt (3× Spielmaßstab, heller und dunkler Hintergrund)
 → [5] tools/art/animate.py: Swim / Idle / Struggle / Caught aus dem Standbild (F5)
 → [6] tools/art/pack.py: Texture-Atlas pro Welt (PNG + JSON im Phaser-Atlas-Format, Padding 2 px, Extrude 1 px)
       → public/assets/fish/<welt>/atlas_fish_<welt>.png/.json
 → [7] Spiel: Animationen werden beim Laden automatisch aus den Frame-Namen erzeugt
       (fish_<welt>_<nr>_<name>_<clip>_<frame>, Bildraten aus F5); Test prüft, dass jeder der 100 Fische alle Clips hat
```
Zu jedem Bild Prompt, Seed, Modell und Parameter als `<name>.gen.json` speichern (reproduzierbar).

### F3. Bild-Prompt-Vorlage (Bildmodelle bekommen englische Prompts; der STYLE-LOCK-Block bleibt bei jedem Fisch Wort für Wort gleich)

```
STYLE LOCK (identical for every fish):
High-detail 16-bit era pixel art sprite for a fishing collection game, crisp hard-edged pixels
on a strict grid, no anti-aliasing, no blur, no gradients. A single fish in pure side view facing
right, centered, whole body visible including all fins, filling about 80% of the frame width.
Light comes from the upper left: the back carries a bright rim highlight, the belly sits in cool
shadow, shading uses 4-5 hue-shifted tones per color. A clean 1-pixel dark outline in the darkest
shade of the body color surrounds the silhouette; inner lines for gills, scales and fin rays.
A round eye with a dark pupil and one single white highlight pixel at its upper left.
Plain flat solid magenta (#FF00FF) background, no ground shadow, no water, no bubbles.

SUBJECT:
[NAME], a [SIZE CLASS] [BODY SHAPE] fish from the [WORLD].
Body colors: [MAIN] fading to a [BELLY] belly; pattern: [PATTERN].
Fins: [FIN DETAIL]. Distinctive feature: [FEATURE]. Mood: [MOOD].
Palette limited to the attached world palette. Match the style of the attached reference fish exactly.
[Canvas: Zielgröße bei Pixel-Modellen | 1024x512 bei allgemeinen Modellen]
No text, no watermark, no border.
```
Korrekturen per Bild-Edit: „Change only: … Keep unchanged: silhouette, palette, outline, eye, lighting direction, size, framing.“ Immer **ein Fisch nach dem anderen**, nie mehrere in einem Bild.

### F4. Bild-Dienste (nur nach meiner Freigabe, kosten Credits)

1. **PixelLab** (bevorzugt): gehosteter MCP-Server, direkt aus Claude Code nutzbar. Stil-Referenzen, Farbreduktion, Animation, Hintergrund entfernen. Vor jedem Batch Guthaben abfragen.
2. **Retro Diffusion** (API): `input_palette` = Weltpalette, `remove_bg = true`, bis zu 9 `reference_images`, Animationen aus einem Eingangsbild. `check_cost: true` liefert vorher den Preis.
3. **Allgemeine Bildmodelle** (Gemini/FLUX o. ä.): nur als Konzeptquelle, danach **immer** durch `pixelize.py`.

Vor jedem Batch: Anzahl Bilder × Preis pro Bild als Schätzung an mich, erst nach meinem Ja starten.

### F5. Animationen

| Clip | Frames | FPS | Erzeugung |
|---|---|---|---|
| Swim (Loop) | 6 (S: 4) | 10 | Körper in senkrechte Spalten zerlegen; Spalten hinter dem vorderen Drittel um `round(A·sin(2π·t/N + k·x))` px versetzen; A = 1 px (S/M), 2 px (L/XL), zum Schwanz hin steigend; Schwanzflosse in Frame 2 und 5 um 1 px gestaucht; danach Outline neu ziehen |
| Idle (Loop) | 4 | 6 | Brustflosse ±1 px, Kiemen-Pixel blinkt in Frame 3, Körper 1 px auf und ab |
| Struggle | 4 | 14 | wie Swim mit doppelter Amplitude und ±1 px Zittern |
| Caught | 1 + 2 | 8 | Pose 20° nach oben gekippt (vorab gebacken mit Pixel-Rotation: 8× Nearest hoch → drehen → runter), dann 2 Zappel-Frames, Glanzpixel blinkt |
| Boss-Extras | je nach Boss | – | Angriffs- und Phasenwechsel-Animation (Brüllen, Aufblähen, Leuchten); Bosse dürfen aus Einzelteilen (Kopf, Körper, Schwanz, Flossen) bestehen, die per Code bewegt werden – jede Bewegung auf ganze Pixel gerundet. Alle anderen Fische nur Frame-Animation. |

- **Schillernd-Variante:** Palette-Swap-Shader in Phaser 4 (Rotkanal = Palettenindex, LUT-Textur 256×1 mit Nearest-Filter; Zeilen: Normal / Schillernd / Silhouette fürs Lexikon) + Glitzer-Partikel. Einfacher Fallback: Schillernd-PNG in `pixelize.py` vorab backen.
- **Zusätzliches Wackeln im Spiel (optional):** eigener Phaser-4-Filter/Shader mit Sinus-Versatz, **auf ganze Texel gerundet** (`floor`), Kopf per Maske fixiert. Die gebackenen Frames bleiben die Grundlage.

### F6. Automatische Qualitätsprüfung (`qa.py`) – jedes Sprite muss bestehen

- [ ] Canvas exakt in der Größenklasse, Blick nach rechts, ≥ 2 px Rand
- [ ] Alle Farben aus der Weltpalette, Farbanzahl ≤ Limit
- [ ] Alpha nur 0/255, keine Waisenpixel
- [ ] Silhouette lückenlos mit 1 px Outline umschlossen, keine Doppel-Outline
- [ ] Genau ein weißes Augen-Highlight, oben links in der Pupille
- [ ] Hellster Bereich liegt oben links vom Körpermittelpunkt (Lichtprobe)
- [ ] Silhouette unterscheidet sich von allen Fischen derselben Welt (Überlappung IoU < 0,85)
- [ ] Animation: gleiche Framegröße, Pivot driftet nicht, Loop springt nicht
- [ ] Sichtprüfung am Kontaktbogen in Spielgröße vor hellem und dunklem Weltgrund
- [ ] `gen.json` vorhanden

Nach jeder Welt schickst du mir den Kontaktbogen der 20 Fische als Bild.

### F7. Welten, Tiles, Effekte

- Tileset pro Welt mit Kanten- und Eck-Tiles (automatisches Setzen der passenden Kante per Code oder Tiled), Deko-Sprites (Schilf, Seerosen, Steg, Korallen, Eisschollen, Laternenquallen, Lavaadern).
- Wasseroberfläche: animierte Glanzlinien, Lichtstrahlen (Caustics) als additive Sprites, aufsteigende Blasen, Partikel für Regen, Schnee, Meeresschnee, Asche.
- Tiefe = dunkler: Abdunkel-Ebene pro Tiefenschicht; in Welt 4 fast nur noch Licht von Köderlampe und Leuchtfischen.
- Wetter-Effekte: Regen-Ringe auf dem Wasser, Blitze (beleuchten alle Schatten 0,5 s), Nebel als Parallax-Schicht.

### F8. Ohne Bild-KI: prozeduraler Generator `tools/art/fishgen.py`

Erzeugt alle 100 Fische aus den Parametern in `fish_db.json` – das ist zugleich der Platzhalter ab Tag 1:
1. **Silhouette:** Körperprofil-Kurve (Länge, Höhe, Lage der größten Höhe, Schnauzenform), Schwanztyp (gegabelt, rund, sichelförmig, Aal), Flossen als Polygon-Vorlagen, gerastert auf den Ziel-Canvas.
2. **Schattierung:** Distanzfeld zur Silhouette → Pseudo-Normale → Licht von oben links → Rampenstufe; Bauch über Höhenverlauf in die Bauchrampe.
3. **Muster:** Streifen, Punkte, Netz, Sattelflecken als Masken, die die Rampe um eine Stufe verschieben; Schuppen-Halbmondraster ab L.
4. **Details:** Kiemenbogen, Flossenstrahlen, Auge nach Regel, selektive Outline.
5. **Legendäre Fische und Bosse:** von dir **von Hand als Zeichenraster in JSON** geschrieben (ein Zeichen = Palettenindex, z. B. `"..aaB.."`), `fishgen.py` rendert sie. Hier lohnt sich besondere Sorgfalt.
6. **Hintergründe:** Himmel mit Bayer-Verlauf, Berg-/Baum-/Riffsilhouetten aus 1D-Noise je Ebene, Wasser-Glanzlinien, Deko nach denselben Regeln.

---

## TEIL G – DATENSCHEMA

### 6. Datenschema (TypeScript-Typen, CSV/JSON)

#### 6.1 Grundsätze

- **Eine Quelle der Wahrheit:** Die Fischliste wird in einer **Tabelle** gepflegt (Google Sheets oder Excel) und als `Data/fish.csv` exportiert. Das Build-Skript `tools/build-data.ts` (`npm run data`) prüft sie und erzeugt daraus:
  - `public/data/fish_db.json`: Diese Datei lädt das Spiel, und die Python-Art-Pipeline liest sie ebenfalls (siehe Teil F).
  - die Text-Schlüssel in `src/i18n/de.json` / `en.json`
- Alle Typen stehen in `src/data/types.ts`. Client (Phaser/Vite) und Edge Functions (Deno) nutzen dieselben Typen.
- **IDs statt Namen:**
  - Fische `F001`–`F100`
  - Welten `W1`–`W5`
  - Ruten `R01`… / `RW1`… / `RG`
  - Schnüre `L01`…, Rollen `RO1`…, Köder `K01`…
  - Querverweise (Welt, Köder, Ruten, Ausrüstung) sind immer IDs als String, keine Objektreferenzen.
  - Im Netzwerk (siehe Teil B4) wird nur die Lexikonnummer als Zahl (`1`–`100`) übertragen.
- **Enum-Werte ohne Umlaute** (`Gewoehnlich`, `Aufblaeher`). Angezeigte Texte kommen aus Lokalisierungs-Schlüsseln (`fish.001.name`, `fish.001.lexicon`, `fish.001.hint`) in `src/i18n/*.json`. So bleibt alles Deutsch und eine spätere Übersetzung ist trotzdem möglich (siehe Teil B).
- **Grafik und Audio** werden über Schlüssel bzw. Pfade angesprochen: Frame-Namen im Textur-Atlas, PNG-Pfade (LUTs, Paletten) und Audio-Keys. Farben sind Hex-Strings (`"#FFFFFF"`).
- **CSV-Format:**
  - Trennzeichen **Semikolon** `;` (deutsches Excel öffnet das direkt richtig)
  - Dezimalpunkt `.`, UTF-8
  - Mehrfachwerte mit `|` getrennt
  - leere Zelle = Standardwert (setzt das Zod-Schema per `.default()`)
- **Spielerdaten:** Statische Spieldaten (Fische, Welten, Ausrüstung) werden als JSON mit dem Client ausgeliefert. Dauerhafte Spielerdaten liegen in Supabase-Tabellen (Postgres): Lexikon-Einträge, Münzen, Perlen und Rekorde. Geschrieben werden sie **nur von einer Edge Function**. Sie prüft Fänge gegen dieselbe `fish_db.json` (z. B. Punkte und Längenband). Der Client hat nur Leserechte (RLS). Das vollständige Tabellenschema steht in Teil B.

#### 6.2 Enums (String-Literal-Typen)

Jedes Enum ist ein `as const`-Array. Daraus entsteht der Union-Typ, und dasselbe Array nutzt auch das Zod-Schema (6.8). **Flags** werden zu Arrays: `[]` = None, `["Immer"]` bzw. `["Alle"]` = alles. Wo eine kompakte Bitmaske nötig ist, entspricht die Position im Array der Bitposition.

```ts
// src/data/types.ts
export const RARITIES = ['Gewoehnlich', 'Ungewoehnlich', 'Selten', 'Episch', 'Legendaer'] as const;
export type Rarity = (typeof RARITIES)[number];

export const SIZE_CLASSES = ['S', 'M', 'L', 'XL', 'Boss'] as const;   // 32x16, 64x32, 96x48, 128x64, 256x128
export type SizeClass = (typeof SIZE_CLASSES)[number];

export const FIGHT_BEHAVIORS = [
  'Ruhig', 'Zappler', 'Sprinter', 'Taucher', 'Springer', 'Zickzack', 'Brocken',
  'Trickser', 'Versteckspieler', 'Aufblaeher', 'Stromer', 'Blinker', 'Hitzkopf',
] as const;
export type FightBehavior = (typeof FIGHT_BEHAVIORS)[number];

export const TIMES_OF_DAY = ['Morgen', 'Tag', 'Abend', 'Nacht', 'Immer'] as const;   // Flags
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

// Generische Wetter-Schlüssel. Jede Welt gibt ihnen eigene Anzeigenamen
// (z. B. Sonnig = "Klar" im Frostfjord, "Ruhige See" in der Tiefe, "Ruhig" in der Glutgrotte).
export const WEATHERS = [
  'Sonnig', 'Bewoelkt', 'Regen', 'Gewitter', 'Nebel',
  'Schnee', 'Schneesturm', 'Sturm', 'Duenung',
  'Aschenregen', 'Dampfnebel', 'Erdbeben', 'Alle',
] as const;                                                                          // Flags
export type Weather = (typeof WEATHERS)[number];

export const WORLD_EVENTS = [
  'Keins', 'Vollmond', 'Sommergewitter', 'Mueckenschwarm',                 // W1
  'Flut', 'Ebbe', 'Korallenbluete', 'DelfinBesuch',                        // W2
  'Polarlicht', 'Walgesang', 'Eisbergkalbung',                             // W3
  'Meeresschnee', 'BiolumineszenzWelle', 'SchwarzerRaucher', 'Walfall',    // W4
  'Ausbruch', 'GrosserAusbruch', 'Runennacht',                             // W5
] as const;
export type WorldEvent = (typeof WORLD_EVENTS)[number];

export const HORIZONTAL_ZONES = ['Ufer', 'Freiwasser', 'Kante', 'Alle'] as const;    // Flags
export type HorizontalZone = (typeof HORIZONTAL_ZONES)[number];

export const LINE_PROTECTIONS = ['Kaelte', 'Druck', 'Hitze'] as const;              // Flags
export type LineProtection = (typeof LINE_PROTECTIONS)[number];

export const WORLD_MECHANICS = [
  'HaengerUndFutterplatz', 'StroemungUndGezeiten', 'EisloecherUndFrost', 'DunkelheitUndDruck', 'HitzeUndAusbrueche',
] as const;
export type WorldMechanic = (typeof WORLD_MECHANICS)[number];

export const BOSS_SPECIALS = [
  'Keine', 'KrautHaenger', 'Blitzsprung',                 // Barnabas
  'StroemungsWirbel', 'WanderndeZone', 'Salto',           // Coralina
  'EislochZufrieren', 'Tiefensog', 'Frostatem',           // Grimmbart
  'DreiZonen', 'Lichtblitz', 'Schlund',                   // Lumina
  'Feuerodem', 'Lavabomben', 'Drachenzorn',               // Ignaris
] as const;
export type BossSpecial = (typeof BOSS_SPECIALS)[number];

export const ROD_ABILITIES = [
  'Keine', 'TaucherKonter', 'WindImmun', 'StarkerKonter', 'HaengerLeicht', 'StroemungHalb',
  'KaelteImmun', 'LampePlusEins', 'HitzeMinus30', 'SchillerndGlobal',
] as const;
export type RodAbility = (typeof ROD_ABILITIES)[number];

export const UNLOCK_SOURCES = ['Start', 'Shop', 'Sammlung', 'Komplett'] as const;
export type UnlockSource = (typeof UNLOCK_SOURCES)[number];

// ID-Typen
export type FishId = `F${string}`;   export type WorldId = `W${1 | 2 | 3 | 4 | 5}`;
export type RodId = string;          export type LineId = string;
export type ReelId = string;         export type BaitId = string;
export type Size = { w: number; h: number };
export type Range = { min: number; max: number };
```

#### 6.3 FishData

`FishData` entsteht beim Laden aus der `fish_db.json` (`src/data/db.ts`). Text-Schlüssel und Asset-Keys werden dabei über die Namenskonvention aus der Lexikonnummer gebildet.

```ts
export interface FishData {
  // Identität
  id: FishId;                     // "F001"
  lexiconNumber: number;          // 1..100
  nameKey: string;                // "fish.001.name"  → "Rotauge"
  displayNameDe: string;          // Fallback / Debug-Anzeige
  speciesBasis: string;           // "Rutilus rutilus" oder "Riesenhecht"
  isFantasy: boolean;
  world: WorldId;
  rarity: Rarity;
  isBoss: boolean;
  lexiconKey: string;             // "fish.001.lexicon" (Witz-/Infotext)
  hintKey: string;                // "fish.001.hint"   ("Gesichtet"-Hinweis)

  // Darstellung (Frame-Namen im Fisch-Atlas bzw. PNG-Pfade)
  sizeClass: SizeClass;
  canvasSize: Size;               // z. B. {w:32,h:16}; Boss {w:256,h:128}
  swimFrames: string[];           // fish_001_swim_0 … _5 (6 Frames)
  struggleFrames: string[];       // Drill-Zappeln
  catchSprite: string;            // Fang-Präsentation (Blobfisch: andere Form!)
  altSprite?: string;             // aufgeblasen / Segel hoch / Kiefer vor (optional)
  silhouette: string;             // automatisch aus Alpha erzeugt
  shinyLut: string;               // 256x1-PNG, Palette-Swap-LUT (Teil F)
  emissionMask?: string;          // nur Leuchtpixel (W4/W5, Glühwürmchen-Barsch …)
  glowsInDark: boolean;
  artBriefDe: string;             // Pixel-Art-Beschreibung aus der Tabelle
  shinyBriefDe: string;

  // Größe & Gewicht
  lengthMinCm: number;
  lengthMaxCm: number;
  weightFactorK: number;          // Gewicht(g) = k × Länge(cm)^3; Standard 0.011

  // Spawn
  depthMinM: number;
  depthMaxM: number;
  zones: HorizontalZone[];        // Standard ["Alle"]
  timeMask: TimeOfDay[];          // Standard ["Immer"]
  requiredWeather: Weather[];     // Pflicht (sonst Gewicht 0); Standard ["Alle"]
  preferredWeather: Weather[];    // ×2; Standard []
  requiredEvent: WorldEvent;      // Pflicht-Ereignis; Standard "Keins"
  preferredEvent: WorldEvent;     // ×2; Standard "Keins"
  favoriteBaits: BaitId[];        // ×2
  dislikedBaits: BaitId[];        // ×0,3
  spawnWeightOverride: number;    // <0 = Standard aus Seltenheit; Standard -1
  schooling: boolean;
  schoolSize: Range;              // Standard {min:1,max:1}

  // Biss
  nibbleMin: number;              // Standard 0
  nibbleMax: number;              // Standard 2
  biteWindowBonusS: number;       // zusätzlich zur Seltenheits-Regel; Standard 0
  hasFakeBites: boolean;          // Trickser / Täuschlichter
  isToothed: boolean;             // Stahlvorfach nötig

  // Drill
  primaryBehavior: FightBehavior;
  hasSecondaryBehavior: boolean;
  secondaryBehavior?: FightBehavior;
  secondaryAtStamina: number;     // 0..1; Standard 0.5
  strength: number;               // 1..10; Standard 3
  staminaOverrideS: number;       // <0 = aus Seltenheit × Größe; Standard -1
  greenZoneModifier: number;      // z. B. -0.3 beim Zuckerwatte-Seepferdchen; Standard 0
  bossPhases: BossPhase[];        // nur Bosse

  // Wert
  basePoints: number;             // = Basis-Verkaufswert
  xpOverride: number;             // <0 = aus Seltenheit; Standard -1
}

export interface BossPhase {
  nameKey: string;                // "boss.020.phase1" → "Kraftprobe"
  hpFrom: number;                 // 0..1, Phase gilt von hpFrom bis hpTo; Standard 1
  hpTo: number;                   // 0..1; Standard 0.7
  behaviors: FightBehavior[];
  special: BossSpecial;
  strength: number;               // Standard 8
  telegraphKey: string;           // Ansage-Text ("Barnabas zieht ins Kraut!")
}
```

#### 6.4 WorldData

```ts
export interface WorldData {
  // Identität
  id: WorldId;                    // "W1"
  index: number;                  // 1..5
  nameKey: string;                // "world.1.name" → "Sonnenspiegelsee"
  themeKey: string;
  coinFactor: number;             // 1.0 / 1.5 / 2.0 / 2.6 / 3.2

  // Optik
  leadPalette: string[];          // 8 Hex-Farben: die Leitfarben aus Abschnitt 4
  fullPalette: string;            // PNG-Pfad, 24–32 Farben, Rampen
  shinyRuleKey: string;           // "Mondlicht", "Neon", …
  depthLayers: DepthLayer[];
  maxDepthM: number;
  uferEndM: number;               // horizontale Zonen (Wurfweite); Standard 6
  freiwasserEndM: number;         // Standard 15
  background: string;             // Key der Parallax-Ebenen
  ambient: string[];              // Keys: Enten, Schildkröten, Robben …
  playerSpots: PlayerSpot[];      // genau 4

  // Wetter & Ereignisse
  weatherTable: WeatherEntry[];
  events: EventEntry[];

  // Spezialmechanik
  mechanic: WorldMechanic;
  mechanicSettings: Record<string, number | boolean>;   // z. B. Strömungs-, Eisloch-Einstellungen

  // Audio (Keys der Audiodateien)
  musicMorgen: string; musicTag: string; musicAbend: string; musicNacht: string;
  musicStorm: string; musicEvent: string; musicBoss: string; musicFinale: string;
  ambienceLoop: string;

  // Inhalt
  fish: FishId[];                 // genau 20
  boss: FishId;
  worldRod: RodId;                // Belohnung 20/20

  // Freischaltung
  previousWorld: WorldId | null;
  requiredSpeciesFromPrevious: number;   // Standard 12
  speciesInsteadOfBoss: number;          // Standard 16
  requiredReputation: number;
  ticketPrice: number;
  requiredGear: string[];         // IDs von Schnur / Rolle / Zubehör
  recommendedTier: number;        // Deckel im Modus "Ausgeglichen"

  // Sammlung
  collectionRewards: CollectionReward[];   // 5, 10, 15, 20, alle Schillernd
}

export interface DepthLayer {
  nameKey: string; minM: number; maxM: number;
  metersPerScreen: number;        // nicht-lineares Scrollen (Welt 4)
  backgroundSlice: string;        // Atlas-Frame
}

export interface PlayerSpot { position: { x: number; y: number }; isBoat: boolean; iceHoles: number }

export interface WeatherEntry {
  weather: Weather[]; weight: number; displayNameKey: string;
  windStrength: number; biteRateMod: number;   // Standard 1
}

export interface EventEntry {
  evt: WorldEvent; chancePerCheck: number; checkIntervalS: number;   // Standard 180
  durationS: number;                           // Standard 60
  allowedTimes: TimeOfDay[];                   // Standard ["Immer"]
  biteRateMod: number; epicMod: number; commonMod: number;           // je Standard 1
}

export interface CollectionReward {
  speciesRequired: number;        // 5/10/15/20; 21 = "alle Schillernd"
  coins: number; pearls: number;
  items: string[];                // IDs: Köder, Hut, Pose, Rute, Bootskin …
  titleKey: string;               // "title.w1" → "Seeflüsterer/in"
  shinyChanceBonus: number;       // Welt-Abzeichen: 1/200 statt 1/250
}
```

#### 6.5 RodData (plus LineData, ReelData, BaitData)

```ts
export interface RodData {
  id: RodId;                      // "R01", "RW1", "RG"
  nameKey: string;                // "rod.r01.name" → "Opas Bambusrute"
  tier: number;                   // 1..6 (Ausgleichsmodus deckelt hierauf)
  source: UnlockSource;
  priceCoins: number;
  pricePearls: number;
  requiredReputation: number;

  // Wurf
  castMaxDistanceM: number;       // Standard 20
  castCycleS: number;             // Ping-Pong-Dauer des Kraftbalkens; Standard 1.2
  perfectWindowMin: number;       // 0..1, bis 1.0; Standard 0.92

  // Drill
  flexGreenZone: number;          // 0..1, Grundbreite der grünen Zone; Standard 0.26
  relief: number;                 // Entlastung (Spannungsabbau); Standard 1.0
  reactionBonusS: number;         // Anschlagfenster +; Standard 0
  counterBonus: number;           // Konter gegen Zugrichtung; Standard 0.30
  sizeMuBonus: number;            // Größen-Würfel (Welt-Ruten); Standard 0

  // Spezial
  ability: RodAbility;
  abilityWorld: WorldId | null;   // null = überall
  abilityAffectsOnlyWorld: boolean;   // bleibt im Ausgleichsmodus aktiv; Standard true

  // Optik
  rodSprite: string;
  bendFrames: [string, string, string, string];   // 4 Biegestufen
  lineColor: string;              // Standard "#FFFFFF"
  lineParticles: string | null;   // Partikel-Config-Key (Goldene Rute)
}

export interface LineData {
  id: LineId; nameKey: string; priceCoins: number; requiredReputation: number;
  breakReserveS: number;          // +s vor Schnurriss
  biteRateBonus: number;          // Fluorocarbon +0.10
  protection: LineProtection[];   // Kaelte | Druck | Hitze
  heatMultiplier: number;         // Hitzeschild 0.5; Standard 1
  maxDepthPressureM: number;      // Standard 1000
}

export interface ReelData {
  id: ReelId; nameKey: string; priceCoins: number; requiredReputation: number;
  crankPower: number;             // Spannungsaufbau; Standard 1
  retrieveSpeed: number;          // Einholtempo; Standard 1
  lineCapacityM: number;          // max. Tiefe; Standard 25
  isDeepSeaWinch: boolean;        // Kapazität nur in W4, sonst fallbackCapacityM
  fallbackCapacityM: number;      // Standard 80
  descentSpeedMs: number;         // Winde: schneller Abstieg; Standard 0
}

export interface BaitData {
  id: BaitId; nameKey: string;
  infinite: boolean; reusable: boolean; packSize: number; priceCoins: number; pricePearls: number;
  sinkSpeed: number;              // leicht/mittel/schwer; Standard 1
  biteRateBonus: number;
  sizeMuBonus: number;            // Großköder +0.08
  commonMod: number;              // Großköder 0.5; Standard 1
  shinyMultiplier: number;        // Glücksköder 2; Standard 1
  twitchBonus: number;            // Blinker 1.5; Standard 1
  worlds: WorldId[];              // wo er wirkt (leer = überall)
  summonsBoss: FishId | null;     // Bosslocker
}
```

#### 6.6 CSV-Spalten für `fish.csv`

| Spalte | Typ | Beispiel | Hinweis |
|---|---|---|---|
| `id` | string | `F014` | eindeutig |
| `nr` | int | `14` | Lexikonnummer |
| `name_de` | string | `Hecht` | wird zu `fish.014.name` |
| `basis` | string | `Esox lucius` | |
| `fantasie` | bool | `0` | |
| `welt` | string | `W1` | |
| `seltenheit` | enum | `Selten` | |
| `boss` | bool | `0` | |
| `groesse` | enum | `L` | S/M/L/XL/Boss |
| `canvas` | string | `96x48` | |
| `laenge_min_cm` / `laenge_max_cm` | float | `50` / `130` | |
| `k` | float | `0.009` | Gewichtsfaktor |
| `tiefe_min_m` / `tiefe_max_m` | float | `3` / `15` | |
| `zonen` | flags | `Freiwasser\|Kante` | |
| `zeit` | flags | `Morgen\|Abend` | |
| `wetter_pflicht` | flags | `Alle` | |
| `wetter_bevorzugt` | flags | `Bewoelkt\|Regen` | |
| `ereignis_pflicht` / `ereignis_bevorzugt` | enum | `Keins` | |
| `koeder_mag` / `koeder_mag_nicht` | ids | `K04\|K05` / `K03` | |
| `schwarm` | string | `0` oder `3-6` | |
| `zupfer` | string | `1-2` | min-max |
| `scheinbisse` | bool | `0` | |
| `zahnfisch` | bool | `1` | |
| `verhalten` | enum | `Sprinter` | |
| `verhalten2` / `verhalten2_ab` | enum / float | leer | z. B. `Brocken` / `0.5` |
| `kraft` | int | `6` | 1–10 |
| `zone_mod` | float | `0` | grüne Zone ± |
| `punkte` | int | `120` | |
| `leuchtet` | bool | `0` | Emissionsmaske nötig |
| `art_text` | string | `Langer, torpedoförmiger …` | Text der Tabellen oben, in Anführungszeichen |
| `schillernd_text` | string | `Silber-Lavendel …` | |
| `lexikon_text` | string | `Lauert im Kraut …` | |
| `hinweis_text` | string | `Bei trübem Wetter …` | |

**Beispielzeilen** (`fish.csv`, gekürzte Texte):

```csv
id;nr;name_de;basis;fantasie;welt;seltenheit;boss;groesse;canvas;laenge_min_cm;laenge_max_cm;k;tiefe_min_m;tiefe_max_m;zonen;zeit;wetter_pflicht;wetter_bevorzugt;ereignis_pflicht;ereignis_bevorzugt;koeder_mag;koeder_mag_nicht;schwarm;zupfer;scheinbisse;zahnfisch;verhalten;verhalten2;verhalten2_ab;kraft;zone_mod;punkte;leuchtet;art_text;schillernd_text;lexikon_text;hinweis_text
F001;1;Rotauge;Rutilus rutilus;0;W1;Gewoehnlich;0;S;32x16;10;30;0.012;0;8;Alle;Immer;Alle;;Keins;Keins;K01|K02|K03;;0;0-2;0;0;Zappler;;;2;0;10;0;"Schlanker, silberner Körper, rote Iris …";"Silber-Lavendel, Iris hellblau";"Der Klassiker. Jeder Angler fängt hier sein erstes.";""
F017;17;Glühwürmchen-Barsch;Barsch (Fantasie);1;W1;Selten;0;M;64x32;15;30;0.013;0;5;Ufer|Freiwasser;Nacht;Sonnig|Bewoelkt|Nebel;;Keins;Vollmond;K04;;0;1-2;0;0;Zickzack;;;4;0;180;1;"Dunkelblauer Barsch mit gelbgrün pulsierenden Leuchtpunkten …";"Lila Körper, rosa Lichter";"Wer ihn sieht, darf sich was wünschen. Sagt Opa Otto.";"Nur in klaren Nächten …"
F080;80;Lumina, die Abgrundlaterne;Anglerfisch (Fantasie);1;W4;Legendaer;1;Boss;256x128;400;600;0.03;6000;11000;Alle;Immer;Alle;;SchwarzerRaucher;Keins;K09;;0;2-3;1;1;Trickser;;;9;0;2500;1;"Kolossale Anglerfisch-Königin, drei Laternen …";"Goldene Ornamente, Laternen weißgold";"Die Königin der Tiefe. Ihr Licht hat noch kein U-Boot gesehen und zurückgemeldet.";"Wenn die Schlote rot glühen …"
```

**Bossphasen** in einer eigenen Datei `Data/boss_phases.csv`:

```csv
fisch_id;phase;name_de;hp_von;hp_bis;verhalten;spezial;kraft;ansage_de
F020;1;Kraftprobe;1.0;0.7;Sprinter;Keine;7;"Barnabas reißt nach links und rechts!"
F020;2;Ab ins Kraut;0.7;0.4;Versteckspieler;KrautHaenger;8;"Er zieht ins Krautfeld!"
F020;3;Wutsprung;0.4;0.0;Springer;Blitzsprung;8;"Barnabas springt!"
F080;1;Lockruf;1.0;0.7;Trickser;DreiZonen;9;"Welche Laterne ist echt?"
```

Weitere Tabellen im gleichen Stil liegen in `Data/`: `worlds.csv`, `rods.csv`, `lines.csv`, `reels.csv`, `baits.csv`, `weather.csv` (welt;wetter;gewicht;anzeigename), `events.csv`. Das Build-Skript verarbeitet sie nach demselben Muster zu `public/data/*.json`.

#### 6.7 JSON (`public/data/fish_db.json`, für Spiel und Art-Pipeline)

Die Datei wird erzeugt und nie von Hand bearbeitet. Phaser lädt sie in der Preload-Szene (`this.load.json('fish_db', 'data/fish_db.json')`). Die Python-Art-Pipeline liest dieselbe Datei. Bei Bossen kommt zusätzlich das Feld `"bossPhasen"` aus `boss_phases.csv` dazu.

```json
{
  "version": 1,
  "fish": [
    {
      "id": "F014",
      "nr": 14,
      "name": "Hecht",
      "basis": "Esox lucius",
      "fantasie": false,
      "welt": "W1",
      "seltenheit": "Selten",
      "boss": false,
      "groesse": { "klasse": "L", "canvas": [96, 48], "laengeCm": [50, 130], "k": 0.009 },
      "spawn": {
        "tiefeM": [3, 15], "zonen": ["Freiwasser", "Kante"], "zeit": ["Morgen", "Abend"],
        "wetterPflicht": ["Alle"], "wetterBevorzugt": ["Bewoelkt", "Regen"],
        "ereignisPflicht": "Keins", "koederMag": ["K04", "K05"], "koederMagNicht": ["K03"]
      },
      "biss": { "zupfer": [1, 2], "scheinbisse": false, "zahnfisch": true },
      "drill": { "verhalten": "Sprinter", "kraft": 6, "zoneMod": 0 },
      "punkte": 120,
      "art": {
        "koerperform": "torpedo",
        "muster": "bohnenfoermige Flecken in Reihen",
        "farben": ["olivgruen", "hellgelb", "weiss", "rotbraun"],
        "text": "Langer, torpedoförmiger Körper …",
        "schillernd": "Silber-Lavendel mit hellblauen Flecken",
        "leuchtet": false
      },
      "texte": { "lexikon": "Lauert im Kraut und schießt hervor wie ein Pfeil.", "hinweis": "Bei trübem Wetter in der Dämmerung …" }
    }
  ]
}
```

#### 6.8 Build-Skript (`tools/build-data.ts`, Skizze)

Aufruf mit `npm run data` (`"data": "tsx tools/build-data.ts"`). Das Skript läuft außerdem automatisch vor `vite build` (`"prebuild": "npm run data && vitest run"`).

```ts
// src/data/schema.ts – Zod-Schema für eine CSV-Zeile (leere Zelle → Standardwert)
import { z } from 'zod';
import * as T from './types';

const opt = <S extends z.ZodTypeAny>(s: S, def: z.input<S>) =>
  z.preprocess(v => (v === '' ? undefined : v), s.default(def));
const bool  = z.enum(['0', '1']).transform(v => v === '1');
const num   = z.coerce.number();
const flags = <E extends readonly [string, ...string[]]>(vals: E) =>
  z.string().transform(s => (s ? s.split('|') : [])).pipe(z.array(z.enum(vals)));
const range = z.string().regex(/^\d+(-\d+)?$/)
  .transform(s => { const [min, max = min] = s.split('-').map(Number); return { min, max }; });

export const FishRow = z.object({
  id: z.string().regex(/^F\d{3}$/),
  nr: z.coerce.number().int().min(1).max(100),
  name_de: z.string().min(1),
  welt: z.enum(['W1', 'W2', 'W3', 'W4', 'W5']),
  seltenheit: z.enum(T.RARITIES),
  boss: bool,
  groesse: z.enum(T.SIZE_CLASSES),
  canvas: z.string().regex(/^\d+x\d+$/).transform(s => { const [w, h] = s.split('x').map(Number); return { w, h }; }),
  k: opt(num, 0.011),
  zonen: opt(flags(T.HORIZONTAL_ZONES), 'Alle'),
  zeit: opt(flags(T.TIMES_OF_DAY), 'Immer'),
  wetter_pflicht: opt(flags(T.WEATHERS), 'Alle'),
  ereignis_pflicht: opt(z.enum(T.WORLD_EVENTS), 'Keins'),
  schwarm: range, zupfer: opt(range, '0-2'),
  verhalten: z.enum(T.FIGHT_BEHAVIORS),
  verhalten2: opt(z.enum(T.FIGHT_BEHAVIORS).nullable(), null),
  verhalten2_ab: opt(num.min(0).max(1), 0.5),
  kraft: opt(z.coerce.number().int().min(1).max(10), 3),
  punkte: z.coerce.number().int().min(0),
  // … übrige Spalten aus 6.6 analog
});
export const BossPhaseRow = z.object({ /* fisch_id, phase, name_de, hp_von, hp_bis, verhalten, spezial, kraft, ansage_de */ });
```

```ts
// tools/build-data.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { FishRow, BossPhaseRow } from '../src/data/schema';
import { toFishDbEntry } from '../src/data/db';
import { validateDb } from '../src/data/validate';

const readCsv = (p: string) => parse(readFileSync(p, 'utf8'),
  { delimiter: ';', columns: true, bom: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
const nr3 = (n: number) => String(n).padStart(3, '0');
const errors: string[] = [];

const fish = readCsv('Data/fish.csv').flatMap((r, i) => {
  const res = FishRow.safeParse(r);
  if (res.success) return [res.data];
  errors.push(`${r.id || `Zeile ${i + 2}`}: ` + res.error.issues.map(x => `${x.path.join('.')} ${x.message}`).join(', '));
  return [];
});
const phases = readCsv('Data/boss_phases.csv').map(r => BossPhaseRow.parse(r));

// Lokalisierung: de wird überschrieben, en bekommt fehlende Schlüssel leer (Übersetzung offen)
const de: Record<string, string> = JSON.parse(readFileSync('src/i18n/de.json', 'utf8'));
const en: Record<string, string> = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'));
for (const f of fish) {
  const k = `fish.${nr3(f.nr)}`;
  Object.assign(de, { [`${k}.name`]: f.name_de, [`${k}.lexicon`]: f.lexikon_text, [`${k}.hint`]: f.hinweis_text });
  for (const s of ['name', 'lexicon', 'hint']) en[`${k}.${s}`] ??= '';
}
for (const p of phases) {
  const k = `boss.${p.fisch_id.slice(1)}.phase${p.phase}`;   // "boss.020.phase1"
  de[k] = p.name_de; de[`${k}.ansage`] = p.ansage_de;
}

const db = { version: 1, fish: fish.map(f => toFishDbEntry(f, phases)) };   // Format aus 6.7
const report = validateDb(db);                                             // Regeln aus 6.9
report.warnings.forEach(w => console.warn(`\x1b[33mWARNUNG ${w.id}: ${w.msg}\x1b[0m`));
errors.push(...report.errors.map(e => `${e.id}: ${e.msg}`));
if (errors.length) { errors.forEach(e => console.error(`\x1b[31mFEHLER ${e}\x1b[0m`)); process.exit(1); }

writeFileSync('public/data/fish_db.json', JSON.stringify(db, null, 2));
writeFileSync('src/i18n/de.json', JSON.stringify(de, null, 2));
writeFileSync('src/i18n/en.json', JSON.stringify(en, null, 2));
console.log(`✓ ${fish.length} Fische, ${phases.length} Bossphasen`);
```

Asset-Keys werden nach Namenskonvention gebildet (`fish_014_swim_0` … im Atlas, `luts/fish_014_shiny.png`). `src/data/db.ts` macht daraus beim Laden die `FishData`-Objekte aus 6.3.

#### 6.9 Automatische Prüfungen (Validator)

Die Regeln stehen in `src/data/validate.ts` (Zod-Schema für Einzelzeilen, `validateDb()` für zeilenübergreifende Regeln). Sie laufen bei jedem `npm run data` und als Vitest-Tests in `tests/data.test.ts` (`npm test`, auch im CI-Build). Fehler werden rot in der Konsole gemeldet, mit der Fisch-ID, und **brechen den Build ab** (Exit-Code 1 bzw. roter Test). Warnungen erscheinen gelb und brechen nicht ab.

1. Die IDs `F001`–`F100` sind lückenlos und eindeutig. Jede Welt hat genau 20 Fische mit der Verteilung **8/5/4/2/1**. Genau 1 Boss pro Welt, und der ist Legendär.
2. `tiefe_min ≥` minimale Tiefe der Welt und `tiefe_max ≤ maxDepthM` der Welt. Die Tiefe muss mit mindestens einer Schicht überlappen.
3. `laenge_min < laenge_max`, `kraft` liegt in 1–10, und `canvas` passt zur Größenklasse.
4. `punkte` liegen im Band der Welt und Seltenheit (siehe Tabelle unten). Ausreißer sind eine Warnung, kein Fehler.
5. Pflicht-Bedingungen sind in der Welt überhaupt möglich (z. B. kein `Schnee` im Regenbogenriff). Das Ereignis muss in `WorldData.events` stehen.
6. Jeder Fisch hat Sprites (Frames im Textur-Atlas), eine Silhouette und eine Schillernd-LUT. Leuchtende Fische haben eine Emissionsmaske. Geprüft wird gegen die Atlas-JSON und die Dateien in `public/assets/`.
7. Simulationstest: Ein Vitest-Test würfelt 10.000 Spawns je Welt, Tageszeit und Wetter. Er nutzt dieselbe Spawn-Funktion wie das Spiel. Er warnt, wenn ein Fisch nie erscheinen kann oder wenn ein Seltener öfter auftaucht als ein Gewöhnlicher der gleichen Welt.

```ts
// tests/data.test.ts
import { describe, it, expect } from 'vitest';
import db from '../public/data/fish_db.json';
import { validateDb } from '../src/data/validate';

describe('fish_db', () => {
  it('hat keine Fehler (Regeln 1–7)', () => {
    const { errors } = validateDb(db);
    expect(errors, errors.map(e => `${e.id}: ${e.msg}`).join('\n')).toEqual([]);
  });
});
```

**Punktebänder** (Basispunkte):

| Welt | Gewöhnlich | Ungewöhnlich | Selten | Episch | Legendär |
|---|---|---|---|---|---|
| W1 | 10–25 | 50–70 | 120–180 | 350–450 | 1000 |
| W2 | 20–40 | 65–100 | 180–250 | 500–600 | 1500 |
| W3 | 30–55 | 90–130 | 260–320 | 600–750 | 2000 |
| W4 | 40–70 | 120–170 | 300–400 | 800–900 | 2500 |
| W5 | 55–90 | 140–210 | 400–500 | 1000–1100 | 3000 |

---

### Anhang: Offene Designfragen für den ersten Prototyp

1. **Drill-Tuning:** Fühlen sich K-Werte und Ausdauer richtig an? Ein Vorschlag für den ersten Spieltest: 1 Welt, 6 Fische mit 6 verschiedenen Verhalten, 3-Minuten-Runde zu zweit.
2. **Handy-Steuerung:** Rutenführung (links/rechts gedrückt halten) und Kurbeln gleichzeitig mit zwei Daumen testen. Fallback: automatischer Konter mit kleinerem Bonus (0,15) als Option „Einfache Steuerung“.
3. **Schabernack:** Machen die Items Spaß oder nerven sie? Im Spieltest mit und ohne messen (Umfrage nach der Runde: Daumen hoch/runter).
4. **Boss-Duell:** Gemeinsame HP und Schadensanteil sind getestet einfacher zu verstehen als 1-gegen-1-Tauziehen. Das 1-gegen-1-Tauziehen kann später als Variante dazukommen.
5. **Tiefsee-Kamera:** Nicht-lineares Scrollen auf 11.000 m muss früh als Prototyp gebaut werden, damit sich der Abstieg nicht zäh anfühlt (Zielwert ≤ 8 s bis zum Graben).

---

## TEIL H – PHASENPLAN MIT ABNAHME

Arbeite die Phasen der Reihe nach ab. Innerhalb einer Phase parallelisierst du mit Agenten. **Eine Phase ist erst fertig, wenn der `qa-pruefer` sie abgenommen hat** und ich sie über den Vorschau-Link auf meinem Handy ausprobiert habe. Leg zu Beginn jeder Phase eine Aufgabenliste an und hake sie ab.

### Phase 0 – Fundament (1 Sitzung)
- Annahmen-Liste ausgeben (Phaser-Version, Hosting-Dienst, Node-Version), Vite + TypeScript + Phaser 4 aufsetzen, Ordnerstruktur (B2), `CLAUDE.md`, `.claude/agents/` (A2), `docs/entscheidungen.md`.
- Hosting verbinden: Hauptbranch → feste Adresse, Branches → Vorschau-Links.
- Pixel-Perfect-Grundlage (B3): ganzzahlige Skalierung, Hoch- und Querformat.
- `Data/fish.csv` mit **allen 100 Fischen** aus Teil E (Format Teil G 6.6), `npm run data` → `public/data/fish_db.json` + Übersetzungsschlüssel. Validator-Test: genau 100 Fische, 20 je Welt, Seltenheiten 8/5/4/2/1 je Welt, alle IDs eindeutig, alle Pflichtfelder gefüllt.
- `fishgen.py` erzeugt Platzhalter-Sprites für alle 100 Fische, `pack.py` baut die Atlanten.
- **Abnahme:** Vorschau-Link öffnet auf Handy und PC, eine Testszene zeigt die 20 Fische von Welt 1 gestochen scharf schwimmend, alle Tests grün.

### Phase 1 – Angeln fühlt sich gut an (Einzelspieler, Welt 1)
- Wurf mit Kraftbalken, Zonen, Sinken/Stoppen, Tiefenanzeige, Zupfer, Biss, Anschlagfenster, kompletter Drill mit allen Verhaltensarten aus D 1.7, Fang-Präsentation, Fangeimer.
- Spawn-Formel, Tageszeit, Wetter, Größe/Gewicht, Schillernd, Lexikon (Silhouette → gesichtet → gefangen), lokaler Spielstand.
- Welt 1 als echte Szene mit Parallax, Steg, Boot, Wasser. Touch-Steuerung **und** Tastatur.
- **Abnahme:** Ich kann auf dem Handy 10 Minuten in Welt 1 angeln und jede Verhaltensart erleben (Debug-Menü, um einen Fisch zu erzwingen). Vitest-Tests für Spawn-Formel, Punkteformel, Größenwurf und Drill grün. Kurzes Bildschirmvideo vom Drill (Playwright-Aufnahme).

### Phase 2 – Mit Freunden gegeneinander
- Supabase-Projekt, anonyme Anmeldung, Räume mit Code und Link, Warteraum mit Presence, Runden-State-Machine, Wettangeln-Modus, Punkte, Fang-Feed, Ergebnis-Bildschirm, Emotes, Reconnect.
- Die vier Frühtests aus B4 durchführen und Ergebnisse notieren.
- **Abnahme:** 4 Spieler in 4 Browser-Tabs (Playwright) spielen eine komplette 5-Minuten-Runde; Punkte stimmen überall überein; ein Client kann mitten in der Runde neu laden und spielt weiter; Host schließt den Tab → alle landen sauber im Hafen. Danach spiele ich eine Runde mit einem Freund auf zwei Handys.

### Phase 3 – Fortschritt und Hafen
- Hafen-Hub, Angelladen mit allen Ruten/Schnüren/Rollen/Ködern/Zubehör, Münzen, Perlen, Ruf, Aufträge, Aquarium, Welt-Freischaltung, Sammlungsbelohnungen.
- Datenbank-Tabellen mit RLS, Edge Functions `submit-round`, `save-progress`, `buy-item`, Bestenlisten.
- **Abnahme:** Neuer Spielstand → Welt 2 freischaltbar auf dem vorgesehenen Weg; Spielstand übersteht Neuladen und Gerätewechsel (Konto verknüpfen); ein direkter Schreibversuch auf Münzen aus dem Browser wird abgelehnt (Test); gefälschte Rundenergebnisse werden von `submit-round` abgelehnt (Test).

### Phase 4 – Alle 5 Welten und alle 100 Fische
- Welten 2–5 mit eigenen Mechaniken, Ereignissen, Musikstimmung und Bossen (Teil E).
- Art-Pipeline (Teil F): pro Welt zuerst 3 Ankerfische → meine Freigabe → restliche 17 → Kontaktbogen → Atlas.
- Alle Modi aus D 2.2, Schabernack-Items mit Fairness-Regeln, Aufholregeln.
- **Abnahme:** Jeder der 100 Fische ist im Spiel fangbar (automatischer Test: für jeden Fisch gibt es eine erfüllbare Kombination aus Tiefe, Zone, Zeit, Wetter, Köder), alle Sprites bestehen `qa.py`, jeder Boss ist im Boss-Duell besiegbar, Ladezeit jeder Welt auf dem Handy gemessen.

### Phase 5 – Feinschliff
- Juice: Wasserspritzer, Bildschirmwackeln (abschaltbar), Zeitlupe beim Riesig-Fang, Konfetti, Seltenheits-Fanfaren, Rutenbiegung in 4 Stufen, Schnur-Ton nach Spannung, Vibration.
- Tutorial mit Opa Otto (kurz, überspringbar), Einstellungen, Barrierefreiheit (Farbenblind-Modus mit Symbolen), Controller-Support, PWA (installierbar, Offline-Start für Freies Angeln).
- Balancing mit einem Simulationsskript (z. B. 10.000 simulierte Runden: Punkteverteilung, wie oft gewinnt der Letzte noch?, Münzen pro Minute je Welt gegen die Zielwerte aus D 3.2).
- **Abnahme:** `accessibility-audit` und `code-review` ohne kritische Befunde, 60 FPS auf einem Mittelklasse-Handy gemessen, Balancing-Bericht in `docs/balancing.md`.

### Phase 6 – Freunde einladen
- Feste Adresse prüfen, Teilen-Vorschau (Titel, Bild beim Link-Teilen über Open-Graph-Tags), kurze Anleitung `docs/spielen.md` (Raum erstellen, Link schicken, aufs Handy installieren).
- **Abnahme:** Ich spiele mit mindestens zwei Freunden auf ihren eigenen Handys eine Runde.

---

## TEIL I – QUALITÄTSREGELN (gelten immer)

1. **Nichts erfinden.** APIs von Phaser 4 und Supabase immer in der Doku der installierten Version prüfen. Unsicheres als `[UNGEPRÜFT]` markieren und testen.
2. **Sauberer Build.** Nach jeder Änderung: `npm run build`, `npm run lint` und `npm test` ohne Fehler, Browser-Konsole ohne Fehler.
3. **Tests.** Reine Logik (Spawn, Punkte, Drill, Größe, Wirtschaft, Runden-Ablauf) in `src/game/` bzw. `src/net/` ohne Phaser, mit Vitest. Abläufe und Multiplayer mit Playwright. Tests nicht blind wiederholen, wenn sie fehlschlagen – Ursache finden.
4. **Daten statt Code.** Alle Zahlen (Fischwerte, Preise, Raten, Zeiten) liegen in `fish.csv` bzw. Daten-Dateien, nie fest im Code.
5. **Keine Platzhalter verstecken.** Alles, was noch Platzhalter ist, steht in `docs/platzhalter.md`.
6. **Sicherheit.** Kein Service-Role-Key und kein API-Schlüssel im Browser oder im Repository. Row Level Security auf jeder Tabelle. Dauerwerte nur über Edge Functions.
7. **Fairness & Jugendschutz.** Keine Lootboxen, kein Glücksspiel gegen Echtgeld, kein Pay-to-Win. Perlen sind nur erspielbar. Keine Werbung.
8. **Lizenzen.** Nur Schriften, Sounds und Assets mit klarer Lizenz; jede Quelle in `docs/lizenzen.md`. Keine geschützten Figuren, Namen oder Logos anderer Spiele.
9. **Kleine Schritte, oft committen.** Jede Phase in Teilschritte, nach jedem Teilschritt Commit und Vorschau-Link.
10. **Berichte an mich:** kurz, auf Deutsch, mit Vorschau-Link und Screenshot. Format: *Was ist neu – Was funktioniert (bewiesen durch …) – Was noch fehlt – Was du von mir brauchst.*
11. **Wenn du feststeckst** (3 Versuche ohne Fortschritt): stopp, beschreib das Problem in 3 Sätzen und schlag 2 Lösungswege vor.

---

## START

Lies diese Datei vollständig. Fasse mir dann in höchstens 10 Zeilen zusammen, was du baust und wie du die Agenten einsetzt, liste die Fragen, die du **wirklich** vor dem Start brauchst (höchstens 3, z. B. welchen Hosting-Dienst ich schon habe), und beginne danach mit **Phase 0**.

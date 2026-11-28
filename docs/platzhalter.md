# Platzhalter (Teil I Nr. 5)

| Was | Stand | Ersetzen in |
|---|---|---|
| Fisch-Sprites (alle 100) | prozedural aus `tools/art/fishgen.py` (F8) | Phase 4 (Ankerfische → Freigabe → Rest) |
| Legendäre Fische / Bosse | prozedural, noch keine handgezeichneten Zeichenraster (F8.5) | Phase 4 |
| Schillernd-Varianten | noch keine LUT/kein gebackenes Sprite | Phase 1 |
| Testbecken-Hintergrund | Bayer-Verlauf aus den Leitfarben | wird durch die Welt-1-Szene ersetzt |
| Welt-1-Hintergründe und Deko | prozedural (`tools/art/see_world.py`) | Phase 5 (Feinschliff) |
| Figuren | nur sitzend, keine Wurf-/Kurbelpose, Kescher nicht sichtbar; Opa Otto und Fridolin nur Standbild | Phase 3 (Posen, Animationen) |
| Ausrüstungs-Sprites | nur Rute R01, ein Boot, 4 Jackenfarben | Phase 3 (Shop) |
| HUD-Icons (Wind, „…“) | einfach gehalten | Phase 5 |
| Fisch-Texte (Lexikon/Hinweise), die nicht in der Spec stehen | von Claude geschrieben, siehe `Data/fish.csv` | jederzeit von dir änderbar |
| Sounds/Musik | keine | Phase 1/5 |
| PWA (Service Worker, Icons) | noch nicht | Phase 5 |
| Deko-Tönung nach Tageszeit | nur Ebenen werden getönt, Deko-Objekte und `overlay`-Farben aus `world_see.json` noch nicht | Phase 5 |
| Item-Taste | löst in Phase 1 nur „Füttern“ (Brotflocke) aus; Echolot, Gewitter-Sichtung fehlen | Phase 3/4 |
| Fisch im Drill | dunkle Silhouette statt Farbsprite (Art bleibt bis zum Fang geheim) | bewusst so |
| Leistung | 60 FPS noch nicht auf echtem Handy gemessen (Headless-Chromium mit Software-WebGL: Desktop ~29 FPS) | Phase 1 Handy-Test / Phase 5 |

# Köderkönige – Dauerregeln
Spezifikation: `Koederkoenige_Browser_Prompt_fuer_Claude.md` (Quelle der Wahrheit).
- Stack: Phaser 4.2.1 + TypeScript strict + Vite, Supabase (Phase 2+). Intern 640×360, ganzzahlige Skalierung.
- Reine Logik in `src/game/` (kein Phaser). Keine festen Texte im Code: `t('schlüssel')`. Zahlen in Daten-Dateien.
- Befehle: `npm run dev | build | test | test:e2e | data | art | lint`
- Vor jedem Commit: build, lint, test grün. Keine Geheimnisse im Repo.
- Platzhalter in `docs/platzhalter.md`, Entscheidungen in `docs/entscheidungen.md`.
- Nicht auf PlayDrop veröffentlichen.

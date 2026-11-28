// src/scenes/sceneConfig.ts – reine DARSTELLUNGS-Werte der Welt-Szene (Animation, Kamera, Seil-Optik, Pool-Größen).
// Keine Spielwerte: alles, was Fang, Punkte oder Zeiten des Spiels beeinflusst, kommt aus public/data/*.json.

export const VIEW = {
  /** größter Zeitschritt je Frame (s), damit ein Ruckler keine Sprünge macht */
  maxFrameS: 0.1,
  /** feste Teilschritte der Spiellogik (s) – gleicher Takt wie in den Bot-Tests */
  logicStepS: 1 / 60,
  /** Flugdauer der Pose beim Wurf (s) und Bogenhöhe (Spielpixel) */
  castFlightS: 0.55,
  castArcPx: 60,
  /** Kamera folgt weich (Anteil je Frame bei 60 fps) */
  cameraLerp: 0.12,
  /** Pose hängt in Ruhe so weit unter der Rutenspitze (px) */
  idleDanglePx: 14,
  rope: { segments: 14, gravity: 900, damping: 0.9, iterations: 12, waterDamping: 0.7, slackIdle: 1.04, slackWater: 1.06, slackFight: 1 },
  shadows: { max: 40, spawnPerS: 0.5, speedMs: [0.15, 0.7] as [number, number], ttlS: [14, 32] as [number, number], alpha: 0.35 },
  /** Wolken je Wetter (Anzahl) */
  clouds: { Sonnig: 2, Bewoelkt: 6, Regen: 7, Gewitter: 8, Nebel: 4 } as Record<string, number>,
  cloudSpeedPx: 4,
  /** Blitz: weiße Fläche über der Welt */
  flash: { alpha: 0.7, s: 0.12 },
  /** Biss-„!“: ganzzahlige Vergrößerung und Blinktakt (ms) */
  bitePopScale: 2,
  bitePopBlinkMs: 120,
  /** Meldungen (Banner) */
  bannerS: 2.2,
  hud: { gap: 4, topBarCss: 52, touchButtonCss: 120, touchButtonCssPortrait: 150, staminaFins: 5, heatW: 40, heatH: 4 },
  /** Drill hochkant: so viele Spielpixel links vom Angler bleiben mindestens im Bild */
  anglerMarginPx: 24,
  /** Ton-Hook „Schnurspannung“ so oft je s (für den audio-designer) */
  sfxTensionEveryS: 0.1,
  /** Fisch im Drill: Sprunghöhe über der Oberfläche (px) */
  jumpPx: 18,
  /** Ruf-Stufen-Anzeige: Farbe der Schnur, falls die Rute keine hat */
  fallbackLineColor: '#E8EEF2',
  /** Grundfarben für generierte Schatten/Balken (aus der Weltpalette W1) */
  colors: { shadow: '#12342F', heat: '#E8743C', heatBg: '#2A4B42', text: '#F3EAD2', textDark: '#12342F', warn: '#FF6F59', fake: '#FFA23A' },
  /** Autosave spätestens alle n s */
  autosaveS: 20,
} as const;

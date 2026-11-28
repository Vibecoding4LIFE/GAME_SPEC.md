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
  hud: {
    /** HUD-Kamera: mindestens so viele CSS-Pixel je HUD-Pixel, kleinste HUD-Fläche (Spielpixel) je Format */
    minCssPx: 1, minArea: { landscape: { w: 320, h: 180 }, portrait: { w: 180, h: 300 } },
    gap: 4, topBarCss: 52, touchButtonCss: 120, touchButtonCssPortrait: 150, staminaFins: 5, heatW: 40, heatH: 4 },
  /** Drill hochkant: so viele Spielpixel links vom Angler bleiben mindestens im Bild */
  anglerMarginPx: 24,
  /** Ton-Hook „Schnurspannung“ so oft je s (für den audio-designer) */
  sfxTensionEveryS: 0.1,
  /** Fisch im Drill: Sprunghöhe über der Oberfläche (px) */
  jumpPx: 18,
  /** Ruf-Stufen-Anzeige: Farbe der Schnur, falls die Rute keine hat */
  fallbackLineColor: '#E8EEF2',
  /** Grundfarben für generierte Schatten/Balken (aus der Weltpalette W1) */
  /** Vorwarnungen (D 1.7) als Bild */
  telegraph: {
    jitterMs: 40, jitterPx: 2, bulgeW: 24, bulgeH: 5, finFlickShare: 0.3, inflatePulseMs: 90, fadeStart: 0.6, fadeMin: 0.3,
    streakLen: 18, bubbles: 14, bubblesPerS: 12, bubbleLifeS: 1.4, bubbleRisePxS: 30, sparkMs: 60, sparks: 10,
    coverPullPx: 40, coverPullPerS: 3, coverBlinkMs: 140, arrowBlinkMs: 70, barFlickerMs: 80, diveDepthShare: 0.25,
  },
  /** Schnur glüht je Hitze-Anteil (Hitzkopf): ab 1/3 orange, ab 2/3 rot-orange */
  lineGlow: ['#FFA23A', '#E8743C'],
  colors: { foam: '#E8F6F4', spark: '#3FA9F5', sparkLight: '#8FD3F4', shadow: '#12342F', heat: '#E8743C', heatBg: '#2A4B42', text: '#F3EAD2', textDark: '#12342F', warn: '#FF6F59', fake: '#FFA23A' },
  /** Autosave spätestens alle n s */
  autosaveS: 20,
} as const;

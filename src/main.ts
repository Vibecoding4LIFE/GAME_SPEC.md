import Phaser from 'phaser';
import { computeLayout, cssToDevicePixels, type PixelLayout } from './core/pixelScale';
import { bus } from './core/events';
import { detectLanguage, setLanguage, t } from './i18n';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TestbeckenScene } from './scenes/TestbeckenScene';
import { WeltScene, type WeltDebug } from './scenes/WeltScene';

setLanguage(detectLanguage(navigator.languages));
document.title = t('app.title');
document.documentElement.lang = navigator.languages[0]?.slice(0, 2) === 'en' ? 'en' : 'de';

const gameHost = document.getElementById('game') as HTMLDivElement;

/** Erste Schätzung der Canvas-Größe in Gerätepixeln, bis der ResizeObserver exakt misst. */
function estimateBuffer(): [number, number] {
  const dpr = window.devicePixelRatio || 1;
  return [cssToDevicePixels(gameHost.clientWidth || window.innerWidth, dpr), cssToDevicePixels(gameHost.clientHeight || window.innerHeight, dpr)];
}

let layout = computeLayout(...estimateBuffer());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameHost,
  width: layout.bufferWidth,
  height: layout.bufferHeight,
  transparent: true,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.NONE,
    // Die CSS-Größe kommt aus base.css (Canvas füllt das Fenster); Phaser soll nichts skalieren.
    zoom: 1,
  },
  input: { activePointers: 3 },
  // Kein window.focus() beim Start: In eingebetteten Vorschauen verletzt das die Permissions-Policy
  // („focus-without-user-activation“). Den Fokus holt der Startbildschirm beim ersten Tipp/Klick.
  autoFocus: false,
  scene: [BootScene, PreloadScene, TestbeckenScene, WeltScene],
});

function applyLayout(bufferWidth: number, bufferHeight: number): void {
  const next = computeLayout(bufferWidth, bufferHeight);
  if (next.bufferWidth !== game.scale.width || next.bufferHeight !== game.scale.height) {
    game.scale.resize(next.bufferWidth, next.bufferHeight);
  }
  const changed = JSON.stringify(next) !== JSON.stringify(layout);
  layout = next;
  debugState.layout = next;
  game.registry.set('layout', next);
  if (changed) bus.emit('layout', next);
}

// Exakte Größe in Gerätepixeln messen (Chrome/Firefox/Edge); Safari fällt auf CSS × DPR zurück.
const observer = new ResizeObserver((entries) => {
  const entry = entries[entries.length - 1];
  if (!entry) return;
  const dpr = window.devicePixelRatio || 1;
  const estW = entry.contentRect.width * dpr;
  const estH = entry.contentRect.height * dpr;
  const device = entry.devicePixelContentBoxSize?.[0];
  // Nur plausible Gerätepixel-Werte übernehmen (manche Emulatoren melden hier CSS-Pixel).
  if (device && Math.abs(device.inlineSize - estW) <= 2 && Math.abs(device.blockSize - estH) <= 2) {
    applyLayout(device.inlineSize, device.blockSize);
  } else {
    applyLayout(Math.round(estW), Math.round(estH));
  }
});
try {
  observer.observe(gameHost, { box: 'device-pixel-content-box' });
} catch {
  observer.observe(gameHost);
}

/** Debug-Zustand für Browser-Tests (Playwright) – enthält keine Geheimnisse. */
export interface DebugState {
  layout: PixelLayout;
  renderer: string;
  ready: boolean;
  fishOnScreen: number;
  errors: string[];
  /** Ladebildschirm: sichtbar / wartet auf den ersten Tipp */
  loading?: { visible: boolean; waiting: boolean };
  /** aktive Szene ('testbecken' | 'welt') */
  scene: string;
  /** Welt-Szene: Anzeige-Zustand und Debug-Hooks (siehe WeltScene) */
  welt?: WeltDebug;
}

const debugState: DebugState = {
  layout,
  renderer: '',
  ready: false,
  fishOnScreen: 0,
  errors: [],
  scene: '',
};
window.addEventListener('error', (e) => debugState.errors.push(String(e.message)));
game.events.once(Phaser.Core.Events.READY, () => {
  debugState.renderer = game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas';
});
(window as unknown as { __KK: DebugState }).__KK = debugState;
game.registry.set('debug', debugState);
game.registry.set('layout', layout);

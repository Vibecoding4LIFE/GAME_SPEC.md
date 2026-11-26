import Phaser from 'phaser';
import { computeLayout, type PixelLayout } from './core/pixelScale';
import { bus } from './core/events';
import { detectLanguage, setLanguage, t } from './i18n';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TestbeckenScene } from './scenes/TestbeckenScene';
import { mountFullscreenButton } from './ui/fullscreen';

setLanguage(detectLanguage(navigator.languages));
document.title = t('app.title');
document.documentElement.lang = navigator.languages[0]?.slice(0, 2) === 'en' ? 'en' : 'de';

function currentLayout(): PixelLayout {
  const vv = window.visualViewport;
  const w = vv ? vv.width : window.innerWidth;
  const h = vv ? vv.height : window.innerHeight;
  return computeLayout(w, h, window.devicePixelRatio || 1);
}

let layout = currentLayout();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: layout.gameWidth,
  height: layout.gameHeight,
  backgroundColor: '#12342f',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: layout.cssZoom,
  },
  input: { activePointers: 3 },
  scene: [BootScene, PreloadScene, TestbeckenScene],
});

function applyLayout(): void {
  const next = currentLayout();
  const changed =
    next.gameWidth !== layout.gameWidth || next.gameHeight !== layout.gameHeight || next.cssZoom !== layout.cssZoom;
  layout = next;
  if (changed) {
    game.scale.resize(next.gameWidth, next.gameHeight);
    game.scale.setZoom(next.cssZoom);
  }
  bus.emit('layout', next);
  debugState.layout = next;
}

let pending = 0;
const scheduleLayout = (): void => {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(applyLayout);
};
window.addEventListener('resize', scheduleLayout);
window.visualViewport?.addEventListener('resize', scheduleLayout);
window.addEventListener('orientationchange', scheduleLayout);

mountFullscreenButton(document.getElementById('overlay'));

/** Debug-Zustand für Browser-Tests (Playwright) – enthält keine Geheimnisse. */
export interface DebugState {
  layout: PixelLayout;
  renderer: string;
  ready: boolean;
  fishOnScreen: number;
  errors: string[];
}

const debugState: DebugState = {
  layout,
  renderer: '',
  ready: false,
  fishOnScreen: 0,
  errors: [],
};
window.addEventListener('error', (e) => debugState.errors.push(String(e.message)));
game.events.once(Phaser.Core.Events.READY, () => {
  debugState.renderer = game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas';
});
(window as unknown as { __KK: DebugState }).__KK = debugState;
game.registry.set('debug', debugState);
game.registry.set('layout', layout);
bus.on('layout', (l) => game.registry.set('layout', l));

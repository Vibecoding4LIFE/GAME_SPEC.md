import Phaser from 'phaser';
import { LANDSCAPE, pickLayout, integerZoom } from './core/scale';
import { TestScene } from './scenes/TestScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: LANDSCAPE.w,
  height: LANDSCAPE.h,
  backgroundColor: '#0b1d33',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE },
  scene: [TestScene],
});

function applyScale() {
  const l = pickLayout(window.innerWidth, window.innerHeight);
  const z = integerZoom(window.innerWidth, window.innerHeight, l.w, l.h);
  game.scale.resize(l.w, l.h);
  const c = game.canvas;
  c.style.width = `${l.w * z}px`;
  c.style.height = `${l.h * z}px`;
}
window.addEventListener('resize', applyScale);
game.events.once('ready', applyScale);

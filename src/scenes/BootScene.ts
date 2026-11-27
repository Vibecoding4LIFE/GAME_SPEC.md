import Phaser from 'phaser';
import { CACHE, SCENES } from './keys';

/** Lädt nur die statischen Spieldaten (Fische, Welten, Ausrüstung, Balancing), dann geht es in die Preload-Szene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    this.load.json(CACHE.fishDb, 'data/fish_db.json');
    this.load.json(CACHE.worlds, 'data/worlds.json');
    this.load.json(CACHE.gear, 'data/gear.json');
    this.load.json(CACHE.balancing, 'data/balancing.json');
  }

  create(): void {
    this.scene.start(SCENES.preload, { worldId: 'W1' });
  }
}

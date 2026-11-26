import Phaser from 'phaser';
import { CACHE, SCENES } from './keys';

/** Lädt nur die statischen Spieldaten (Fische, Welten), dann geht es in die Preload-Szene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    this.load.json(CACHE.fishDb, 'data/fish_db.json');
    this.load.json(CACHE.worlds, 'data/worlds.json');
  }

  create(): void {
    this.scene.start(SCENES.preload, { worldId: 'W1' });
  }
}

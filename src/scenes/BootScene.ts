import Phaser from 'phaser';
import { LoadingScreen } from '../ui/loadingScreen';
import type { DebugState } from '../main';
import { CACHE, SCENES } from './keys';

/** Registry-Schlüssel des HTML-Ladebildschirms (Boot legt ihn an, Preload führt ihn fort). */
export const LOADING_KEY = 'loadingScreen';

/** Zeigt sofort den Ladebildschirm mit Titel, lädt die Spieldaten (Fische, Welten, Ausrüstung, Balancing). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    const overlay = document.getElementById('overlay') ?? document.body;
    const screen = new LoadingScreen(overlay);
    this.registry.set(LOADING_KEY, screen);
    const debug = this.registry.get('debug') as DebugState | undefined;
    if (debug) debug.loading = { visible: true, waiting: false };
    // Daten sind der erste kleine Teil der Ladezeit (bis 10 %)
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => screen.progress(p / 10));
    this.load.json(CACHE.fishDb, 'data/fish_db.json');
    this.load.json(CACHE.worlds, 'data/worlds.json');
    this.load.json(CACHE.gear, 'data/gear.json');
    this.load.json(CACHE.balancing, 'data/balancing.json');
  }

  create(): void {
    this.scene.start(SCENES.preload, { worldId: 'W1' });
  }
}

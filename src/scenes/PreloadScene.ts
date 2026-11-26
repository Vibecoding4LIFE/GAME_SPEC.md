import Phaser from 'phaser';
import { CACHE, SCENES, fishAtlasKey } from './keys';
import { worldById, type WorldsJson } from './worldsJson';
import { t } from '../i18n';

/** Lädt die Assets einer Welt erst beim Betreten (B3), mit Fortschrittsbalken. */
export class PreloadScene extends Phaser.Scene {
  private worldId = 'W1';

  constructor() {
    super(SCENES.preload);
  }

  init(data: { worldId?: string }): void {
    this.worldId = data.worldId ?? 'W1';
  }

  preload(): void {
    const worlds = this.cache.json.get(CACHE.worlds) as WorldsJson | undefined;
    const world = worlds ? worldById(worlds, this.worldId) : undefined;
    if (!world) {
      this.add.text(8, 8, t('test.loadError'), { fontSize: '8px', color: '#ffffff' });
      return;
    }
    const k = world.kuerzel;
    this.load.atlas(fishAtlasKey(k), `assets/fish/${k}/atlas_fish_${k}.png`, `assets/fish/${k}/atlas_fish_${k}.json`);

    const { width, height } = this.scale.gameSize;
    const barW = Math.floor(width / 2);
    const x = Math.floor((width - barW) / 2);
    const y = Math.floor(height / 2);
    const frame = this.add.rectangle(x - 2, y - 2, barW + 4, 8, 0x000000, 0).setOrigin(0).setStrokeStyle(1, 0xf3ead2);
    const bar = this.add.rectangle(x, y, 0, 4, 0xffe066).setOrigin(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.width = Math.round(barW * p);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      frame.destroy();
      bar.destroy();
    });
  }

  create(): void {
    this.scene.start(SCENES.testbecken, { worldId: this.worldId });
  }
}

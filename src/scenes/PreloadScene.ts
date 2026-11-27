import Phaser from 'phaser';
import { CACHE, FIGURES_ATLAS, HUD_ATLAS, SCENES, fishAtlasKey, layerKey, startSceneFromUrl, worldAtlasKey } from './keys';
import type { WorldSee } from './worldSee';
import { worldById, type WorldsJson } from './worldsJson';
import { t } from '../i18n';
import type { PixelLayout } from '../core/pixelScale';
import { applyPixelCamera } from './pixelCamera';

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
    const layout = this.registry.get('layout') as PixelLayout;
    applyPixelCamera(this.cameras.main, layout);
    const worlds = this.cache.json.get(CACHE.worlds) as WorldsJson | undefined;
    const world = worlds ? worldById(worlds, this.worldId) : undefined;
    if (!world) {
      this.add.text(8, 8, t('test.loadError'), { fontSize: '8px', color: '#ffffff' });
      return;
    }
    const k = world.kuerzel;
    this.load.atlas(fishAtlasKey(k), `assets/fish/${k}/atlas_fish_${k}.png`, `assets/fish/${k}/atlas_fish_${k}.json`);
    // Welt-Grafik (Ebenen, Deko, Figuren, HUD). Die Ebenen-Liste steht in world_<k>.json und wird nach dem Laden nachgeladen.
    const artKey = CACHE.worldArt(k);
    if (!this.cache.json.exists(artKey)) {
      this.load.json(artKey, `assets/worlds/${k}/world_${k}.json`);
      this.load.once(`filecomplete-json-${artKey}`, (_key: string, _type: string, art: WorldSee) => {
        for (const e of art.ebenen) this.load.image(layerKey(k, e.id), `assets/worlds/${k}/${e.datei}`);
      });
    }
    this.load.atlas(worldAtlasKey(k), `assets/worlds/${k}/atlas_world_${k}.png`, `assets/worlds/${k}/atlas_world_${k}.json`);
    this.load.atlas(FIGURES_ATLAS, 'assets/figures/atlas_figures.png', 'assets/figures/atlas_figures.json');
    this.load.atlas(HUD_ATLAS, 'assets/ui/atlas_hud.png', 'assets/ui/atlas_hud.json');

    const { gameWidth: width, gameHeight: height } = layout;
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
    this.scene.start(startSceneFromUrl(window.location.search), { worldId: this.worldId });
  }
}

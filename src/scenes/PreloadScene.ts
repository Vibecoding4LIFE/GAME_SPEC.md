import Phaser from 'phaser';
import { CACHE, FIGURES_ATLAS, HUD_ATLAS, SCENES, fishAtlasKey, layerKey, startSceneFromUrl, worldAtlasKey } from './keys';
import type { WorldSee } from './worldSee';
import { worldById, type WorldsJson } from './worldsJson';
import { t } from '../i18n';
import type { PixelLayout } from '../core/pixelScale';
import { applyPixelCamera } from './pixelCamera';
import { LOADING_KEY } from './BootScene';
import type { LoadingScreen } from '../ui/loadingScreen';
import { spriteFromTexture, type TextureLike } from '../ui/sprite';
import type { DebugState } from '../main';
import { registerNetScenes } from './MenuScene';

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

    const screen = this.registry.get(LOADING_KEY) as LoadingScreen | undefined;
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => screen?.progress(1 / 10 + (p * 9) / 10));
  }

  create(): void {
    const target = startSceneFromUrl(window.location.search);
    const screen = this.registry.get(LOADING_KEY) as LoadingScreen | undefined;
    const debug = this.registry.get('debug') as DebugState | undefined;
    screen?.progress(1);
    // Testbecken (Phase-0-Pixeltests) startet ohne Aufforderung
    if (!screen || target === SCENES.testbecken) {
      screen?.destroy();
      if (debug) debug.loading = { visible: false, waiting: false };
      this.scene.start(target, { worldId: this.worldId });
      return;
    }
    const worlds = this.cache.json.get(CACHE.worlds) as WorldsJson | undefined;
    const world = worlds ? worldById(worlds, this.worldId) : undefined;
    if (world) {
      // Deko: der Hecht (Nr. 014) als Fang-Sprite, sonst der erste Fang-Frame der Welt
      const tex = this.textures.get(fishAtlasKey(world.kuerzel));
      const names = tex.getFrameNames();
      const deco = names.find((n) => n.endsWith('_caught_0') && n.includes('_014_')) ?? names.find((n) => n.endsWith('_caught_0'));
      if (deco) screen.setFish(spriteFromTexture(tex as unknown as TextureLike, deco));
    }
    if (debug) debug.loading = { visible: true, waiting: true };
    void screen.waitForStart().then(() => {
      if (debug) debug.loading = { visible: false, waiting: false };
      this.registry.remove(LOADING_KEY);
      // Nach dem Start: Startmenü (Allein angeln / Raum erstellen / Raum beitreten, B4)
      registerNetScenes(this);
      this.scene.start(SCENES.menu, { worldId: this.worldId });
    });
  }
}

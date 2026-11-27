// Phaser-HUD (Atlas hud, B5): Wurfkraft mit Perfekt-Fenster, Tiefenanzeige + „Schnur zu kurz!“, Spannungsbalken mit
// grüner/gelber/roter Zone, Distanz, Ausdauer-Flossen, Richtungspfeil, Hitze/Hänger, Uhr/Wetter/Fridolin/Wind, Meldungen.
// Lebt auf der HUD-Kamera (ohne Scroll); alle Positionen ganze Spielpixel.
import Phaser from 'phaser';
import type { PixelLayout } from '../../core/pixelScale';
import type { DrillState } from '../../game/drill';
import type { RodState } from '../../game/session';
import type { ActiveWeather, DayPhase } from '../../game/types';
import { t } from '../../i18n';
import { FIGURES_ATLAS, HUD_ATLAS } from '../keys';
import { hudInsets, hudLayout, type HudLayout, type ScreenReserve } from '../hudLayout';
import { VIEW } from '../sceneConfig';
import { hexToInt } from '../worldSee';
import { anchorOf, pin, windowOf } from './assets';

type Img = Phaser.GameObjects.Image;

export interface HudFrame {
  rodState: RodState;
  castPower: number;
  perfectMin: number;
  depthM: number;
  maxDepthM: number;
  lineTooShort: boolean;
  drill: DrillState | null;
  redFrom: number;
  heatBreakAt: number;
  snag: { count: number; needed: number } | null;
  phase: DayPhase;
  weather: ActiveWeather;
  nextWeather: ActiveWeather | null;
  wind: -1 | 0 | 1;
  worldIndex: number;
}

const WEATHER_ICON: Partial<Record<ActiveWeather, string>> = {
  Sonnig: 'wetter_sonnig_still_0', Bewoelkt: 'wetter_bewoelkt_still_0', Regen: 'wetter_regen_still_0',
  Gewitter: 'wetter_gewitter_still_0', Nebel: 'wetter_nebel_still_0',
};

const textStyle = (color: string = VIEW.colors.text): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: '"Pixelify Sans", monospace', fontSize: '10px', color, stroke: VIEW.colors.textDark, strokeThickness: 2,
});

export class Hud {
  private lay!: HudLayout;
  // Wurf
  private powerFrame!: Img; private powerFill!: Img; private powerMarker!: Img;
  // Tiefe
  private depthScale!: Img; private depthFill!: Img; private depthMarker!: Img; private shortText!: Phaser.GameObjects.Text;
  // Drill
  private tensionFrame!: Img; private tensionTiles: Img[] = []; private needle!: Img;
  private distFrame!: Img; private distTiles: Img[] = []; private distIcon!: Img; private boatIcon!: Img;
  private fins: Img[] = []; private arrow!: Phaser.GameObjects.Sprite;
  private heat!: Phaser.GameObjects.Graphics; private snagText!: Phaser.GameObjects.Text;
  // Wetter / Zeit
  private clock!: Img; private timeText!: Phaser.GameObjects.Text; private weatherIcon!: Img; private fridolin!: Img;
  private nextIcon!: Img; private windArrow!: Phaser.GameObjects.Sprite;
  // Meldungen
  private banner!: Phaser.GameObjects.Text; private bannerLeft = 0; private bannerQueue: { text: string; color: string }[] = [];
  private lastArrow = '';

  constructor(private readonly scene: Phaser.Scene, private readonly layer: Phaser.GameObjects.Layer) {}

  private img(frame: string, atlas = HUD_ATLAS): Img {
    const o = this.scene.add.image(0, 0, atlas, frame).setOrigin(0);
    this.layer.add(o);
    return o;
  }

  private txt(color?: string): Phaser.GameObjects.Text {
    const o = this.scene.add.text(0, 0, '', textStyle(color)).setOrigin(0);
    this.layer.add(o);
    return o;
  }

  create(): void {
    this.powerFrame = this.img('hud_power_frame_still_0');
    this.powerFill = this.img('hud_power_fill_still_0');
    this.powerMarker = this.img('hud_power_marker_still_0');
    this.depthScale = this.img('hud_depth_scale_still_0');
    this.depthFill = this.img('hud_depth_fill_see_still_0');
    this.depthMarker = this.img('hud_depth_marker_still_0');
    this.shortText = this.txt(VIEW.colors.warn);
    this.tensionFrame = this.img('hud_tension_frame_still_0');
    const tw = windowOf(this.scene, HUD_ATLAS, 'hud_tension_frame_still_0');
    const tileW = this.scene.textures.getFrame(HUD_ATLAS, 'hud_tension_zone_leer_still_0')?.width ?? 1;
    for (let i = 0; i < Math.floor(tw.w / tileW); i++) this.tensionTiles.push(this.img('hud_tension_zone_leer_still_0'));
    this.needle = this.img('hud_tension_needle_still_0');
    this.distFrame = this.img('hud_distance_frame_still_0');
    const dw = windowOf(this.scene, HUD_ATLAS, 'hud_distance_frame_still_0');
    const dTile = this.scene.textures.getFrame(HUD_ATLAS, 'hud_distance_fill_still_0')?.width ?? 1;
    for (let i = 0; i < Math.floor(dw.w / dTile); i++) this.distTiles.push(this.img('hud_distance_fill_still_0'));
    this.distIcon = this.img('hud_icon_fisch_still_0');
    this.boatIcon = this.img('hud_icon_boot_still_0');
    for (let i = 0; i < VIEW.hud.staminaFins; i++) this.fins.push(this.img('hud_stamina_full_still_0'));
    this.arrow = pin(this.scene.add.sprite(0, 0, HUD_ATLAS, 'hud_arrow_left_pulse_0'));
    this.layer.add(this.arrow);
    this.heat = this.scene.add.graphics();
    this.layer.add(this.heat);
    this.snagText = this.txt(VIEW.colors.warn);
    this.clock = this.img('hud_icon_uhr_still_0');
    this.timeText = this.txt();
    this.weatherIcon = this.img('wetter_sonnig_still_0', FIGURES_ATLAS);
    this.fridolin = this.img('fridolin_still_0', FIGURES_ATLAS);
    this.nextIcon = this.img('wetter_sonnig_still_0', FIGURES_ATLAS);
    this.windArrow = this.scene.add.sprite(0, 0, HUD_ATLAS, 'hud_wind_right_flutter_0').setOrigin(1, 0);
    this.layer.add(this.windArrow);
    this.banner = this.txt();
    this.banner.setFontSize(12);
  }

  /** Neu anordnen (Format, Safe-Areas, HTML-Leisten). */
  relayout(l: PixelLayout, reserve: ScreenReserve): void {
    const sz = (f: string) => this.scene.textures.getFrame(HUD_ATLAS, f);
    const touchGame = reserve.touchButtonCss > 0 ? Math.ceil((reserve.touchButtonCss * reserve.dpr) / l.deviceZoom) : 0;
    const ins = hudInsets(l, reserve);
    this.lay = hudLayout(l, ins, {
      gaugeW: sz('hud_depth_scale_still_0')?.width ?? 0, gaugeH: sz('hud_depth_scale_still_0')?.height ?? 0,
      tensionW: sz('hud_tension_frame_still_0')?.width ?? 0, tensionH: sz('hud_tension_frame_still_0')?.height ?? 0,
      distanceW: sz('hud_distance_frame_still_0')?.width ?? 0, distanceH: sz('hud_distance_frame_still_0')?.height ?? 0,
      staminaW: (sz('hud_stamina_full_still_0')?.width ?? 0) * VIEW.hud.staminaFins, staminaH: sz('hud_stamina_full_still_0')?.height ?? 0,
      iconH: sz('hud_icon_fisch_still_0')?.height ?? 0, arrowW: sz('hud_arrow_left_pulse_0')?.width ?? 0,
      gap: VIEW.hud.gap, touchButtonGame: touchGame,
    });
    const L = this.lay;
    this.powerFrame.setPosition(L.gauge.x, L.gauge.y);
    const pw = windowOf(this.scene, HUD_ATLAS, 'hud_power_frame_still_0');
    this.powerFill.setPosition(L.gauge.x + pw.x, L.gauge.y + pw.y);
    this.depthScale.setPosition(L.gauge.x, L.gauge.y);
    const dw = windowOf(this.scene, HUD_ATLAS, 'hud_depth_scale_still_0');
    this.depthFill.setPosition(L.gauge.x + dw.x, L.gauge.y + dw.y);
    this.shortText.setPosition(L.gauge.x + this.depthScale.width + VIEW.hud.gap * 3, L.gauge.y + Math.round(this.depthScale.height / 2));
    this.tensionFrame.setPosition(L.tension.x, L.tension.y);
    const tw = windowOf(this.scene, HUD_ATLAS, 'hud_tension_frame_still_0');
    this.tensionTiles.forEach((tile, i) => tile.setPosition(L.tension.x + tw.x + i * tile.width, L.tension.y + tw.y));
    this.distFrame.setPosition(L.distance.x, L.distance.y);
    const dist = windowOf(this.scene, HUD_ATLAS, 'hud_distance_frame_still_0');
    this.distTiles.forEach((tile, i) => tile.setPosition(L.distance.x + dist.x + i * tile.width, L.distance.y + dist.y));
    this.boatIcon.setPosition(L.distance.x - this.boatIcon.width - VIEW.hud.gap, L.distance.y + Math.round((this.distFrame.height - this.boatIcon.height) / 2));
    this.fins.forEach((f, i) => f.setPosition(L.stamina.x + i * f.width, L.stamina.y));
    this.arrow.setPosition(L.arrow.x, L.arrow.y);
    this.heat.setPosition(L.tension.x + this.tensionFrame.width + VIEW.hud.gap, L.tension.y + Math.round(this.tensionFrame.height / 2));
    this.snagText.setPosition(L.distance.x, L.stamina.y - VIEW.hud.gap * 4);
    // Wetter-Block rechts oben, rechtsbündig
    const right = L.weather.x;
    const g = VIEW.hud.gap;
    this.fridolin.setPosition(right - this.fridolin.width, L.weather.y);
    this.nextIcon.setPosition(this.fridolin.x - this.nextIcon.width, L.weather.y + g);
    this.weatherIcon.setPosition(this.nextIcon.x - this.weatherIcon.width - g * 2, L.weather.y + g);
    // Uhr + Tageszeit unter dem Wetter-Block, rechtsbündig (Textbreite ändert sich mit der Sprache)
    this.timeText.setOrigin(1, 0).setPosition(right, L.weather.y + this.fridolin.height + g);
    this.windArrow.setPosition(this.weatherIcon.x + this.weatherIcon.width, L.weather.y + this.weatherIcon.height + g * 2);
    this.placeClock();
    this.placeBanner();
  }

  /** Banner mittig, aber auf ganzen Pixeln (Textbreite kann ungerade sein). */
  private placeBanner(): void {
    if (this.lay) this.banner.setPosition(Math.round(this.lay.banner.x - this.banner.width / 2), this.lay.banner.y);
  }

  private placeClock(): void {
    this.clock.setPosition(Math.round(this.timeText.x - this.timeText.width - VIEW.hud.gap - this.clock.width), this.timeText.y);
  }

  /** Kurze Meldung oben (Text kommt schon übersetzt). */
  say(text: string, color: string = VIEW.colors.text): void {
    this.bannerQueue.push({ text, color });
  }

  update(dt: number, f: HudFrame): void {
    const L = this.lay;
    if (!L) return;
    const aiming = f.rodState === 'Idle' || f.rodState === 'Casting';
    const inWater = f.rodState === 'Sinking' || f.rodState === 'Waiting' || f.rodState === 'Nibble' || f.rodState === 'Bite';
    const fight = f.rodState === 'Reeling' && f.drill !== null;

    // Wurfkraft
    for (const o of [this.powerFrame, this.powerFill, this.powerMarker]) o.setVisible(aiming);
    if (aiming) {
      const pw = windowOf(this.scene, HUD_ATLAS, 'hud_power_frame_still_0');
      const h = Math.round(Math.max(0, Math.min(1, f.castPower)) * pw.h);
      this.powerFill.setCrop(0, pw.h - h, pw.w, h);
      const my = L.gauge.y + pw.y + Math.round((1 - f.perfectMin) * pw.h);
      this.powerMarker.setPosition(L.gauge.x + pw.x + Math.round((pw.w - this.powerMarker.width) / 2), my - Math.round(this.powerMarker.height / 2));
    }

    // Tiefe
    for (const o of [this.depthScale, this.depthFill, this.depthMarker]) o.setVisible(inWater);
    this.shortText.setVisible(inWater && f.lineTooShort);
    if (inWater) {
      const dw = windowOf(this.scene, HUD_ATLAS, 'hud_depth_scale_still_0');
      const tip = anchorOf(this.scene, HUD_ATLAS, 'hud_depth_marker_still_0', 'spitze') ?? { x: 0, y: 0 };
      const y = L.gauge.y + dw.y + Math.round((Math.min(f.depthM, f.maxDepthM) / Math.max(1, f.maxDepthM)) * dw.h);
      this.depthMarker.setPosition(L.gauge.x + dw.x + dw.w - tip.x, y - tip.y);
      if (f.lineTooShort) {
        this.shortText.setText(t('scene.lineTooShort'));
        this.shortText.x = L.gauge.x + this.depthScale.width + VIEW.hud.gap * 3 + (Math.floor(this.scene.time.now / 80) % 2);
      }
    }

    // Drill
    const drillObjs: Phaser.GameObjects.GameObject[] = [this.tensionFrame, ...this.tensionTiles, this.needle, this.distFrame, ...this.distTiles, this.distIcon, this.boatIcon, ...this.fins];
    for (const o of drillObjs) (o as Img).setVisible(fight);
    this.arrow.setVisible(false);
    this.heat.clear();
    this.snagText.setVisible(false);
    if (fight && f.drill) this.updateDrill(f.drill, f);

    // Wetter, Zeit, Vorhersage, Wind
    const timeLabel = t(`time.${f.phase}`);
    if (this.timeText.text !== timeLabel) { this.timeText.setText(timeLabel); this.placeClock(); }
    this.weatherIcon.setFrame(WEATHER_ICON[f.weather] ?? 'wetter_sonnig_still_0');
    this.nextIcon.setVisible(f.nextWeather !== null);
    if (f.nextWeather) this.nextIcon.setFrame(WEATHER_ICON[f.nextWeather] ?? 'wetter_sonnig_still_0');
    this.windArrow.setVisible(f.wind !== 0);
    const windAnim = f.wind > 0 ? 'hud_wind_right_flutter' : 'hud_wind_left_flutter';
    if (f.wind !== 0 && this.windArrow.anims.currentAnim?.key !== windAnim) this.windArrow.play(windAnim);

    // Meldungen
    this.bannerLeft -= dt;
    if (this.bannerLeft <= 0) {
      const next = this.bannerQueue.shift();
      if (next) {
        this.banner.setText(next.text).setColor(next.color).setVisible(true);
        this.placeBanner();
        this.bannerLeft = VIEW.bannerS;
      } else this.banner.setVisible(false);
    }
  }

  private updateDrill(d: DrillState, f: HudFrame): void {
    const L = this.lay;
    const tw = windowOf(this.scene, HUD_ATLAS, 'hud_tension_frame_still_0');
    const n = this.tensionTiles.length;
    this.tensionTiles.forEach((tile, i) => {
      const c = (i + 1 / 2) / n;
      const frame = c >= f.redFrom ? 'rot' : c >= d.zone.lo && c <= d.zone.hi ? 'gruen' : c > d.zone.hi ? 'gelb' : 'leer';
      tile.setFrame(`hud_tension_zone_${frame}_still_0`);
    });
    const tip = anchorOf(this.scene, HUD_ATLAS, 'hud_tension_needle_still_0', 'spitze') ?? { x: 0, y: 0 };
    this.needle.setPosition(L.tension.x + tw.x + Math.round(d.tension * tw.w) - tip.x, L.tension.y + tw.y + Math.round(tw.h / 2) - tip.y);

    const frac = Math.max(0, Math.min(1, d.distance / Math.max(Number.EPSILON, d.b.drill.distance.max)));
    const lit = Math.round(frac * this.distTiles.length);
    this.distTiles.forEach((tile, i) => tile.setVisible(i < lit));
    const dist = windowOf(this.scene, HUD_ATLAS, 'hud_distance_frame_still_0');
    this.distIcon.setPosition(L.distance.x + dist.x + lit * (this.distTiles[0]?.width ?? 0) - Math.round(this.distIcon.width / 2), L.distance.y - this.distIcon.height);

    const st = d.staminaMax > 0 ? d.displayStamina / d.staminaMax : 0;
    this.fins.forEach((fin, i) => {
      const v = st * this.fins.length - i;
      fin.setFrame(v >= 1 ? 'hud_stamina_full_still_0' : v >= 1 / 2 ? 'hud_stamina_half_still_0' : 'hud_stamina_empty_still_0');
    });

    const showArrow = !d.invisible && !d.snag;
    this.arrow.setVisible(showArrow);
    if (showArrow) {
      const key = `hud_arrow_${d.pullDir}_pulse`;
      if (this.lastArrow !== key || !this.arrow.anims.isPlaying) { this.lastArrow = key; this.arrow.play(key); }
    }

    if (d.behavior === 'Hitzkopf') {
      const w = VIEW.hud.heatW;
      const h = VIEW.hud.heatH;
      this.heat.fillStyle(hexToInt(VIEW.colors.heatBg), 1).fillRect(0, 0, w, h);
      this.heat.fillStyle(hexToInt(VIEW.colors.heat), 1).fillRect(0, 0, Math.round(Math.min(1, d.heat / f.heatBreakAt) * w), h);
    }
    if (d.snag) {
      this.snagText.setText(t('scene.snagDrill', { count: d.snag.count, needed: d.snag.needed })).setVisible(true);
    }
  }

  /** Hänger im Wasser (nicht im Drill) */
  showSnag(s: { count: number; needed: number } | null): void {
    if (!s) return;
    this.snagText.setText(t('scene.snag', { count: s.count, needed: s.needed })).setVisible(true);
  }
}

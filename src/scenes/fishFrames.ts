/**
 * Baut Animations-Gruppen aus Atlas-Frame-Namen (Konvention: <assetKey>_<clip>_<frame>).
 * Reine Logik ohne Phaser → testbar.
 */
export const FISH_CLIPS = ['swim', 'idle', 'struggle', 'caught'] as const;
export type FishClip = (typeof FISH_CLIPS)[number];

export interface FrameGroup {
  assetKey: string;
  clip: string;
  frames: string[];
}

const FRAME_RE = /^(fish_[a-z]+_\d{3}_[a-z0-9-]+)_([a-z]+)_(\d+)$/;

export function groupFishFrames(frameNames: Iterable<string>): FrameGroup[] {
  const groups = new Map<string, { assetKey: string; clip: string; frames: [number, string][] }>();
  for (const name of frameNames) {
    const m = FRAME_RE.exec(name);
    if (!m) continue;
    const [, assetKey = '', clip = '', idx = '0'] = m;
    const key = `${assetKey}_${clip}`;
    let g = groups.get(key);
    if (!g) {
      g = { assetKey, clip, frames: [] };
      groups.set(key, g);
    }
    g.frames.push([Number(idx), name]);
  }
  return [...groups.values()]
    .map((g) => ({ assetKey: g.assetKey, clip: g.clip, frames: g.frames.sort((a, b) => a[0] - b[0]).map((f) => f[1]) }))
    .sort((a, b) => (a.assetKey + a.clip).localeCompare(b.assetKey + b.clip));
}

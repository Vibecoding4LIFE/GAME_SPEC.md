// Pixel-Perfect-Skalierung: ganzzahliger Faktor, Quer- (640x360) oder Hochformat (360x640).
export const LANDSCAPE = { w: 640, h: 360 } as const;
export const PORTRAIT = { w: 360, h: 640 } as const;

export function pickLayout(winW: number, winH: number) {
  return winH > winW ? PORTRAIT : LANDSCAPE;
}

export function integerZoom(winW: number, winH: number, w: number, h: number): number {
  return Math.max(1, Math.floor(Math.min(winW / w, winH / h)));
}

// src/ui/frames.ts – 9-Slice-Rahmen (B5) über border-image. Ohne PNG zeichnet theme.css einen CSS-Rand.
// Die Bilder werden erst eingeschaltet, wenn sie sicher existieren (sonst 404 in der Konsole).

export interface FrameImageOptions {
  /** URL des Holzrahmens, z. B. `${import.meta.env.BASE_URL}assets/ui/frame_wood.png`. */
  wood?: string;
  parchment?: string;
  /** Eckgröße im PNG in Bildpixeln (border-image-slice). Standard 8. */
  slice?: number;
  /** Ganzzahliger Anzeigefaktor (CSS-px pro Bildpixel). Standard 2. */
  scale?: number;
}

/** Schaltet die PNG-Rahmen ein (z. B. nachdem Phaser sie geladen hat). */
export function enableFrameImages(o: FrameImageOptions): void {
  const root = document.documentElement;
  const slice = o.slice ?? 8;
  const scale = Math.max(1, Math.round(o.scale ?? 2));
  root.style.setProperty('--frame-slice', String(slice));
  root.style.setProperty('--frame-img-w', `${slice * scale}px`);
  if (o.wood) {
    root.style.setProperty('--frame-wood-img', `url("${o.wood}")`);
    root.classList.add('ui-frame-img-wood');
  }
  if (o.parchment) {
    root.style.setProperty('--frame-parchment-img', `url("${o.parchment}")`);
    root.classList.add('ui-frame-img-parchment');
  }
}

/**
 * Prüft per Image-Load, ob die Rahmen-PNGs da sind, und schaltet sie dann ein.
 * Achtung: fehlt eine Datei, meldet der Browser einen 404. Darum nur aufrufen, wenn die Datei laut Asset-Liste existiert.
 */
export async function probeFrameImages(o: FrameImageOptions): Promise<void> {
  const ok = (url?: string) =>
    url
      ? new Promise<string | undefined>((res) => {
          const img = new Image();
          img.onload = () => res(url);
          img.onerror = () => res(undefined);
          img.src = url;
        })
      : Promise.resolve(undefined);
  const [wood, parchment] = await Promise.all([ok(o.wood), ok(o.parchment)]);
  enableFrameImages({ ...o, wood, parchment });
}

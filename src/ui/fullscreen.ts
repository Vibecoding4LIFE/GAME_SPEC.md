import { t } from '../i18n';

/** Kann der Browser Vollbild? (iPhone-Safari: nein → Knopf ausblenden.) */
export const canFullscreen = (): boolean => typeof document !== 'undefined' && !!document.fullscreenEnabled;

export const isFullscreen = (): boolean => typeof document !== 'undefined' && !!document.fullscreenElement;

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

/**
 * Vollbild-Knopf (B5). Wird ausgeblendet, wenn der Browser kein Vollbild kann (z. B. iPhone-Safari).
 * Hinweis: `HudOverlay` enthält einen eigenen Vollbild-Knopf; dann diesen hier nicht zusätzlich einhängen.
 */
export function mountFullscreenButton(parent: HTMLElement | null): void {
  if (!parent || !canFullscreen()) return;
  const btn = document.createElement('button');
  btn.className = 'overlay-button';
  btn.type = 'button';
  btn.textContent = '⛶';
  btn.setAttribute('aria-label', t('ui.fullscreen'));
  btn.addEventListener('click', toggleFullscreen);
  parent.appendChild(btn);
}

import { t } from '../i18n';

/** Vollbild-Knopf (B5). Wird ausgeblendet, wenn der Browser kein Vollbild kann (z. B. iPhone-Safari). */
export function mountFullscreenButton(parent: HTMLElement | null): void {
  if (!parent || !document.fullscreenEnabled) return;
  const btn = document.createElement('button');
  btn.className = 'overlay-button';
  btn.type = 'button';
  btn.textContent = '⛶';
  btn.setAttribute('aria-label', t('ui.fullscreen'));
  btn.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  });
  parent.appendChild(btn);
}

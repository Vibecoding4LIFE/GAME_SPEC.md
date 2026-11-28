import type Phaser from 'phaser';
import type { PixelLayout } from '../core/pixelScale';

/**
 * Richtet die Hauptkamera einer Szene pixelgenau ein: Ausschnitt in ganzen Gerätepixeln,
 * ganzzahliger Zoom, Weltmitte im Ausschnitt. Szenen arbeiten danach nur noch in Spielpixeln
 * (layout.gameWidth × layout.gameHeight).
 */
export function applyPixelCamera(camera: Phaser.Cameras.Scene2D.Camera, layout: PixelLayout): void {
  const z = layout.deviceZoom;
  camera.setViewport(layout.offsetX, layout.offsetY, layout.gameWidth * z, layout.gameHeight * z);
  camera.setZoom(z);
  camera.setRoundPixels(true);
  camera.centerOn(layout.gameWidth / 2, layout.gameHeight / 2);
}

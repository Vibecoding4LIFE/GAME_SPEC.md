import Phaser from 'phaser';

export class TestScene extends Phaser.Scene {
  constructor() { super('Test'); }
  create() {
    this.add.text(8, 8, 'Köderkönige – Phase 0', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' });
  }
}

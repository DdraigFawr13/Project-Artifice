import * as Phaser from 'phaser';
import wideUrl from '../../assets/wide.png?url';
import { showLoading } from '../ui/loading';

const FONT_WAIT_MS = 3000;

/** Loads the art and the fonts behind the loading screen, then opens the item list. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  private setProgress: (p: number) => void = () => undefined;

  preload(): void {
    this.setProgress = showLoading();
    this.load.on('progress', (p: number) => this.setProgress(p * 0.9));
    this.load.image('wide', wideUrl);
  }

  create(): void {
    // Panels need the pixel faces before they draw, or text jumps when the fonts arrive.
    // A stalled font fetch must not hold the loading screen: after FONT_WAIT_MS the fallback face is used.
    const fonts = Promise.all([document.fonts.load('16px "Pixelify Sans"'), document.fonts.load('14px "Press Start 2P"')]);
    const timeout = new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS));
    Promise.race([fonts, timeout])
      .catch(() => undefined)
      .finally(() => {
        this.setProgress(1);
        this.scene.start('Choose');
      });
  }
}

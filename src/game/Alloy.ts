import * as Phaser from 'phaser';
import hints from '../data/hints.json';
import { itemById, type Item } from '../data/items';
import { checkMix, defaultAlloy, materialQuality, ores } from '../engine/alloy';
import { mixOf, showAlloy, type AlloyPanel } from '../ui/alloy';
import type { GameContext } from './context';

/** Each step's hint shows the first 3 times it is reached (forge spec, Data → hints.json). */
const HINT_TIMES = 3;

/**
 * The alloy screen (mock-up frames 2 and 2b; S5). Starts from the last mix used for the item this page load, else its
 * default. The engine's `checkMix` decides whether the mix can start a craft; the screen only shows the answer.
 */
export class Alloy extends Phaser.Scene {
  private item!: Item;
  private parts: Record<string, number> = {};
  private panel!: AlloyPanel;

  constructor(private readonly ctx: GameContext) {
    super('Alloy');
  }

  init(data: { itemId: string }): void {
    this.item = itemById(data.itemId);
    const start = this.ctx.lastMix[this.item.id] ?? defaultAlloy(this.item);
    this.parts = Object.fromEntries(ores.map((o) => [o.id, start[o.id] ?? 0]));
  }

  create(): void {
    // Counted in memory now, written with the next craft's end, like the heat hint.
    const seen = this.ctx.load.save.hintsSeen;
    const hint = (seen.alloy ?? 0) < HINT_TIMES ? hints.alloy : null;
    seen.alloy = (seen.alloy ?? 0) + 1;

    this.panel = showAlloy(this.item, ores, hint, {
      change: (oreId, by) => {
        const n = this.parts[oreId] ?? 0;
        if (by < 0 ? n <= 0 : checkMix(this.item, mixOf(this.parts)).room <= 0) return;
        this.parts = { ...this.parts, [oreId]: n + by };
        this.refresh();
      },
      start: () => {
        const mix = mixOf(this.parts);
        if (!checkMix(this.item, mix).ok) return;
        this.scene.start('Forge', { itemId: this.item.id, alloy: mix });
      },
      back: () => this.scene.start('Choose', { selectedId: this.item.id }),
    });
    this.refresh();
  }

  private refresh(): void {
    const mix = mixOf(this.parts);
    const check = checkMix(this.item, mix);
    this.panel.update({ parts: this.parts, check, quality: check.ok ? materialQuality(mix) : null });
  }
}

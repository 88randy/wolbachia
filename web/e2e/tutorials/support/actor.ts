import type { Locator, Page } from "@playwright/test";

const GLIDE_STEPS = 28;
const BEFORE_CLICK_MS = 350;
const AFTER_CLICK_MS = 700;
const KEY_DELAY_MS = 70;

/** Slow, visible actions for a recording: the cursor glides to the target, then acts. */
export class Actor {
  constructor(readonly page: Page) {}

  async pause(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  private async glideTo(target: Locator): Promise<void> {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error("Target has no box; it is not visible.");
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: GLIDE_STEPS,
    });
    await this.pause(BEFORE_CLICK_MS);
  }

  /** Moves the cursor onto the target and clicks it. */
  async click(target: Locator): Promise<void> {
    await this.glideTo(target);
    await this.page.mouse.down();
    await this.page.mouse.up();
    await this.pause(AFTER_CLICK_MS);
  }

  /** Points at something without clicking it (to show where to look). */
  async point(target: Locator, holdMs = 1200): Promise<void> {
    await this.glideTo(target);
    await this.pause(holdMs);
  }

  /** Clicks a field and types like a person. */
  async type(target: Locator, text: string): Promise<void> {
    await this.click(target);
    await target.pressSequentially(text, { delay: KEY_DELAY_MS });
    await this.pause(AFTER_CLICK_MS);
  }
}

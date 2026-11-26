import { test } from "@playwright/test";
import { INVENTORY_STEPS } from "./inventory.steps";
import { recordStep } from "./support/record-step";

/** `npm run tutorials:record inventory` (or `-- -g "moveTransfer"` for one tutorial). */
for (const [key, script] of Object.entries(INVENTORY_STEPS)) {
  const [tutorial = "", step = ""] = key.split("/");
  test(`inventory ${key}`, async ({ browser }) => {
    const clip = await recordStep(browser, { module: "inventory", tutorial, step }, script);
    console.log(`CLIP ${key} ${String(Math.round(clip.bytes / 1024))} KB`);
  });
}

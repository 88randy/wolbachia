import { test } from "@playwright/test";
import { MODULE_STEPS } from "./modules.steps";
import { recordStep } from "./support/record-step";
import { MODULE_TUTORIALS } from "../../src/tutorials/definitions/modules";

/** `npm run tutorials:record -- modules` (or `-g "quadrantMap"` for one tutorial). */
for (const [key, script] of Object.entries(MODULE_STEPS)) {
  const [tutorial = "", step = ""] = key.split("/");
  const module =
    (MODULE_TUTORIALS as Record<string, { module: string }>)[tutorial]?.module ?? "misc";
  test(`${module} ${key}`, async ({ browser }) => {
    const clip = await recordStep(browser, { module, tutorial, step }, script);
    console.log(`CLIP ${key} ${String(Math.round(clip.bytes / 1024))} KB`);
  });
}

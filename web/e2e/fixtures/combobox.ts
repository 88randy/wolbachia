import type { Locator, Page } from "@playwright/test";

/** Opens the app's `Combobox` (a button with role combobox, not a native select) and picks one option. */
export async function chooseOption(
  page: Page,
  combobox: Locator,
  option: string | RegExp,
): Promise<void> {
  await combobox.click();
  await page.getByRole("option", { name: option }).click();
}

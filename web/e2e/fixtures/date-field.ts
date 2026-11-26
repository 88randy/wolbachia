import type { Locator, Page } from "@playwright/test";

const MAX_MONTHS = 36;

function dayLabel(iso: string): RegExp {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  const spanishMonth = new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(
    date,
  );
  const englishMonth = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    date,
  );
  return new RegExp(
    `${String(day)} de ${spanishMonth} de ${String(year)}|${englishMonth} ${String(day)}(st|nd|rd|th)?, ${String(year)}`,
  );
}

/**
 * Picks `YYYY-MM-DD` in the app's `DateField` (a button that opens a calendar; the person never
 * types a date). Steps month by month from the month the calendar opens on, so it does not depend
 * on today's date.
 */
export async function pickDate(page: Page, trigger: Locator, iso: string): Promise<void> {
  await trigger.click();
  // Not scoped to a dialog: inside a modal the calendar popover is nested in another dialog.
  const target = page.getByRole("button", { name: dayLabel(iso) }).first();
  const step = page.getByRole("button", {
    name:
      iso < new Date().toISOString().slice(0, 10)
        ? /mes anterior|previous month/i
        : /mes siguiente|next month/i,
  });
  for (let month = 0; month < MAX_MONTHS && (await target.count()) === 0; month += 1) {
    await step.click();
  }
  await target.click();
}

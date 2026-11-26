import { messages } from "@wolbachia/i18n";
import { expect, test } from "./fixtures/test";
import { rememberPreferences } from "./fixtures/a11y";
import { installMapRuntimeApi, interceptSyntheticTiles } from "./fixtures/map-runtime";
import { observeMapWorkers, readMapWorkers } from "./fixtures/map-worker-observation";

test("production MapLibre worker and real canvas clicks draw a block into the unsaved changes", async ({
  page,
  baseURL,
}) => {
  if (!baseURL)
    throw new Error("The map runtime smoke requires the configured production baseURL.");
  const origin = new URL(baseURL).origin;
  const copy = messages.en;
  await rememberPreferences(page, "light", "en");
  await observeMapWorkers(page);
  await installMapRuntimeApi(page);
  const requests = await interceptSyntheticTiles(page, origin);
  // The redesigned map editor mounts its map on load, so the worker starts with the page.
  const started = page.waitForEvent("worker");
  await page.goto("/quadrants/C-DEMO/versions");
  const worker = await started;
  expect(new URL(worker.url()).origin).toBe(origin);
  expect(new URL(worker.url()).pathname).toMatch(/^\/assets\/maplibre-gl-worker-[^/]+\.js$/);
  await expect.poll(async () => (await readMapWorkers(page)).messages).toBeGreaterThan(0);
  await expect.poll(() => requests.tiles.length).toBeGreaterThan(0);
  const canvas = page
    .getByRole("region", { name: copy["mapEditor.map.label"], exact: true })
    .and(page.locator("canvas"));
  await expect(canvas).toBeVisible();
  const unsaved = (count: number) =>
    page.getByLabel(copy["mapEditor.pending.count"].replace("{count}", String(count)));
  await expect(unsaved(0)).toBeVisible();
  await page.getByRole("button", { name: copy["mapEditor.toolShort.block"], exact: true }).click();
  await canvas.click({ position: { x: 40, y: 40 } });
  await canvas.click({ position: { x: 120, y: 40 } });
  await canvas.click({ position: { x: 120, y: 120 } });
  await canvas.press("Enter");
  await expect(unsaved(1)).toBeVisible();
  await expect(page.getByRole("link", { name: copy["geography.map.attribution"] })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/copyright",
  );
  expect((await readMapWorkers(page)).errors).toEqual([]);
  expect(requests.unexpectedOrigins).toEqual([]);
});

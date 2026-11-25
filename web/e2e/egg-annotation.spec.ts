import type { Page } from "@playwright/test";
import type { MessageKey } from "@wolbachia/i18n";
import { messages } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { expect, test } from "./fixtures/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  rememberPreferences,
} from "./fixtures/a11y";
import { mockApi } from "./fixtures/mock-api";
import { makeMe, makeOrganization } from "../src/test/fake-api";

const UPLOAD_ID = "40000000-0000-4000-8000-000000000001";
const ANNOTATION_ID = "40000000-0000-4000-8000-000000000002";
const IMAGE_WIDTH = 4096;
const IMAGE_HEIGHT = 1024;
const BAG_CODE = "B-031";
const BAG_ID = "40000000-0000-4000-8000-000000000003";
const COUNTER = "output[aria-live='polite']";
const DRAFT_DATABASE = "aedesvision-egg-drafts";
const DRAFT_STORE = "drafts";
const DRAFT_IMAGES = "images";
const DRAFT_KEY =
  "aedesvision:annotation:" +
  JSON.stringify(["5f5c4c3e-4a0e-4a64-9a60-1a2b3c4d5e6f", "norte", BAG_CODE, "new"]);
const COMPACT_VIEWPORT = { width: 320, height: 800 };
const VIEWPORTS = [COMPACT_VIEWPORT, { width: 1280, height: 900 }];

function pageOf(results: readonly unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

async function seedPrivateDrafts(page: Page, ageHours = 0) {
  await page.evaluate(
    async ({ databaseName, key, age }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 2);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("drafts");
          request.result.createObjectStore("images");
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(new Error("Unable to open fixture database", { cause: request.error }));
        };
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(["drafts", "images"], "readwrite");
        for (const draftKey of [key, "another-user-org-bag"]) {
          transaction.objectStore("drafts").put(
            {
              version: 2,
              clientId: crypto.randomUUID(),
              marks: [],
              updatedAt: Date.now() - age * 60 * 60 * 1000,
            },
            draftKey,
          );
          transaction
            .objectStore("images")
            .put(new File(["private photo"], "private.png"), draftKey);
        }
        transaction.oncomplete = () => {
          resolve();
        };
        transaction.onerror = () => {
          reject(new Error("Unable to seed fixture database", { cause: transaction.error }));
        };
      });
      database.close();
    },
    { databaseName: DRAFT_DATABASE, key: DRAFT_KEY, age: ageHours },
  );
}

async function storedDraftKeys(page: Page) {
  return page.evaluate(
    async ({ name, images }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 2);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(new Error("Unable to open fixture database", { cause: request.error }));
        };
      });
      const result = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = database.transaction(images).objectStore(images).getAllKeys();
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(new Error("Unable to read fixture database", { cause: request.error }));
        };
      });
      database.close();
      return result;
    },
    { name: DRAFT_DATABASE, images: DRAFT_IMAGES },
  );
}

test("W35 opening purges photos and marks older than 72 hours across draft identities", async ({
  page,
}) => {
  await mockAnnotation(page);
  await page.goto("/lab/egg-counts");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await seedPrivateDrafts(page, 73);
  await page.goto(`/lab/egg-counts/${BAG_CODE}/annotate`);
  await expect(
    page.getByRole("button", {
      name: messages["es-MX"]["labAnnotation.upload.choose"],
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => storedDraftKeys(page)).toEqual([]);
  await expect(
    page.getByRole("dialog", { name: messages["es-MX"]["labAnnotation.recover.title"] }),
  ).toHaveCount(0);
});

for (const transition of ["logout", "session end", "organization change"] as const) {
  test(`W35 ${transition} purges the complete private draft database`, async ({ page }) => {
    await mockAnnotation(page);
    await page.goto("/lab/egg-counts");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await seedPrivateDrafts(page);
    if (transition === "logout") {
      await page.getByRole("button", { name: /Menú de usuario/ }).click();
      await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
    } else {
      const next = makeMe({ organization: makeOrganization("sur", "South") });
      await page.route("**/api/v1/me/", (route) =>
        route.fulfill(
          transition === "session end"
            ? { status: 401, json: { code: "not_authenticated" } }
            : { json: next },
        ),
      );
      await page.evaluate(() => {
        const channel = new BroadcastChannel("wolbachia.session");
        channel.postMessage("changed");
        channel.close();
      });
    }
    await expect
      .poll(() =>
        page.evaluate(
          async (name) => (await indexedDB.databases()).some((database) => database.name === name),
          DRAFT_DATABASE,
        ),
      )
      .toBe(false);
  });
}

test("W35 recovers 1,000 authored marks explicitly and keeps editing responsive", async ({
  page,
}, testInfo) => {
  const text = (key: MessageKey) => messages["es-MX"][key];
  await mockAnnotation(page);
  await page.goto("/lab/egg-counts");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(
    async ({ databaseName, storeName, key, width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((photo) => {
          if (photo) resolve(photo);
          else reject(new Error("Unable to make synthetic photo"));
        }, "image/png");
      });
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 2);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(storeName);
          request.result.createObjectStore("images");
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error ?? new Error("Unable to open draft database"));
        };
      });
      const draft = {
        version: 2,
        updatedAt: Date.now(),
        clientId: crypto.randomUUID(),
        marks: Array.from({ length: 1000 }, (_, index) => ({
          kind: "point",
          x: (index % 100) * 40 + 10,
          y: Math.floor(index / 100) * 80 + 10,
        })),
      };
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction([storeName, "images"], "readwrite");
        transaction
          .objectStore("images")
          .put(new File([blob], "synthetic-paddle.png", { type: "image/png" }), key);
        transaction.objectStore(storeName).put(draft, key);
        transaction.oncomplete = () => {
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Unable to store draft"));
        };
      });
      database.close();
    },
    {
      databaseName: DRAFT_DATABASE,
      storeName: DRAFT_STORE,
      key: DRAFT_KEY,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    },
  );
  await page.goto(`/lab/egg-counts/${BAG_CODE}/annotate`);
  const recovery = page.getByRole("dialog", { name: text("labAnnotation.recover.title") });
  await expect(recovery).toBeVisible();
  await expect(page.locator(COUNTER)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/lab\/egg-counts(?:\?|$)/);
  await page.goto(`/lab/egg-counts/${BAG_CODE}/annotate`);
  await expect(recovery).toBeVisible();
  await recovery.getByRole("button", { name: text("labAnnotation.recover.accept") }).click();
  await page.getByRole("button", { name: text("labAnnotation.tips.skip") }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const canvas = page
    .getByRole("application", { name: text("labAnnotation.canvas.label") })
    .locator("canvas[tabindex='0']");
  await expect(page.locator(COUNTER)).toContainText("1000");
  await canvas.focus();
  await expect(canvas).toBeFocused();
  await page.keyboard.press("Control+z");
  await expect(page.locator(COUNTER)).toContainText("1000");
  await page.keyboard.press("+");
  await page.keyboard.press("h");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("d");
  await page.keyboard.press("Enter");
  await expect(page.locator(COUNTER)).toContainText("1001");
  await page.keyboard.press("Control+z");
  await expect(page.locator(COUNTER)).toContainText("1000");
  await page.screenshot({ path: testInfo.outputPath("W35-1000-marks.png"), fullPage: true });
  await expectNoAxeViolations(page);
});

function candidate(code: string): Schemas["LabQueueCandidate"] {
  return {
    id: BAG_ID,
    code,
    reading_id: "40000000-0000-4000-8000-000000000004",
    expected_revision: 0,
    has_eggs: true,
    is_lagged: false,
    is_index_excluded: false,
  };
}

function counted(value: number): Schemas["LabCount"] {
  return {
    id: "40000000-0000-4000-8000-000000000005",
    bag_id: BAG_ID,
    bag_code: BAG_CODE,
    value,
    annotation_id: ANNOTATION_ID,
    ordinal: 1,
    viable_eggs: null,
    total_examined: null,
    viability_percent: null,
    viability_reason: "not_requested",
    method_version: null,
    method: null,
    verification_id: null,
    rules: {},
    source_proof: {},
    created_at: "2026-11-24T18:00:00Z",
    created_by: "40000000-0000-4000-8000-000000000006",
    voided: false,
    expected_revision: 1,
    current_revision: 1,
    is_current: true,
  };
}

test("W35 history opens an authorized annotation with view-only tools", async ({ page }) => {
  const text = (key: MessageKey) => messages["es-MX"][key];
  const commands: unknown[] = [];
  await mockApi(page, {
    me: makeMe({
      permissions: ["egg_count.read"],
      scope: {
        centers: { mode: "all", ids: [] },
        quadrants: { mode: "all", ids: [] },
      },
    }),
  });
  await page.route("**/api/v1/egg-counts/**", (route) =>
    route.fulfill({ json: pageOf([counted(2)]) }),
  );
  await page.route("**/api/v1/egg-counts/*/annotation/", (route) =>
    route.fulfill({
      json: {
        id: ANNOTATION_ID,
        count: counted(2).id,
        bag: BAG_ID,
        bag_code: BAG_CODE,
        upload_id: UPLOAD_ID,
        image_url: `/api/v1/attachments/${UPLOAD_ID}/download/`,
        image_width: IMAGE_WIDTH,
        image_height: IMAGE_HEIGHT,
        marks: [
          { kind: "box", x: 10, y: 20, w: 12, h: 24 },
          { kind: "point", x: 50, y: 60 },
        ],
        box_count: 1,
        point_count: 1,
        tool_version: "aedesvision-web-1",
        elapsed_seconds: null,
        created_by: "40000000-0000-4000-8000-000000000006",
        created_at: "2026-11-24T18:00:00Z",
      } satisfies Schemas["EggAnnotation"],
    }),
  );
  await page.route("**/api/v1/bags/*/counts/", (route) => {
    commands.push(route.request().postDataJSON());
    return route.fulfill({ status: 403, json: { code: "permission_denied", params: {} } });
  });
  await page.goto("/lab/count-history");
  const photo = await syntheticPhoto(page);
  await page.route(`**/api/v1/attachments/${UPLOAD_ID}/download/`, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: photo.buffer,
    }),
  );
  await page
    .getByRole("button", { name: text("labAnnotation.editor.viewer"), exact: true })
    .click();
  const viewer = page.getByRole("dialog", { name: text("labAnnotation.editor.viewer") });
  await expect(
    viewer.getByText(text("labAnnotation.editor.readOnly"), { exact: true }),
  ).toBeVisible();
  const canvas = viewer.getByRole("application").locator("canvas[tabindex='0']");
  await expect(canvas).toBeVisible();
  await expect(viewer.getByText(text("labAnnotation.canvas.loading"), { exact: true })).toHaveCount(
    0,
  );
  const zoomButton = viewer.getByRole("button", { name: /^Zoom / });
  const zoom = await zoomButton.textContent();
  await canvas.focus();
  await page.keyboard.press("+");
  await expect(zoomButton).not.toHaveText(zoom ?? "");
  await page.keyboard.press("d");
  await page.keyboard.press("Enter");
  await expect(
    viewer.getByRole("button", { name: text("labAnnotation.editor.point"), exact: true }),
  ).toHaveCount(0);
  await expect(
    viewer.getByRole("button", { name: text("labAnnotation.editor.finish"), exact: true }),
  ).toHaveCount(0);
  expect(commands).toEqual([]);
  await expectNoAxeViolations(page);
});

async function mockAnnotation(page: Page) {
  const commands: Schemas["CountWriteRequest"][] = [];
  await mockApi(page, {
    me: makeMe({
      permissions: ["egg_count.create", "egg_count.read", "field.upload"],
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  });
  await page.route("**/api/v1/egg-counts/queue/**", (route) =>
    route.fulfill({ json: pageOf([candidate(BAG_CODE)]) }),
  );
  await page.route("**/api/v1/field/uploads/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/content/")) return route.fulfill({ status: 204 });
    if (path.endsWith("/finalize/"))
      return route.fulfill({
        json: {
          id: UPLOAD_ID,
          state: "verified",
          verified_at: "2026-11-24T18:00:00Z",
          image_width: IMAGE_WIDTH,
          image_height: IMAGE_HEIGHT,
        },
      });
    return route.fulfill({
      status: 201,
      json: {
        upload_id: UPLOAD_ID,
        url: `/api/v1/field/uploads/${UPLOAD_ID}/content/`,
        method: "PUT",
        headers: { "Upload-Lease": "synthetic-annotation-lease", "Content-Type": "image/png" },
        expires_at: "2026-11-24T18:15:00Z",
      },
    });
  });
  await page.route("**/api/v1/bags/*/counts/", (route) => {
    const body = route.request().postDataJSON() as Schemas["CountWriteRequest"];
    commands.push(body);
    return route.fulfill({
      status: 201,
      json: {
        count: counted(body.annotation?.marks.length ?? 0),
        next_bag: candidate("B-032"),
        queue_snapshot: {
          as_of: "2026-11-24T18:00:00Z",
          context: {},
        },
      },
    });
  });
  return commands;
}

async function syntheticPhoto(page: Page) {
  const source = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = "white";
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
  );
  return {
    name: "synthetic-paddle.png",
    mimeType: "image/png",
    buffer: Buffer.from(source ?? "", "base64"),
  };
}

async function startPhotoDrag(page: Page) {
  const photo = await syntheticPhoto(page);
  const transfer = await page.evaluateHandle(
    ({ source, name, type }) => {
      const bytes = Uint8Array.from(atob(source), (character) => character.charCodeAt(0));
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([bytes], name, { type }));
      return dataTransfer;
    },
    { source: photo.buffer.toString("base64"), name: photo.name, type: photo.mimeType },
  );
  const prevented = await transfer.evaluate((dataTransfer) =>
    ["dragenter", "dragover"].map(
      (eventType) =>
        !document.body.dispatchEvent(
          new DragEvent(eventType, { dataTransfer, bubbles: true, cancelable: true }),
        ),
    ),
  );
  expect(prevented).toEqual([true, true]);
  return transfer;
}

async function dropPhotoOnBody(page: Page, language: "es-MX" | "en" = "es-MX") {
  const transfer = await startPhotoDrag(page);
  const overlay = page.getByText(messages[language]["labAnnotation.upload.dropHere"], {
    exact: true,
  });
  await expect(overlay).toBeVisible();
  expect(
    await overlay.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return [x, y, width === innerWidth, height === innerHeight];
    }),
  ).toEqual([0, 0, true, true]);
  await expectNoAxeViolations(page);
  expect(
    await transfer.evaluate(
      (dataTransfer) =>
        !document.body.dispatchEvent(
          new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }),
        ),
    ),
  ).toBe(true);
  await expect(overlay).toHaveCount(0);
  await transfer.dispose();
}

test("W35 unsaved photo keeps focus in its leave dialog and restores browser history on stay", async ({
  page,
}, testInfo) => {
  const text = (key: MessageKey) => messages["es-MX"][key];
  await rememberPreferences(page, "dark", "es-MX");
  await page.setViewportSize(COMPACT_VIEWPORT);
  const commands = await mockAnnotation(page);
  await page.goto("/lab/egg-counts");
  await page
    .getByRole("button", { name: text("labAnnotation.editor.action"), exact: true })
    .click();
  await page
    .getByLabel(text("labAnnotation.upload.picker"), { exact: true })
    .setInputFiles(await syntheticPhoto(page));
  await page.getByRole("button", { name: text("labAnnotation.tips.skip"), exact: true }).click();
  await expect(page.locator(COUNTER)).toContainText("0");
  await page
    .getByRole("button", { name: text("labAnnotation.editor.actions"), exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: text("labAnnotation.editor.back"), exact: true })
    .click();
  const leave = page.getByRole("dialog", { name: text("labAnnotation.leave.title") });
  const stay = leave.getByRole("button", {
    name: text("labAnnotation.summary.cancel"),
    exact: true,
  });
  await expect(stay).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    leave.getByRole("button", { name: text("labAnnotation.leave.accept"), exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(stay).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("W35-unsaved-photo-dialog-dark.png") });
  await page.keyboard.press("Escape");
  await expect(leave).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/lab/egg-counts/${BAG_CODE}/annotate$`));
  const unloadWarning = page.waitForEvent("dialog");
  const reload = page.evaluate(() => {
    window.location.reload();
  });
  const warning = await unloadWarning;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  await reload;

  await page.goBack();
  await expect(stay).toBeFocused();
  await stay.click();
  await expect(leave).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/lab/egg-counts/${BAG_CODE}/annotate$`));
  await expect(page.locator(COUNTER)).toContainText("0");
  await page.goBack();
  await expect(leave).toBeVisible();
  await leave
    .getByRole("button", { name: text("labAnnotation.leave.accept"), exact: true })
    .click();
  await expect(page).toHaveURL(/\/lab\/egg-counts(?:\?|$)/);
  expect(commands).toEqual([]);
});

test("W35 body photo drop opens the canvas and right mouse drag pans without deleting", async ({
  page,
}) => {
  const text = (key: MessageKey) => messages["es-MX"][key];
  await mockAnnotation(page);
  await page.goto(`/lab/egg-counts/${BAG_CODE}/annotate`);
  await expect(
    page.getByRole("button", { name: text("labAnnotation.upload.choose"), exact: true }),
  ).toBeVisible();
  await dropPhotoOnBody(page);
  await page.getByRole("button", { name: text("labAnnotation.tips.skip"), exact: true }).click();
  const canvas = page.getByRole("application").locator("canvas[tabindex='0']");
  await expect(canvas).toBeVisible();
  await expect(page.getByText(text("labAnnotation.canvas.loading"), { exact: true })).toHaveCount(
    0,
  );
  await canvas.focus();
  await page.keyboard.press("h");
  await expect(canvas).toHaveCSS("cursor", "grab");
  await page.keyboard.press("d");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Canvas geometry unavailable");
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await page.mouse.click(center.x, center.y);
  await expect(page.locator(COUNTER)).toContainText("1");
  const contextMenuPrevented = canvas.evaluate(
    (element) =>
      new Promise<boolean>((resolve) => {
        document.addEventListener(
          "contextmenu",
          (event) => {
            if (event.target === element) resolve(event.defaultPrevented);
          },
          { once: true },
        );
      }),
  );
  await page.mouse.down({ button: "right" });
  await expect(canvas).toHaveCSS("cursor", "grab");
  await expect(page.locator(COUNTER)).toContainText("1");
  await page.mouse.move(center.x + 50, center.y + 30, { steps: 5 });
  await expect(canvas).toHaveCSS("cursor", "grabbing");
  await page.mouse.up({ button: "right" });
  expect(await contextMenuPrevented).toBe(true);
  await expect(canvas).toHaveCSS("cursor", "crosshair");
  await expect(page.locator(COUNTER)).toContainText("1");
  await page.mouse.click(center.x + 50, center.y + 30, { button: "right" });
  await expect(page.locator(COUNTER)).toContainText("0");
});

async function expectUncoveredCanvas(canvas: ReturnType<Page["locator"]>) {
  await canvas.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) ===
          element
        );
      }),
    )
    .toBe(true);
}

async function expectStableDraftStatus(page: Page, canvas: ReturnType<Page["locator"]>) {
  const status = page.locator("p[role='status']");
  await expect(status).not.toBeEmpty();
  const saved = await status.textContent();
  await status.evaluate((element) => {
    element.textContent = "";
  });
  const size = () =>
    canvas.evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    });
  const emptySize = await size();
  await status.evaluate((element, text) => {
    element.textContent = text;
  }, saved);
  await expect.poll(size).toEqual(emptySize);
}

async function expectWorkspaceLayout(page: Page, canvas: ReturnType<Page["locator"]>) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Canvas geometry unavailable");
  expect(bounds.height).toBeGreaterThanOrEqual(420);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) + 1);
  const toolbar = page.getByRole("group", { name: /^(Contar en foto|Count on photo)$/ });
  for (const element of [toolbar, toolbar.getByRole("button").last()]) {
    const control = await element.boundingBox();
    if (!control) throw new Error("Toolbar control geometry unavailable");
    expect(control.x).toBeGreaterThanOrEqual(bounds.x);
    expect(control.x + control.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    expect(control.y).toBeGreaterThanOrEqual(bounds.y);
  }
}

async function exerciseSettingsControls(page: Page, text: (key: MessageKey) => string) {
  const panel = page.getByRole("dialog", { name: text("labAnnotation.editor.panel"), exact: true });
  const width = panel.getByRole("slider", { name: text("labAnnotation.editor.defaultWidth") });
  await width.focus();
  await page.keyboard.press("ArrowRight");
  await expect(width).toHaveValue("13");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(width).toHaveValue("23");
  const grid = panel.getByRole("slider", { name: text("labAnnotation.editor.gridSize") });
  await grid.focus();
  await page.keyboard.press("ArrowRight");
  await expect(grid).toHaveValue("320");
  const swatches = panel.getByRole("radiogroup", {
    name: text("labAnnotation.editor.markerColor"),
  });
  await expect(swatches.getByRole("radio")).toHaveCount(5);
  await swatches.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(swatches.getByRole("radio").nth(1)).toBeChecked();
  await expect(swatches.getByRole("radio").nth(1)).toBeFocused();
  await panel.getByRole("button", { name: text("labAnnotation.editor.switchToBox") }).click();
  await expect(
    panel.getByRole("button", { name: text("labAnnotation.editor.switchToPoint") }),
  ).toBeVisible();
  const guide = panel.getByRole("button", { name: text("labAnnotation.editor.guide") });
  await guide.click();
  await expect(
    page.getByRole("dialog", { name: text("labAnnotation.tips.title"), exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guide).toBeFocused();
}

async function expectSettingsLayout(page: Page, text: (key: MessageKey) => string) {
  const panel = page.getByRole("dialog", { name: text("labAnnotation.editor.panel"), exact: true });
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport geometry unavailable");
  await expect
    .poll(async () => {
      const bounds = await panel.boundingBox();
      return bounds ? bounds.x + bounds.width : Infinity;
    })
    .toBeLessThanOrEqual(viewport.width);
  const bounds = await panel.boundingBox();
  if (!bounds) throw new Error("Settings geometry unavailable");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  expect(bounds.width).toBeLessThanOrEqual(Math.min(viewport.width, 340));
  expect(
    await panel.evaluate((element) =>
      [element, ...element.querySelectorAll("*")].some(
        (child) =>
          /auto|scroll/.test(getComputedStyle(child).overflowY) &&
          child.scrollHeight > child.clientHeight,
      ),
    ),
  ).toBe(true);
  const close = panel.getByRole("button", { name: text("common.actions.close"), exact: true });
  const guide = panel.getByRole("button", { name: text("labAnnotation.editor.guide") });
  await guide.focus();
  await expect(panel.locator("tbody th").first()).toHaveCSS("text-align", "start");
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(guide).toBeFocused();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
}

for (const theme of ["light", "dark"] as const) {
  for (const language of ["es-MX", "en"] as const) {
    test(`W35 photo annotation keyboard and reflow: ${theme}, ${language}`, async ({
      page,
    }, testInfo) => {
      const text = (key: MessageKey) => messages[language][key];
      await rememberPreferences(page, theme, language);
      const commands = await mockAnnotation(page);
      await page.setViewportSize(COMPACT_VIEWPORT);
      await page.goto("/lab/egg-counts");
      await page
        .getByRole("button", { name: text("labAnnotation.editor.action"), exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/lab/egg-counts/${BAG_CODE}/annotate`));
      await expect(page).toHaveTitle(
        `${text("labAnnotation.editor.action")} · ${BAG_CODE} · AedesVision`,
      );
      const picker = page.getByLabel(text("labAnnotation.upload.picker"), { exact: true });
      await expect(picker).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
      await expect(picker).not.toHaveAttribute("capture");
      await expect(picker).toBeHidden();
      await dropPhotoOnBody(page, language);
      await page
        .getByRole("button", { name: text("labAnnotation.tips.skip"), exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const canvas = page
        .getByRole("application", { name: text("labAnnotation.canvas.label") })
        .locator("canvas[tabindex='0']");
      await expect(canvas).toBeVisible();
      await expect(
        page.getByText(text("labAnnotation.canvas.loading"), { exact: true }),
      ).toHaveCount(0);
      await canvas.focus();
      await expect(canvas).toBeFocused();
      await page.keyboard.press("b");
      await page.keyboard.press("Enter");
      await expect(page.locator(COUNTER)).toContainText("1");
      await page.keyboard.press("d");
      await expect(
        page.getByRole("button", { name: text("labAnnotation.editor.point"), exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Enter");
      await expect(page.locator(COUNTER)).toContainText("2");
      await page.keyboard.press("Control+z");
      await expect(page.locator(COUNTER)).toContainText("1");
      await page.keyboard.press("Control+Shift+z");
      await expect(page.locator(COUNTER)).toContainText("2");
      await page.keyboard.press("g");
      const beforeSettings = await canvas.boundingBox();
      await page.keyboard.press("s");
      await expect(page.getByLabel(text("labAnnotation.editor.defaultWidth"))).toBeVisible();
      await expect(
        page.getByRole("switch", { name: text("labAnnotation.editor.gridLabel"), exact: true }),
      ).toBeChecked();
      await exerciseSettingsControls(page, text);
      expect(await canvas.boundingBox()).toEqual(beforeSettings);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(canvas).toBeFocused();
      expect(await canvas.boundingBox()).toEqual(beforeSettings);
      await page.keyboard.press("?");
      const shortcuts = page.getByRole("dialog", {
        name: text("labAnnotation.shortcuts.title"),
        exact: true,
      });
      await expect(shortcuts.getByRole("table")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(canvas).toBeFocused();
      await page
        .getByRole("button", { name: text("labAnnotation.editor.actions"), exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: text("labAnnotation.editor.help"), exact: true })
        .click();
      await expect(shortcuts).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(canvas).toBeFocused();
      await page.evaluate(() => {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        for (const name of Array.from(computed).filter(
          (property) => property.startsWith("--web-type-") && property.endsWith("-font-size"),
        ))
          root.style.setProperty(
            name,
            String(Number.parseFloat(computed.getPropertyValue(name)) * 1.3) + "px",
          );
      });
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await canvas.focus();
        await page.keyboard.press("r");
        await expectNoHorizontalScroll(page);
        await expectWorkspaceLayout(page, canvas);
        await expectStableDraftStatus(page, canvas);
        await expectUncoveredCanvas(canvas);
        await expectNoAxeViolations(page);
        const beforePanel = await canvas.boundingBox();
        await page.keyboard.press("s");
        await expectSettingsLayout(page, text);
        expect(await canvas.boundingBox()).toEqual(beforePanel);
        await page.screenshot({
          path: testInfo.outputPath(`W35-settings-${String(viewport.width)}.png`),
          fullPage: true,
        });
        await page.keyboard.press("Escape");
        await expect(canvas).toBeFocused();
        await page
          .getByRole("button", { name: text("labAnnotation.editor.finish"), exact: true })
          .click();
        const confirmation = page.getByRole("dialog");
        await expect(confirmation).toBeVisible();
        expect(
          await confirmation.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
            );
          }),
        ).toBe(true);
        await page.keyboard.press("Escape");
        await expect(canvas).toBeFocused();
        await page.screenshot({
          path: testInfo.outputPath(`W35-annotation-${String(viewport.width)}.png`),
          fullPage: true,
        });
      }
      await page
        .getByRole("button", { name: text("labAnnotation.editor.finish"), exact: true })
        .click();
      const summary = page.getByRole("dialog");
      await expect(summary).toBeVisible();
      await expectNoAxeViolations(page);
      await summary
        .getByRole("button", { name: text("labAnnotation.summary.save"), exact: true })
        .click();
      await expect.poll(() => commands.length).toBe(1);
      expect(commands[0]?.value).toBe(2);
      expect(commands[0]?.annotation?.marks.map((mark) => mark.kind)).toEqual(["box", "point"]);
      await expect(page).toHaveURL(/\/lab\/egg-counts(?:\?|$)/);
      await expect.poll(() => storedDraftKeys(page)).toEqual([]);
    });
  }
}

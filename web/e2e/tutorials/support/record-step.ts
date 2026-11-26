import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { Actor } from "./actor";
import { credentialsFor } from "./credentials";
import { installCursor } from "./cursor";
import { encodeClip } from "./encode";
import type { ClipId, EncodedClip } from "./encode";

const SIZE = { width: 1280, height: 720 };
const SETTLE_MS = 1200;
const TAIL_MS = 1500;

/** One recorded step: who signs in, where the screen starts and what the cursor does. */
export interface StepScript {
  /** Demo username (see the credentials file). */
  user: string;
  /** Route to open before recording starts, e.g. `/inventory/transfers`. */
  start: string;
  /** True when the script saves data on the shared demo database. Listed in the README. */
  mutates?: boolean;
  run: (actor: Actor) => Promise<void>;
}

async function signIn(context: BrowserContext, user: string): Promise<void> {
  const { username, password } = credentialsFor(user);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.close();
}

/** Signs in on a page that is NOT recorded, then records a second page from the start route on. */
async function openRecordedPage(browser: Browser, script: StepScript, dir: string) {
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir, size: SIZE },
    baseURL: process.env["TUTORIALS_BASE_URL"] ?? "http://127.0.0.1:5173",
    locale: "es-MX",
    reducedMotion: "no-preference",
  });
  await installCursor(context);
  await signIn(context, script.user);
  const page: Page = await context.newPage();
  const openedAt = Date.now();
  await page.goto(script.start);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(SETTLE_MS);
  return { context, page, startSeconds: (Date.now() - openedAt) / 1000 - 0.4 };
}

/** Runs one step against the running app and writes its clip and poster. */
export async function recordStep(
  browser: Browser,
  id: ClipId,
  script: StepScript,
): Promise<EncodedClip> {
  const dir = mkdtempSync(path.join(tmpdir(), "tutorial-clip-"));
  const { context, page, startSeconds } = await openRecordedPage(browser, script, dir);
  await script.run(new Actor(page));
  await page.waitForTimeout(TAIL_MS);
  const video = page.video();
  await context.close();
  if (!video) throw new Error("The page was not recorded.");
  return encodeClip(await video.path(), id, startSeconds);
}

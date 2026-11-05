// Temporary lead script (not committed): screenshots of the #202 style preview.
import { chromium } from "@playwright/test";

const OUT = process.argv[2];
const ONLY = process.argv[3] ?? "";
const BASE = "http://localhost:5302/harness/style-preview.html";
const variants = [
  { name: "desktop-light", width: 1440, height: 900, query: "" },
  { name: "desktop-dark", width: 1440, height: 900, query: "?theme=dark" },
  { name: "narrow-light", width: 390, height: 844, query: "" },
  { name: "narrow-dark", width: 390, height: 844, query: "?theme=dark" },
].filter((v) => v.name.includes(ONLY));
const browser = await chromium.launch();
for (const v of variants) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + v.query, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const w = window.innerWidth;
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > w + 1)
      .slice(0, 6)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)} right=${Math.round(el.getBoundingClientRect().right)}`);
    const scrollers = [...document.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el).overflowY;
      return (s === "auto" || s === "scroll") && el.scrollHeight > el.clientHeight + 50;
    });
    scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight);
    const main = scrollers[0];
    if (main) main.setAttribute("data-shot-scroller", "1");
    return { overflow: document.documentElement.scrollWidth - w, wide, height: main ? main.scrollHeight : 0, client: main ? main.clientHeight : 0 };
  });
  console.log(v.name, JSON.stringify(info), errors.length ? `ERRORS: ${errors.join(" | ")}` : "");
  const steps = info.height ? Math.min(12, Math.ceil(info.height / (info.client - 80))) : 1;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => {
      const el = document.querySelector("[data-shot-scroller]");
      if (el) el.scrollTop = y;
    }, i * (info.client - 80));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${v.name}-${String(i + 1).padStart(2, "0")}.png` });
  }
  await page.close();
}
await browser.close();

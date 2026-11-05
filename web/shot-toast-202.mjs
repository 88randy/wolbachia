// Temporary lead script (not committed): toast with Undo screenshot.
import { chromium } from "@playwright/test";
const OUT = process.argv[2];
const browser = await chromium.launch();
for (const [name, q] of [["light", ""], ["dark", "?theme=dark"]]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:5302/harness/style-preview.html" + q, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: "Ocultar indicador" });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/desktop-${name}-toast-undo.png` });
  await page.close();
}
await browser.close();

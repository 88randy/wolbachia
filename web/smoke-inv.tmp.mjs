import { chromium } from "playwright";
import fs from "node:fs";

const creds = fs.readFileSync(
  "C:/Users/Bravo17/Documents/Proyectos/wolbachia/.claude/worktrees/qa-1110/backend/demo-credentials.local.md",
  "utf8",
);
const pass = (user) => new RegExp(`\\| ${user} \\| [a-z_]+ \\| ([^ |]+) \\|`).exec(creds)?.[1];
const out = "C:/Users/Bravo17/AppData/Local/Temp/claude/9730aaae0720f53e/f6e525f3-3402-4ec3-9a79-0d95e96b0f62/scratchpad/";
const [user, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
await page.goto("http://localhost:5186/");
await page.getByLabel("Usuario").fill(user);
await page.getByLabel("Contraseña", { exact: true }).fill(pass(user));
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForTimeout(2500);
for (const p of paths) {
  await page.goto("http://localhost:5186" + p);
  await page.waitForTimeout(3000);
  const name = p.replace(/[^a-z0-9]+/gi, "_");
  await page.screenshot({ path: out + `inv-${user}${name}.png` });
  console.log(p, "->", page.url().replace("http://localhost:5186", ""), "h1:", await page.locator("h1").first().textContent().catch(() => "-"));
}
console.log("errors:", errors.slice(0, 5));
await browser.close();

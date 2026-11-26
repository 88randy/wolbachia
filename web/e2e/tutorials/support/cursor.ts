import type { BrowserContext } from "@playwright/test";

/**
 * A fake cursor for the recordings: a small dot that follows the mouse and pulses on click.
 * Playwright's own mouse is invisible in video, so without it viewers cannot follow the actions.
 * It exists only while recording (injected from here), never in the app.
 */
const CURSOR_SCRIPT = `
(() => {
  const install = () => {
    if (document.getElementById("tut-cursor")) return;
    const dot = document.createElement("div");
    dot.id = "tut-cursor";
    dot.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;" +
      "border-radius:50%;background:rgba(37,99,235,.35);border:2px solid #1d4ed8;" +
      "pointer-events:none;z-index:2147483647;transition:transform .12s ease-out;";
    document.documentElement.appendChild(dot);
    document.addEventListener("mousemove", (event) => {
      dot.style.left = event.clientX + "px";
      dot.style.top = event.clientY + "px";
    }, true);
    document.addEventListener("mousedown", () => { dot.style.transform = "scale(1.6)"; }, true);
    document.addEventListener("mouseup", () => { dot.style.transform = "scale(1)"; }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
`;

export async function installCursor(context: BrowserContext): Promise<void> {
  await context.addInitScript(CURSOR_SCRIPT);
}

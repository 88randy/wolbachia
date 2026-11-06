import { afterEach, vi } from "vitest";
const originalHitTest = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
afterEach(() => {
  if (originalHitTest) Object.defineProperty(document, "elementFromPoint", originalHitTest);
  else Reflect.deleteProperty(document, "elementFromPoint");
});
/** jsdom has no layout. Install before mount so observed drop targets have stable row geometry. */
export function installTableGeometry() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const row = this.closest("tr");
    if (!row?.parentElement) return new DOMRect(0, 0, 800, 600);
    const index = Array.from(row.parentElement.children).indexOf(row);
    return new DOMRect(0, index * 48, 800, 48);
  });
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: (_x: number, y: number) =>
      Array.from(document.querySelectorAll("tr")).find((row) => {
        const rect = row.getBoundingClientRect();
        return y >= rect.top && y < rect.bottom;
      }) ?? document.body,
  });
}

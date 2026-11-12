import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Issue #26: "no color, radius or font literal in web code; only tokens". Every visual value
 * must be a `var(--...)` from @wolbachia/tokens. This test walks web/src and fails on literals.
 */
const SRC_DIR = join(import.meta.dirname, "..");
const SOURCE_FILE = /\.(css|ts|tsx)$/;
const TEST_FILE = /\.test\.(ts|tsx)$/;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * Known debt, as of 2026-11-11. Entries are `<path relative to web/src, / separators>: <finding>`.
 * The guard keeps failing for anything NEW; an entry may only be removed (a stale entry fails the
 * guard too), so the list can only shrink. Most inline styles here are per-instance values that
 * CSS cannot express (a bar width, a map or diagram position, a chart series color); the rest are
 * literals to move into tokens. None of them is a reason to allow a new one.
 */
const KNOWN_LITERALS: readonly string[] = [
  "dashboards/ChartTooltipBody.tsx: inline style prop",
  "lab/lab.module.css: px font size",
  "portal/PortalMapCanvas.tsx: inline style prop",
  "portal/PortalMapLegend.tsx: inline style prop",
  "styles/global.css: px border radius",
  "tutorials/FlowDiagram.tsx: inline style prop",
  "tutorials/FlowEdges.tsx: inline style prop",
  "tutorials/FlowNodeButton.tsx: inline style prop",
  "ui/SignaturePad.tsx: hex color",
  "ui/SignaturePad.tsx: inline style prop",
  "components/ui/chart.tsx: inline style prop",
  "components/ui/progress.tsx: inline style prop",
  "components/ui/sonner.tsx: inline style prop",
  "components/ui/toggle-group.tsx: inline style prop",
  "inventory/labels/labels.module.css: hex color",
  "inventory/labels/labels.module.css: literal font-family",
  "inventory/labels/labels.module.css: px border radius",
  "quadrants/editor/EditorMap.tsx: inline style prop",
  "quadrants/geography/AreaLabels.tsx: inline style prop",
  "regulatory/arco/ArcoDeadline.tsx: inline style prop",
];
/** Disabled controls that dim their text with opacity (known debt, same ratchet as above). */
const KNOWN_DIMMED: readonly string[] = [
  "data-table/data-table.module.css: .sortButton:hover .sortIcon",
  'styles/global.css: input[type="checkbox"]:disabled,\ninput[type="radio"]:disabled',
  "styles/global.css: select:disabled",
];
function relative(found: string): string {
  return found.replace(SRC_DIR, "").replace(/^[\\/]/, "").replaceAll("\\", "/");
}
function expectOnlyKnown(found: readonly string[], known: readonly string[]) {
  const paths = found.map(relative);
  expect(paths.filter((entry) => !known.includes(entry))).toEqual([]);
  // A fixed offender must leave the list, so it can never come back unnoticed.
  expect(known.filter((entry) => !paths.includes(entry))).toEqual([]);
}

const FORBIDDEN: readonly { name: string; pattern: RegExp }[] = [
  { name: "hex color", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "rgb()/hsl() color", pattern: /\b(?:rgb|hsl)a?\(/i },
  { name: "literal font-family", pattern: /font-family\s*:\s*(?!var\()\S/ },
  { name: "px font size", pattern: /font-size\s*:[^;{}]*\d+px/ },
  { name: "px border radius", pattern: /border-radius\s*:[^;{}]*\d+px/ },
  { name: "inline style prop", pattern: /\bstyle\s*=\s*\{/ },
];

export function findLiterals(source: string): string[] {
  const code = source.replace(BLOCK_COMMENT, "");
  return FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ name }) => name);
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => SOURCE_FILE.test(file) && !TEST_FILE.test(file))
    .filter((file) => !file.split(/[\\/]/).includes("test"))
    .map((file) => join(dir, file));
}

describe("findLiterals (the detector itself)", () => {
  test.each([
    ["color: #1A5DFF;", "hex color"],
    ["background: rgba(0, 0, 0, 0.5);", "rgb()/hsl() color"],
    ["font-family: Arial, sans-serif;", "literal font-family"],
    ["font-size: 14px;", "px font size"],
    ["border-radius: 8px;", "px border radius"],
    ["<div style={{ color: tone }} />", "inline style prop"],
  ])("flags %j", (source, name) => {
    expect(findLiterals(source)).toContain(name);
  });

  test("accepts token variables, ids and comments", () => {
    const source = `/* #FFFFFF */ .a { color: var(--color-text-primary); font-family: var(--font-family); border-radius: var(--radius-sm); } href="#main"`;

    expect(findLiterals(source)).toEqual([]);
  });
});

describe("web/src style literals", () => {
  const files = listSourceFiles(SRC_DIR);

  test("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  test("no color, font or radius literal and no inline style anywhere", () => {
    const offenders = files.flatMap((file) =>
      findLiterals(readFileSync(file, "utf8")).map((name) => `${file}: ${name}`),
    );

    expectOnlyKnown(offenders, KNOWN_LITERALS);
  });

  test("hover, pressed and disabled controls keep their text opaque", () => {
    const offenders = files
      .filter((file) => file.endsWith(".css"))
      .flatMap((file) => {
        const css = readFileSync(file, "utf8").replace(BLOCK_COMMENT, "");
        return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((rule) => {
          const selector = rule[1] ?? "";
          if (!/:(?:hover|active|disabled)\b|\[aria-disabled\b/.test(selector)) return [];
          const opacity = rule[2]?.match(/\bopacity\s*:\s*([^;]+)/)?.[1];
          return opacity !== undefined && Number(opacity.trim()) !== 1
            ? [`${file}: ${selector.trim()}`]
            : [];
        });
      });

    expectOnlyKnown(offenders, KNOWN_DIMMED);
  });

  test("destructive buttons keep their own feedback palette regardless of CSS import order", () => {
    const buttons = readFileSync(join(SRC_DIR, "styles/button.module.css"), "utf8");
    for (const state of ["hover", "pressed"]) {
      expect(buttons).toContain(
        `background: var(--button-${state}-background, var(--button-variant-${state}-background))`,
      );
    }
    for (const [file, selector, role, background, foreground] of [
      ["ui/ui.module.css", ".destructive", "destructive-tint", "bg", "status-critical-fg"],
      ["void/void-dialog.module.css", ".danger", "danger-solid", "fg", "on-action"],
    ] as const) {
      const css = readFileSync(join(SRC_DIR, file), "utf8").replace(BLOCK_COMMENT, "");
      const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
        (match) => match[1]?.trim() === selector,
      )?.[2];
      expect(rule).toContain(`--button-background: var(--color-status-critical-${background})`);
      expect(rule).toContain(`--button-foreground: var(--color-${foreground})`);
      for (const state of ["hover", "pressed"]) {
        expect(rule).toContain(`--button-${state}-background: var(--web-button-${role}-${state})`);
      }
    }
    expect(buttons).toContain("background: var(--button-background, var(--color-action))");
    expect(buttons).toContain("color: var(--button-foreground, var(--color-on-action))");
  });
});

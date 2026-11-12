import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as tokens from "@wolbachia/tokens";
import * as messages from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { createTranslate } from "../../src/i18n/translate.ts";
export interface RenderNode {
  readonly type: string | ((props: Record<string, unknown>) => unknown);
  readonly props: Record<string, unknown>;
}
interface Options {
  readonly locale: Locale;
  readonly scheme: "light" | "dark";
  readonly fontScale: number;
  /** Replaces a module whose path ends with the key (for example a hook that needs services). */
  readonly stubs?: Readonly<Record<string, unknown>>;
}
const SHARED_MODULES: Readonly<Record<string, unknown>> = {
  "@wolbachia/tokens": tokens,
  "@wolbachia/i18n": messages,
  "react-native-safe-area-context": {
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  },
};
function nativeRequire(name: string, options: Options): unknown {
  const theme = options.scheme === "dark" ? tokens.darkTheme : tokens.lightTheme;
  if (Object.hasOwn(SHARED_MODULES, name)) return SHARED_MODULES[name];
  const stub = Object.entries(options.stubs ?? {}).find(([suffix]) => name.endsWith(suffix));
  if (stub) return stub[1];
  if (name.endsWith("I18nProvider.tsx"))
    return { useT: () => createTranslate(options.locale), useLocale: () => options.locale };
  // Header chrome that reads the sync service; none of the screens under test assert on it.
  if (name.endsWith("SyncChip.tsx")) return { SyncChip: () => null };
  if (name.endsWith("NavigationProvider.tsx"))
    return {
      useNavigation: () => ({
        popToRoot: () => undefined,
        pop: () => undefined,
        push: () => undefined,
      }),
    };
  if (name.endsWith("ThemeProvider.tsx"))
    return {
      useTheme: () => ({ theme, scheme: options.scheme }),
      useStyles: (factory: (theme: tokens.Theme) => unknown) => factory(theme),
    };
  if (name === "lucide-react-native")
    // Every icon is a decorative SVG host; the tests assert on labels and targets, not glyphs.
    return new Proxy({}, { get: () => (props: Record<string, unknown>) => node("Svg", props) });
  if (name === "react-native-svg") return { __esModule: true, default: "Svg", Path: "Path" };
  if (name === "react") return { useState: (value: unknown) => [value, () => undefined] };
  if (name === "react/jsx-runtime") return { jsx: node, jsxs: node, Fragment: "Fragment" };
  if (name === "react-native")
    return {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      TextInput: "TextInput",
      Image: "Image",
      Modal: "Modal",
      ScrollView: "ScrollView",
      StyleSheet: { create: (styles: unknown) => styles },
      PixelRatio: { getFontScale: () => options.fontScale },
    };
  return undefined;
}
function node(type: RenderNode["type"], props: RenderNode["props"]): RenderNode {
  return { type, props };
}
/** Executes the actual component modules with native host props; no renderer or device claim. */
export function componentHarness(options: Options) {
  const cache = new Map<string, Record<string, unknown>>();
  const load = (path: string): Record<string, unknown> => {
    const absolute = resolve(fileURLToPath(new URL("../../../", import.meta.url)), path);
    const previous = cache.get(absolute);
    if (previous) return previous;
    const exports: Record<string, unknown> = {};
    cache.set(absolute, exports);
    const source = readFileSync(absolute, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const require = (name: string): unknown =>
      nativeRequire(name, options) ??
      // Bare package names (expo-*, ...) are native modules these host tests never execute.
      (name.startsWith(".") ? load(resolve(dirname(absolute), name)) : {});
    runInNewContext(compiled, { require, exports, module: { exports } }, { filename: absolute });
    return exports;
  };
  return {
    render: (path: string, name: string, props: Record<string, unknown>) => {
      const component = load(path)[name];
      if (typeof component !== "function") throw new Error("Missing component export.");
      return expand(node(component as RenderNode["type"], props));
    },
  };
}
function expand(value: unknown): readonly RenderNode[] {
  if (Array.isArray(value)) return value.flatMap((item: unknown) => expand(item));
  if (!value || typeof value !== "object" || !("type" in value)) return [];
  const element = value as RenderNode;
  if (typeof element.type === "function") return expand(element.type(element.props));
  if (element.type === "Modal" && element.props.visible === false) return [];
  return [element, ...expand(element.props.children)];
}
export function flattenStyle(value: unknown): Record<string, unknown> {
  if (Array.isArray(value))
    return Object.assign({}, ...value.map((item: unknown) => flattenStyle(item))) as Record<
      string,
      unknown
    >;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
/**
 * Minimum touch height of a rendered host node in dp: an explicit `minHeight` style, or the
 * Tailwind class `min-h-N` / `h-N` (N x 4 dp) that the shared kit controls use.
 */
export function minHeightOf(node: RenderNode): number {
  const raw = node.props.style;
  const style =
    typeof raw === "function"
      ? (raw as (input: { pressed: boolean }) => unknown)({ pressed: false })
      : raw;
  const fromStyle = Number(flattenStyle(style).minHeight);
  if (Number.isFinite(fromStyle)) return fromStyle;
  const match = /(?:^|\s)(?:min-)?h-(\d+)(?:\s|$)/.exec(
    typeof node.props.className === "string" ? node.props.className : "",
  );
  return match?.[1] === undefined ? Number.NaN : Number(match[1]) * 4;
}

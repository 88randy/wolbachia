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
}
function nativeRequire(name: string, options: Options): unknown {
  const theme = options.scheme === "dark" ? tokens.darkTheme : tokens.lightTheme;
  if (name === "@wolbachia/tokens") return tokens;
  if (name === "@wolbachia/i18n") return messages;
  if (name.endsWith("I18nProvider.tsx"))
    return { useT: () => createTranslate(options.locale), useLocale: () => options.locale };
  if (name.endsWith("ThemeProvider.tsx"))
    return {
      useTheme: () => ({ theme, scheme: options.scheme }),
      useStyles: (factory: (theme: tokens.Theme) => unknown) => factory(theme),
    };
  if (name === "react-native-svg") return { __esModule: true, default: "Svg", Path: "Path" };
  if (name === "react") return { useState: (value: unknown) => [value, () => undefined] };
  if (name === "react/jsx-runtime") return { jsx: node, jsxs: node, Fragment: "Fragment" };
  if (name === "react-native")
    return {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      TextInput: "TextInput",
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
      nativeRequire(name, options) ?? load(resolve(dirname(absolute), name));
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

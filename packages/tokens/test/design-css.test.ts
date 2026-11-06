/**
 * Every historical design CSS property must still map to an existing token.
 * Issue #202 + the approved preview replace CSS value equality as the visual source of truth.
 * Keeping name coverage catches removed or orphaned semantic roles without freezing old values.
 * Sources: design/mobile/source/codequim.css (baseline) and design/web/source/web.css.
 *
 * Not covered here: web.control, web.focus, web.typography, radius.xs, radius.full and spacing.
 * They come from the approved proposal in docs/web-tokens-diff.md, not from CSS variables.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { parseCustomProperties } from "./helpers/css-parser.ts";
import type { CustomProperties } from "./helpers/css-parser.ts";
import {
  darkContext,
  lightContext,
  mobileOnlyMapping,
  mobileScale130Mapping,
  resolveCssValue,
  sharedMapping,
  webOnlyMapping,
} from "./helpers/mapping.ts";
import type { TokenMapping } from "./helpers/mapping.ts";

const designDirectory = join(import.meta.dirname, "..", "..", "..", "design");
const codequimCss = readFileSync(join(designDirectory, "mobile", "source", "codequim.css"), "utf8");
const webCss = readFileSync(join(designDirectory, "web", "source", "web.css"), "utf8");

/** Guards against a parser that silently finds nothing (counts verified on 2026-11-03). */
const MIN_CODEQUIM_ROOT_PROPERTIES = 37;
const MIN_WEB_ROOT_PROPERTIES = 40;

const mobileMapping: TokenMapping = { ...sharedMapping, ...mobileOnlyMapping };
const webMapping: TokenMapping = { ...sharedMapping, ...webOnlyMapping };

/** Lists unmapped historical properties; resolving the path rejects missing/non-leaf tokens. */
function findProblems(
  properties: CustomProperties,
  mapping: TokenMapping,
  context: object,
): string[] {
  return Object.keys(properties).flatMap((name) => {
    const path = mapping[name];
    if (path === undefined) {
      return [`--${name}: no token mapped`];
    }
    resolveCssValue(context, path);
    return [];
  });
}

void describe("codequim.css maps to tokens", () => {
  void test(":root names cover the light theme and shared scales", () => {
    const rootProperties = parseCustomProperties(codequimCss, ":root");

    const problems = findProblems(rootProperties, mobileMapping, lightContext);

    assert.ok(
      Object.keys(rootProperties).length >= MIN_CODEQUIM_ROOT_PROPERTIES,
      "parser found too few properties",
    );
    assert.deepEqual(problems, []);
  });

  void test(".dark values (over :root) match the dark theme", () => {
    const darkProperties = {
      ...parseCustomProperties(codequimCss, ":root"),
      ...parseCustomProperties(codequimCss, ".dark"),
    };

    const problems = findProblems(darkProperties, mobileMapping, darkContext);

    assert.deepEqual(problems, []);
  });

  void test(".x130 names cover the 130 % type scale", () => {
    const scaleProperties = parseCustomProperties(codequimCss, ".x130");

    const problems = findProblems(scaleProperties, mobileScale130Mapping, lightContext);

    assert.equal(Object.keys(scaleProperties).length, 7);
    assert.deepEqual(problems, []);
  });
});

void describe("web.css maps to tokens", () => {
  void test(":root names cover the light theme and web-only tokens", () => {
    const rootProperties = parseCustomProperties(webCss, ":root");

    const problems = findProblems(rootProperties, webMapping, lightContext);

    assert.ok(
      Object.keys(rootProperties).length >= MIN_WEB_ROOT_PROPERTIES,
      "parser found too few properties",
    );
    assert.deepEqual(problems, []);
  });

  void test(".dark values (over :root) match the dark theme and web-only tokens", () => {
    const darkProperties = {
      ...parseCustomProperties(webCss, ":root"),
      ...parseCustomProperties(webCss, ".dark"),
    };

    const problems = findProblems(darkProperties, webMapping, darkContext);

    assert.deepEqual(problems, []);
  });
});

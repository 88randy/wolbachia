import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { darkTheme, lightTheme, mobileTypeScale, mobileTypeScale130, spacing, web } from '../src/index.ts';

const HEX_COLOR = /^#[0-9A-F]{6}$/;
const RGBA_COLOR = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 0\.\d+\)$/;
const TEXT_ENLARGEMENT = 1.3;
const SPACING_HALF_STEP = 4;

/** Dotted paths of every leaf of a nested object, sorted. */
function leafPaths(node: object, prefix = ''): string[] {
  return Object.entries(node)
    .flatMap(([key, value]) =>
      typeof value === 'object' && value !== null
        ? leafPaths(value, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    )
    .sort();
}

function leafValues(node: object): string[] {
  return Object.values(node).flatMap((value) =>
    typeof value === 'object' && value !== null ? leafValues(value) : [String(value)],
  );
}

describe('themes', () => {
  test('light and dark themes have the same keys', () => {
    const lightKeys = leafPaths(lightTheme);

    const darkKeys = leafPaths(darkTheme);

    assert.deepEqual(darkKeys, lightKeys);
  });

  test('web light and dark variants have the same keys', () => {
    assert.deepEqual(leafPaths(web.dark), leafPaths(web.light));
  });

  test('every color is a hex or rgba value', () => {
    const colors = [...leafValues(lightTheme), ...leafValues(darkTheme), ...leafValues(web.light), ...leafValues(web.dark)];

    const invalid = colors.filter((value) => !HEX_COLOR.test(value) && !RGBA_COLOR.test(value));

    assert.deepEqual(invalid, []);
  });
});

describe('scales', () => {
  test('the 130 % type scale is the default scale times 1.3, rounded', () => {
    const expected = Object.fromEntries(
      Object.entries(mobileTypeScale).map(([step, size]) => [step, Math.round(size * TEXT_ENLARGEMENT)]),
    );

    assert.deepEqual({ ...mobileTypeScale130 }, expected);
  });

  test('spacing is a multiple of the 4 px half step', () => {
    const offGrid = Object.values(spacing).filter((value) => value % SPACING_HALF_STEP !== 0);

    assert.deepEqual(offGrid, []);
  });

  test('web text is never smaller than the minimum', () => {
    const { typography } = web;

    assert.ok(typography.labelSmallFontSize >= typography.minimumFontSize);
    assert.ok(typography.labelFontSize >= typography.minimumFontSize);
    assert.ok(typography.bodyFontSize >= typography.minimumFontSize);
  });
});

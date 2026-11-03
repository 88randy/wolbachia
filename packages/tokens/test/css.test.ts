import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DARK_SELECTOR,
  flattenToCssVariables,
  renderTokensCss,
  toCssValue,
  toKebabCase,
} from '../src/css.ts';
import { parseCustomProperties } from './helpers/css-parser.ts';

describe('css naming and values', () => {
  test('toKebabCase handles camelCase and decimal keys', () => {
    assert.equal(toKebabCase('actionStrong'), 'action-strong');
    assert.equal(toKebabCase('0.5'), '0-5');
  });

  test('toCssValue appends px to numbers and keeps strings', () => {
    assert.equal(toCssValue(12), '12px');
    assert.equal(toCssValue('#3772FF'), '#3772FF');
  });

  test('flattenToCssVariables walks nested groups', () => {
    const variables = flattenToCssVariables({ status: { success: { fg: '#0B6B35' } }, size: 8 }, '--x');

    assert.deepEqual(variables, { '--x-status-success-fg': '#0B6B35', '--x-size': '8px' });
  });

  test('flattenToCssVariables rejects unsupported leaves', () => {
    assert.throws(() => flattenToCssVariables({ broken: null }, '--x'), TypeError);
  });
});

const THEMED_PREFIXES = ['color-', 'web-sidebar', 'web-map', 'web-chart', 'web-band'];

function isThemed(name: string): boolean {
  return THEMED_PREFIXES.some((prefix) => name.startsWith(prefix));
}

describe('renderTokensCss', () => {
  const css = renderTokensCss();

  test('light values live in :root', () => {
    const light = parseCustomProperties(css, ':root');

    assert.equal(light['color-brand'], '#3772FF');
    assert.equal(light['color-text-primary'], '#0A1A3F');
    assert.equal(light['radius-md'], '12px');
    assert.equal(light['web-chart-2'], '#D9620B');
  });

  test('dark overrides live under the data-theme selector', () => {
    const dark = parseCustomProperties(css, DARK_SELECTOR);

    assert.equal(dark['color-action'], '#7FA4FF');
    assert.equal(dark['web-map-water'], '#16335E');
  });

  test('every themed variable is overridden in dark and nothing else is', () => {
    const light = parseCustomProperties(css, ':root');
    const dark = parseCustomProperties(css, DARK_SELECTOR);

    const themedInLight = Object.keys(light).filter(isThemed);

    assert.deepEqual(Object.keys(dark).sort(), themedInLight.sort());
  });
});

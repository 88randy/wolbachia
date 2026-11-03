/**
 * Writes `dist/tokens.css` from the TypeScript tokens.
 * Run with `npm run build:css` (Node >= 22.6 with `--experimental-strip-types`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderTokensCss } from '../src/css.ts';

const outputFile = join(import.meta.dirname, '..', 'dist', 'tokens.css');

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, renderTokensCss(), 'utf8');
console.log(`Wrote ${outputFile}`);

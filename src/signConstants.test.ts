import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  SIGN_IMAGE_HEIGHT,
  SIGN_IMAGE_WIDTH,
  assertGlassesLayout,
} from './signConstants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

describe('signConstants', () => {
  it('assertGlassesLayout passes for bundled geometry', () => {
    expect(() => assertGlassesLayout()).not.toThrow();
  });

  it('matches src/signDimensions.json', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'src', 'signDimensions.json'), 'utf8');
    const j = JSON.parse(raw) as { SIGN_IMAGE_WIDTH: number; SIGN_IMAGE_HEIGHT: number };
    expect(SIGN_IMAGE_WIDTH).toBe(j.SIGN_IMAGE_WIDTH);
    expect(SIGN_IMAGE_HEIGHT).toBe(j.SIGN_IMAGE_HEIGHT);
  });

  it('build scripts read the same dimensions file', () => {
    const assets = fs.readFileSync(path.join(ROOT, 'scripts', 'build-sign-assets.mjs'), 'utf8');
    const words = fs.readFileSync(path.join(ROOT, 'scripts', 'build-word-signs.mjs'), 'utf8');
    expect(assets).toContain('signDimensions.json');
    expect(words).toContain('signDimensions.json');
  });
});

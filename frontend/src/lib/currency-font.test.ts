import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync('src/index.css', 'utf8');

describe('currency glyph styling', () => {
  it('uses the pixel display font for numbers, currency, and numeric punctuation globally', () => {
    expect(css).toMatch(/font-family:\s*["']Pixel Accents["']/);
    expect(css).toMatch(/unicode-range:\s*U\+0030-0039,\s*U\+002C,\s*U\+002E,\s*U\+003A,\s*U\+20AC/i);
    expect(css).toMatch(/--font-sans:\s*["']Pixel Accents["'],\s*["']Pixelify Sans["']/);
  });
});

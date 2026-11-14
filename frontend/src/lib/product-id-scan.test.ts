import { describe, expect, it } from 'vitest';

// AC15 scans decimal product-ID-like literals; the preceding # excludes CSS hex colours.
const productIdLike = /(?<![A-Za-z0-9#])["']\d{6}["'](?![A-Za-z0-9])/;

describe('AC15 product ID scan boundaries', () => {
  it('matches six decimal digits but ignores six-digit hexadecimal colour values', () => {
    expect(productIdLike.test(`'${['460', '013'].join('')}'`)).toBe(true);
    expect(productIdLike.test("'#475569'")).toBe(false);
    expect(productIdLike.test("'#F6C8A8'")).toBe(false);
    expect(productIdLike.test("'#123456'")).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { ReasonCodeSchema } from '../api/schemas';
import { REASON_TEXT } from './reasons';

describe('REASON_TEXT', () => {
  it('covers every gateway reason with player-facing copy', () => {
    expect(Object.keys(REASON_TEXT).sort()).toEqual([...ReasonCodeSchema.options].sort());
    expect(REASON_TEXT.WITHIN_MANDATE).toBe('Within your mandate.');
    expect(REASON_TEXT.ALLERGEN_EXCLUDED).toBe('Contains an allergen your mandate excludes.');
  });
});

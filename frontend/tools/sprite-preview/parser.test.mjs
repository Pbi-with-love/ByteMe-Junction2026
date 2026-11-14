import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGrids, validateGrid, parsePaletteTable } from './parser.mjs';

test('extracts a named grid and stated dimensions from a text fence', () => {
  const markdown = ['## 4. Art', '**`robot_idle` (2×2)**', '```text', 'ab', '.a', '```'].join('\n');
  const [grid] = extractGrids(markdown, { file: 'art.md' });
  assert.equal(grid.name, 'robot_idle');
  assert.equal(grid.heading, '4. Art');
  assert.deepEqual(grid.rows, ['ab', '.a']);
  assert.deepEqual(grid.statedSize, { width: 2, height: 2 });
});

test('validates dimensions and unknown palette keys', () => {
  assert.deepEqual(validateGrid({ name: 'bad', rows: ['ab', 'a'], statedSize: { width: 3, height: 3 } }, ['a']), [
    'row 2 has 1 pixel; expected 2',
    'size is 2×2 by rows, stated 3×3',
    'unknown palette key "b" at row 1, column 2',
  ]);
});

test('parses key, name, and hex values from palette tables', () => {
  const markdown = '| Key | Name | Hex | Usage |\n|---|---|---|---|\n| `a` | Amber | `#AABBCC` | lamp |';
  assert.deepEqual(parsePaletteTable(markdown), [{ key: 'a', name: 'Amber', hex: '#AABBCC', usage: 'lamp' }]);
});

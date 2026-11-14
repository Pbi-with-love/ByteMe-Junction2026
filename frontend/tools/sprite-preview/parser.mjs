const SIZE = /(\d+)\s*[×xX]\s*(\d+)/;
const cleanCell = (value = '') => value.trim().replace(/^`|`$/g, '');

function labelBefore(lines, fenceIndex) {
  const start = Math.max(0, fenceIndex - 8);
  for (let i = fenceIndex - 1; i >= start; i--) {
    const line = lines[i].trim();
    let match = line.match(/(?:\*\*)?`([A-Za-z][A-Za-z0-9_.-]*)`/);
    if (match && match[1].length === 1) match = null;
    if (match) return { name: match[1], lineIndex: i, text: line };
    match = line.match(/\*\*([A-Za-z][A-Za-z0-9_.-]*)\b/);
    if (match) return { name: match[1], lineIndex: i, text: line };
    match = line.match(/^\s*(?:[-*]\s*)?([A-Za-z][A-Za-z0-9_.-]*)\s*:\s*$/);
    if (match) return { name: match[1], lineIndex: i, text: line };
  }
  return null;
}

export function extractGrids(markdown, { file = '' } = {}) {
  const lines = markdown.split(/\r?\n/);
  const grids = [];
  let heading = '(document)';
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) heading = lines[i].replace(/^#{1,6}\s+/, '').trim();
    if (!/^```text\s*$/.test(lines[i].trim())) continue;
    const label = labelBefore(lines, i);
    const rows = [];
    let end = i + 1;
    for (; end < lines.length && !/^```\s*$/.test(lines[end].trim()); end++) {
      const row = lines[end].trim();
      if (row && /^[.A-Za-z0-9#]+$/.test(row)) rows.push(row);
    }
    if (!rows.length) continue;
    const sizeMatch = (label?.text ?? '').match(SIZE);
    if (!label) continue;
    const inferred = { width: Math.max(...rows.map(row => row.length)), height: rows.length };
    grids.push({ name: label.name, file, heading, rows, statedSize: sizeMatch ? { width: Number(sizeMatch[1]), height: Number(sizeMatch[2]) } : inferred });
    i = end;
  }
  return grids;
}

export function validateGrid(grid, paletteKeys = []) {
  const rows = grid.rows ?? [];
  const width = rows[0]?.length ?? 0;
  const errors = [];
  rows.forEach((row, index) => {
    if (row.length !== width) errors.push(`row ${index + 1} has ${row.length} pixel${row.length === 1 ? '' : 's'}; expected ${width}`);
  });
  const stated = grid.statedSize;
  if (stated && (width !== stated.width || rows.length !== stated.height)) {
    errors.push(`size is ${width}×${rows.length} by rows, stated ${stated.width}×${stated.height}`);
  }
  const keys = new Set(paletteKeys);
  rows.forEach((row, y) => [...row].forEach((key, x) => {
    if (key !== '.' && !keys.has(key)) errors.push(`unknown palette key "${key}" at row ${y + 1}, column ${x + 1}`);
  }));
  return errors;
}

export function parsePaletteTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const headers = lines[i].split('|').slice(1, -1).map(cleanCell).map(x => x.toLowerCase());
    const keyIndex = headers.findIndex(x => x === 'key');
    const nameIndex = headers.findIndex(x => x === 'name');
    const hexIndex = headers.findIndex(x => x === 'hex');
    if (keyIndex < 0 || nameIndex < 0 || hexIndex < 0) continue;
    const usageIndex = headers.findIndex(x => /usage|role/.test(x));
    for (i++; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
      const cells = lines[i].split('|').slice(1, -1).map(cleanCell);
      if (cells.every(x => /^[-: ]+$/.test(x))) continue;
      if (!/^#[\da-f]{6}$/i.test(cells[hexIndex] ?? '') || !cells[keyIndex]) continue;
      entries.push({ key: cells[keyIndex], name: cells[nameIndex] ?? '', hex: cells[hexIndex], usage: cells[usageIndex] ?? '' });
    }
    i--;
  }
  return entries;
}

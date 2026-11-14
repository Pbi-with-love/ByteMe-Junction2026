import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';

export const LEVELS = [
  { levelId: 'level1', title: 'The Weekly Order' },
  { levelId: 'level2', title: 'The Stock-out' },
  { levelId: 'level3', title: 'Allergy Emergency' },
] as const;

export const LEVEL_MOCKS = [level1, level2, level3];

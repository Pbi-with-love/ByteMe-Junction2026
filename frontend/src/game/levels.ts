import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';

export const LEVELS = [
  { levelId: 'level1', title: 'The Weekly Order' },
  { levelId: 'level2', title: 'The Stock-out' },
  { levelId: 'level3', title: 'Allergy Emergency' },
] as const;

export const LEVEL_BRIEFS = {
  level1: {
    title: 'The Weekly Order',
    situation: 'Hotel Aurora needs 1 000 l of lactose-free milk for Monday’s 6 a.m. breakfast. Today is Saturday, and the order must be placed before 14:00.',
    surprise: 'The usual Valio milk has only 700 l that can arrive by Monday. For the other 300 l there are two ways: buy a different product of the same kind that arrives on Monday, or wait for the Valio milk, whose 300 l arrive on Tuesday, which is late.',
    yourPart: 'The robot lays out the options. Your mandate decides how far it may choose on its own.',
  },
  level2: {
    title: 'The Stock-out',
    situation: 'The restaurant has a standing order of 120 l of lactose-free milk, delivered every Wednesday and Friday. Each delivery is bought as its own order.',
    surprise: 'The usual product is blocked for the whole week, so both deliveries need a substitute from the same family of products.',
    yourPart: 'Decide whether the robot may swap in a substitute on its own, or must check with you before each delivery.',
  },
  level3: {
    title: 'Allergy Emergency',
    situation: 'The school kitchen needs 20 l of pistachio ice cream by Thursday 6 a.m. for a pupil with an egg allergy. The usual product is unavailable.',
    surprise: 'The cheapest substitute contains egg. Your mandate does not allow substitutions, so the robot must ask you before it buys anything.',
    yourPart: 'Choose whether the allergen rule is on. It decides what the gateway will let anyone approve.',
  },
} as const;

export const LEVEL_MOCKS = [level1, level2, level3];

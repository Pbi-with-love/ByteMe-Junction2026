export function bestIndexes(values: (number | null | undefined)[], better: 'higher' | 'lower'): number[] {
  const defined = values.flatMap((value, index) => value === null || value === undefined ? [] : [{ value, index }]);
  if (defined.length < 2) return [];
  const best = better === 'higher' ? Math.max(...defined.map(({ value }) => value)) : Math.min(...defined.map(({ value }) => value));
  const winners = defined.filter(({ value }) => value === best);
  return winners.length === defined.length ? [] : winners.map(({ index }) => index);
}

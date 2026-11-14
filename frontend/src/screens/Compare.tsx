import { useEffect, useState } from 'react';
import type { GatewayClient } from '../api/gateway';
import { GatewayError } from '../api/gateway';
import type { Compare as CompareData, GameResult } from '../api/schemas';
import { LEVELS } from '../game/levels';
import { bestIndexes } from '../game/compare';
import { formatMoney, formatPresetLabel } from '../lib/format';
import PixelSprite from '../components/PixelSprite';
import { Stars } from '../components/ResultPanel';
import AgentWorking from '../components/AgentWorking';

type Props = { client: GatewayClient; levelId: string; onBack: () => void; onLoaded?:(data:CompareData)=>void };
const ROWS = [
  { label: 'Approvals asked', field: 'approvalsAsked', better: 'lower' },
  { label: 'Hearts used', field: 'heartsUsed', better: 'lower' },
  { label: 'Hearts left', field: 'heartsLeft', better: 'higher' },
  { label: 'Cost', field: 'totalCost', better: 'lower' },
  { label: 'Kitchen', field: 'kitchen', better: 'higher' },
  { label: 'Wallet', field: 'wallet', better: 'higher' },
  { label: 'Safety', field: 'safety', better: 'higher' },
  { label: 'Stars', field: 'stars', better: 'higher' },
  { label: 'Incident', field: 'incident', better: 'higher' },
] as const;

function shownValue(result: GameResult, field: typeof ROWS[number]['field']): string {
  switch (field) {
    case 'approvalsAsked': return result.approvalsAsked === undefined ? 'Not reported' : String(result.approvalsAsked);
    case 'heartsUsed': return result.heartsUsed === undefined ? 'Not reported' : String(result.heartsUsed);
    case 'heartsLeft': return String(result.heartsLeft);
    case 'totalCost': return result.totalCost === undefined ? 'Not reported' : result.totalCost === null ? 'Nothing ordered' : formatMoney(result.totalCost);
    case 'kitchen': return `${result.kitchen} %`;
    case 'wallet': return String(result.wallet);
    case 'safety': return String(result.safety);
    case 'stars': return `${result.stars} of 3 stars`;
    case 'incident': return result.incident === null ? 'None' : `Safety incident: ${result.incident.reason}`;
  }
}

function rowWinners(results: GameResult[], field: typeof ROWS[number]['field'], better: 'higher' | 'lower') {
  if (field === 'totalCost') {
    const bestKitchen = Math.max(...results.map(({ kitchen }) => kitchen));
    const eligible = results.flatMap((result, index) => result.kitchen === bestKitchen ? [{ result, index }] : []);
    const winners = bestIndexes(eligible.map(({ result }) => result.totalCost?.cents), better);
    if (winners.length > 0) return winners.map((index) => eligible[index]!.index);
    return eligible.length === 1 && eligible[0]!.result.totalCost !== null && eligible[0]!.result.totalCost !== undefined
      ? [eligible[0]!.index]
      : [];
  }
  if (field === 'approvalsAsked' || field === 'heartsUsed' || field === 'kitchen' || field === 'wallet' || field === 'safety' || field === 'heartsLeft') {
    const values = results.map((result) => result[field]);
    return bestIndexes(values, better);
  }
  return [];
}

export default function Compare({ client, levelId, onBack,onLoaded }: Props) {
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    client.compare(levelId).then((response) => { if (active) { setData(response); onLoaded?.(response); } }).catch((reason: unknown) => {
      if (active) setError(reason instanceof GatewayError ? reason.message : reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [client, levelId, onLoaded]);

  const entries = data ? Object.entries(data.presets) : [];
  const results = entries.map(([, result]) => result);
  const stars = results.map(({ stars: value }) => value);
  const allStarsEqual = stars.length < 2 || stars.every((value) => value === stars[0]);
  const maxStars = Math.max(-Infinity, ...stars);
  const bestColumns = allStarsEqual ? [] : stars.flatMap((value, index) => value === maxStars ? [index] : []);
  const levelTitle = LEVELS.find(({ levelId: id }) => id === levelId)?.title ?? levelId;

  return <main className="compare-page" aria-label="Preset comparison">
    <header className="compare-heading"><h1 id="compare-heading">Agents don’t need a chatbot. They need a mandate.</h1>
      <p><strong>{levelTitle}</strong> · Mandate = buyer’s promise · Quote = Valio Aimo’s promise · Log = proof both kept them</p>
    </header>
    {!data && !error && <div className="compare-state"><AgentWorking activity="explaining" message="Comparing mandates…" /></div>}
    {error && <div className="compare-error" role="alert">{error}</div>}
    {data && <div className="compare-frame"><table aria-labelledby="compare-heading">
      <thead><tr><th scope="col">Metric</th>{entries.map(([key, result], index) => {
        const incident = result.incident !== null;
        const best = bestColumns.includes(index);
        return <th key={key} scope="col" data-best={best ? 'true' : undefined} data-incident={incident ? 'true' : undefined}>
          {best && <span className="compare-tag compare-best">Best balance</span>}{incident && <span className="compare-tag compare-incident">Incident</span>}
          {formatPresetLabel(key)}
        </th>;
      })}</tr></thead>
      <tbody>{ROWS.map(({ label, field, better }) => {
        const winners = rowWinners(results, field, better);
        return <tr key={field}><th scope="row">{label}</th>{results.map((result, index) => {
          const value = shownValue(result, field);
          const incident = field === 'incident' && result.incident !== null;
          return <td key={entries[index]![0]} data-best={winners.includes(index) ? 'true' : undefined} data-incident={incident ? 'true' : undefined}>
            {winners.includes(index) && <span aria-hidden="true" className="compare-check">✓ </span>}
            {field === 'heartsLeft' && <span className="compare-heart-value">{result.heartsLeft}{Array.from({ length: Math.max(0, result.heartsLeft) }, (_, heart) => <PixelSprite key={heart} name="heart_full" />)}</span>}
            {field === 'stars' && <span className="compare-star-value" data-zero={result.stars === 0 ? 'true' : undefined}><Stars stars={result.stars} animate={false} /></span>}
            {incident && <PixelSprite name="stop" />}
            {field !== 'heartsLeft' && field !== 'stars' && <span className={value === 'Not reported' || value === 'Nothing ordered' || value === 'None' ? 'compare-muted' : undefined}>{value}</span>}
          </td>;
        })}</tr>;
      })}</tbody>
    </table></div>}
    <footer><button className="button button-ghost" type="button" onClick={onBack}>Back to levels</button></footer>
  </main>;
}

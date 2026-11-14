import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { GatewayClient } from '../api/gateway';
import type { Compare as CompareData } from '../api/schemas';
import { GatewayError } from '../api/gateway';
import { ReplayGatewayClient } from '../api/replay';
import { LEVEL_MOCKS } from '../game/levels';
import { formatMoney, formatPresetLabel } from '../lib/format';
import Compare from './Compare';

function clientWith(compare: Awaited<ReturnType<GatewayClient['compare']>>): GatewayClient {
  return { compare: vi.fn(async () => compare) } as unknown as GatewayClient;
}

describe('Compare', () => {
  it('shows live compare stars immediately for the backend fixture values', async () => {
    const fixture = JSON.parse(readFileSync('../tests/fixtures/live/level1-balanced.json', 'utf8')) as { compare: CompareData };
    const client = clientWith(fixture.compare);
    render(<Compare client={client} levelId="level1" onBack={() => {}} />);

    const table = await screen.findByRole('table');
    const starsRow = within(table).getByRole('row', { name: /^Stars/ });
    const cells = within(starsRow).getAllByRole('cell');
    expect(Object.values(fixture.compare.presets).map(({ stars }) => stars)).toEqual([1, 3, 1]);
    for (const cell of cells) {
      expect(within(cell).getByRole('img')).toBeVisible();
      expect(cell.querySelector('.result-stars > span')).not.toHaveStyle({ opacity: '0' });
    }
  });

  it('highlights cost only among presets tied for best kitchen completion', async () => {
    const fixture = JSON.parse(readFileSync('../tests/fixtures/live/level1-balanced.json', 'utf8')) as { compare: CompareData };
    render(<Compare client={clientWith(fixture.compare)} levelId="level1" onBack={() => {}} />);

    const table = await screen.findByRole('table');
    const costCells = within(within(table).getByRole('row', { name: /^Cost/ })).getAllByRole('cell');
    expect(costCells.map((cell) => cell.dataset.best === 'true')).toEqual([false, true, false]);
  });

  it('loads compare on a fresh replay client without starting a level', async () => {
    const client = new ReplayGatewayClient();
    render(<Compare client={client} levelId="level1" onBack={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Agent is working…Comparing mandates…');
    expect(await screen.findByRole('heading', { name: 'Agents don’t need a chatbot. They need a mandate.' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((item) => item.textContent?.includes('Balanced') ? 'Balanced' : item.textContent)).toEqual(['Metric', 'Strict', 'Balanced', 'Loose']);
  });

  it.each(LEVEL_MOCKS)('renders every gateway cell in response order for $start.level.levelId', async (mock) => {
    const compare = mock.compare as unknown as CompareData;
    const client = clientWith(compare);
    render(<Compare client={client} levelId={mock.start.level.levelId} onBack={() => {}} />);
    const table = await screen.findByRole('table');
    const keys = Object.keys(compare.presets);
    expect(within(table).getAllByRole('columnheader').slice(1).map((h, index) => ({ label: keys[index] && formatPresetLabel(keys[index]), includes: h.textContent?.includes(formatPresetLabel(keys[index]!)) }))).toEqual(keys.map((key) => ({ label: formatPresetLabel(key), includes: true })));
    for (const [rowName, field] of [
      ['Approvals asked', 'approvalsAsked'], ['Hearts used', 'heartsUsed'], ['Hearts left', 'heartsLeft'],
      ['Cost', 'totalCost'], ['Kitchen', 'kitchen'], ['Wallet', 'wallet'], ['Safety', 'safety'],
      ['Stars', 'stars'], ['Incident', 'incident'],
    ] as const) {
      const row = within(table).getByRole('row', { name: new RegExp(`^${rowName}`) });
      const cells = within(row).getAllByRole('cell');
      keys.forEach((key, index) => {
        const result = compare.presets[key]!;
        let expected: string;
        if (field === 'approvalsAsked') expected = String(result.approvalsAsked ?? 'Not reported');
        else if (field === 'heartsUsed') expected = String(result.heartsUsed ?? 'Not reported');
        else if (field === 'heartsLeft') expected = String(result.heartsLeft);
        else if (field === 'totalCost') expected = result.totalCost === undefined ? 'Not reported' : result.totalCost === null ? 'Nothing ordered' : formatMoney(result.totalCost);
        else if (field === 'kitchen') expected = `${result.kitchen} %`;
        else if (field === 'incident') expected = result.incident === null ? 'None' : `Safety incident: ${result.incident.reason}`;
        else if (field === 'stars') expected = `${result.stars} of 3 stars`;
        else expected = String(result[field]);
        if (field === 'stars') {
          expect(within(cells[index]!).getByRole('img', { name: expected })).toBeInTheDocument();
          if (result.stars === 0) expect(cells[index]!.querySelector('[data-zero=\"true\"]')).toBeInTheDocument();
        }
        else expect(cells[index]?.textContent?.replace(/\s+/g, ' ').trim()).toContain(String(expected).replace(/\s+/g, ' ').trim());
      });
    }
    const stars = Object.values(compare.presets).map((result) => result.stars);
    const max = Math.max(...stars);
    const best = stars.filter((value) => value === max).length < stars.length;
    expect(within(table).getAllByRole('columnheader').slice(1).filter((h) => h.dataset.best === 'true').length).toBe(best ? stars.filter((v) => v === max).length : 0);
  });

  it('shows gateway errors without a table and keeps Back working', async () => {
    const onBack = vi.fn();
    const client = { compare: vi.fn(async () => { throw new GatewayError('FAIL', 'Gateway unavailable'); }) } as unknown as GatewayClient;
    render(<Compare client={client} levelId="level1" onBack={onBack} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Gateway unavailable');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

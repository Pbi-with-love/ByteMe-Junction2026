import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import level1 from '../../mocks/level1.json';
import { ReplayGatewayClient } from '../api/replay';
import type { GameResult, LogResponse, LogVerify } from '../api/schemas';
import ResultPanel, { Stars } from './ResultPanel';

function stub(result: GameResult, logs: LogResponse = { events: [] }, verify: LogVerify = { valid: true, events: 0, headHash: result.logHeadHash }) {
  return { getResult: vi.fn().mockResolvedValue(result), getLog: vi.fn().mockResolvedValue(logs), verifyLog: vi.fn().mockResolvedValue(verify) };
}

describe('ResultPanel', () => {
  it('loads result, log, and verification; shows gateway values and actions', async () => {
    const client = new ReplayGatewayClient();
    const start = await client.startLevel('level1', 'balanced');
    for (const step of level1.presets.balanced.steps) if (step.approval?.status === 'OPEN') await client.decideApproval(step.approval.approvalId, 'approved');
    const onLoaded = vi.fn();
    const onPlayAgain = vi.fn();
    render(<ResultPanel client={client} sessionId={start.sessionId} startHearts={start.hearts} onLoaded={onLoaded} onPlayAgain={onPlayAgain} />);
    expect(screen.getByText('Loading result…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Result' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Kitchen' })).toHaveAttribute('aria-valuenow', String(level1.presets.balanced.result.kitchen));
    expect(screen.getByLabelText(`${level1.presets.balanced.result.stars} of 3 stars`)).toBeInTheDocument();
    expect(document.querySelector('.result-receipt-copy')?.textContent).toBe(level1.presets.balanced.result.receiptText);
    expect(onLoaded).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('uses returned stars even when scores disagree and shows badge mismatch', async () => {
    const result = { ...level1.presets.balanced.result, kitchen: 0, safety: 0, stars: 3 } as GameResult;
    const client = stub(result, { events: [] }, { valid: true, events: 0, headHash: 'different' });
    render(<ResultPanel client={client as never} sessionId="s" startHearts={3} onPlayAgain={() => {}} />);
    expect(await screen.findByLabelText('3 of 3 stars')).toBeInTheDocument();
    expect(screen.queryByText('Safety incident')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Log does not match this result');
  });

  it('renders the verification hash in a consistent monospace face', async () => {
    const result = level1.presets.balanced.result as GameResult;
    const client = stub(result);
    render(<ResultPanel client={client as never} sessionId="s" startHearts={3} onPlayAgain={() => {}} />);
    const hash = await screen.findByTestId('result-hash-value');
    expect(hash.tagName).toBe('CODE');
    expect(hash).toHaveTextContent(level1.presets.balanced.verify.headHash);
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toMatch(/\.result-hash-code\s*\{[^}]*font-family:\s*ui-monospace[^}]*monospace/s);
  });

  it('shows incident reason and product, with incident panel variant', async () => {
    const result = { ...level1.presets.balanced.result, incident: { type: 'SAFETY', productId: 'x1', reason: 'Contains peanut' } } as GameResult;
    const client = stub(result);
    render(<ResultPanel client={client as never} sessionId="s" startHearts={3} onPlayAgain={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Safety incident' })).toBeInTheDocument();
    expect(screen.getByText('Contains peanut')).toBeInTheDocument();
    expect(screen.getByText('x1')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveClass('pixel-panel-incident');
  });

  it('keeps scores when log retrieval fails and reports result failure without fake meters', async () => {
    const result = level1.presets.balanced.result as GameResult;
    const client = stub(result);
    client.getLog.mockRejectedValue(new Error('log unavailable'));
    const { rerender } = render(<ResultPanel client={client as never} sessionId="s" startHearts={3} onPlayAgain={() => {}} />);
    await screen.findByRole('meter', { name: 'Kitchen' });
    expect(screen.getByRole('alert')).toHaveTextContent('log unavailable');
    const failed = { ...client, getResult: vi.fn().mockRejectedValue(new Error('result unavailable')) };
    rerender(<ResultPanel client={failed as never} sessionId="s2" startHearts={3} onPlayAgain={() => {}} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('result unavailable'));
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });

  it('renders the three accessible pixel stars from returned values', () => {
    render(<Stars stars={2} />);
    expect(screen.getByLabelText('2 of 3 stars')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-star="on"]')).toHaveLength(2);
  });
});

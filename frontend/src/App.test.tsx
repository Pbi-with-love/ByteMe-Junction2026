import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { LEVELS, LEVEL_MOCKS } from './game/levels';
import discoveryData from '../mocks/discovery.json';
import type { GatewayClient } from './api/gateway';
import type { Discovery } from './api/schemas';
import { ReplayGatewayClient } from './api/replay';
import { createPixiWorld } from './world/pixiWorld';
import { fakeWorld } from './world/fakeWorld';
import { HttpGatewayClient } from './api/http';

function makeClient(discovery: () => Promise<Discovery>): GatewayClient {
  return {
    discovery,
    startLevel: async () => { throw new Error('unused'); },
    nextStep: async () => null,
    getResult: async () => { throw new Error('unused'); },
    getLog: async () => ({ events: [] }),
    verifyLog: async () => { throw new Error('unused'); },
    compare: async () => { throw new Error('unused'); },
    presets: async () => ({}),
    signMandate: async () => { throw new Error('unused'); },
    decideApproval: async () => { throw new Error('unused'); },
    getApproval: async () => { throw new Error('unused'); },
  };
}

describe('level shell', () => {
  it('keeps static headings aligned with mock levels and loads the provider', async () => {
    LEVELS.forEach((level, index) => {
      expect(level.levelId).toBe(LEVEL_MOCKS[index].start.level.levelId);
    });
    expect(LEVELS[2].title).toBe('Allergy Emergency');
    render(<App client={makeClient(async () => ({ provider: 'Mock Gateway' } as Discovery))} />);
    await screen.findByText('Mock Gateway');
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByText('DEMO')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows start errors without the brief and returns to levels on Back to levels', async () => {
    const client = makeClient(async () => ({ provider: 'Mock Gateway' } as Discovery));
    client.presets = async () => { throw new Error('presets offline'); };
    render(<App client={client} />);
    fireEvent.click(await screen.findAllByRole('button', { name: 'Start level' }).then((buttons) => buttons[0]));
    expect(await screen.findByRole('alert')).toHaveTextContent('presets offline');
    expect(screen.queryByRole('article')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('returns from the briefing to the level list', async () => {
    render(<App client={new ReplayGatewayClient()} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Start level' }))[0]!);
    expect(await screen.findByRole('heading', { name: 'The situation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));
    expect(await screen.findByRole('heading', { name: 'Agent Kitchen' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Start level' })).toHaveLength(3);
  });

  it('shows level-specific loading copy while startLevel is pending', async () => {
    const client = makeClient(async () => discoveryData.response as Discovery);
    client.presets = async () => ({ balanced: Object.values(LEVEL_MOCKS[0].presets)[0]!.mandate });
    let finish!: (value: Awaited<ReturnType<GatewayClient['startLevel']>>) => void;
    const pendingStart = new Promise<Awaited<ReturnType<GatewayClient['startLevel']>>>((resolve) => { finish = resolve; });
    client.startLevel = vi.fn(() => pendingStart);
    render(<App client={client} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Start level' }))[0]);
    expect(await screen.findByRole('status')).toHaveTextContent('Starting the level…');
    finish(LEVEL_MOCKS[0].start);
    fireEvent.click(await screen.findByRole('button', { name: 'Go to the kitchen' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Kitchen' })).toBeInTheDocument());
  });

  it('shows discovery errors without cards', async () => {
    render(<App client={makeClient(async () => { throw new Error('offline'); })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('shows the actionable gateway URL message when the live backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    render(<App client={new HttpGatewayClient('http://localhost:8000')} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot reach the gateway at http://localhost:8000. Start the backend or set VITE_GATEWAY_MODE=replay.',
    );
    vi.unstubAllGlobals();
  });

  it('shows a briefing after a level pick and continues into the kitchen', async () => {
    const client = makeClient(async () => discoveryData.response as Discovery);
    client.presets = vi.fn(async () => ({ balanced: Object.values(LEVEL_MOCKS[0].presets)[1].mandate }));
    client.startLevel = async () => ({ sessionId: 'session-1', level: LEVEL_MOCKS[0].start.level, clock: LEVEL_MOCKS[0].start.clock, hearts: 3, tokens: LEVEL_MOCKS[0].start.tokens });
    render(<App client={client} />);
    expect(await screen.findByRole('heading', { name: 'Agent Kitchen' })).toBeTruthy();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Start level' }))[0]);
    expect(await screen.findByRole('heading', { name: 'The situation' })).toBeInTheDocument();
    expect(client.presets).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Go to the kitchen' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Kitchen' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Manager Desk' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Write the mandate' }));
    const clipboard = await screen.findByRole('dialog', { name: 'Valtakirja' });
    expect(within(clipboard).getAllByRole('heading', { name: 'Valtakirja' })).toHaveLength(1);
    expect(clipboard.querySelector('.mandate-doc')).toBeNull();
  });

  it('starts a fresh same-level session from the result Play again action',async()=>{
    const client=makeClient(async()=>discoveryData.response as Discovery);
    const preset=Object.values(LEVEL_MOCKS[0]!.presets)[1]!.mandate;
    client.presets=vi.fn(async()=>({balanced:preset}));
    client.signMandate=vi.fn(async()=>preset);
    client.startLevel=vi.fn()
      .mockResolvedValueOnce({...LEVEL_MOCKS[0]!.start,sessionId:'session-first'})
      .mockResolvedValueOnce({...LEVEL_MOCKS[0]!.start,sessionId:'session-restarted'});
    render(<App client={client}/>);
    fireEvent.click((await screen.findAllByRole('button',{name:'Start level'}))[0]!);
    await waitFor(()=>expect(client.startLevel).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to the kitchen' }));
    fireEvent.click(await screen.findByRole('button',{name:'Manager Desk'}));
    fireEvent.click(await screen.findByRole('button',{name:'Write the mandate'}));
    fireEvent.click(await screen.findByRole('button',{name:'Balanced'}));
    fireEvent.click(await screen.findByRole('button',{name:'Sign mandate'}));
    fireEvent.keyDown(document,{key:'Escape'});
    fireEvent.click(await screen.findByRole('button',{name:'Order Terminal'}));
    fireEvent.click(await screen.findByRole('button',{name:'Send to agent'}));
    fireEvent.click(await screen.findByRole('button',{name:'See result'}));
    fireEvent.click(await screen.findByRole('button',{name:'Play again'}));
    await waitFor(()=>expect(client.startLevel).toHaveBeenCalledTimes(2));
    expect(client.startLevel).toHaveBeenLastCalledWith('level1','balanced');
    expect(await screen.findByRole('region', { name: 'Kitchen' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'The situation' })).not.toBeInTheDocument();
  });

  async function openFirstResult(client: ReplayGatewayClient) {
    vi.mocked(createPixiWorld).mockImplementation(async (host) => {
      host.appendChild(document.createElement('canvas'));
      return fakeWorld;
    });
    const presets = await client.presets('level1');
    const start = await client.startLevel('level1', Object.keys(presets)[0]!);
    const replay = vi.spyOn(client, 'startLevel').mockResolvedValue(start);
    const fastClient = client;
    render(<App client={fastClient} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Start level' }))[0]!);
    await waitFor(() => expect(replay).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'Go to the kitchen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Manager Desk' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Write the mandate' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Loose' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign mandate' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(await screen.findByRole('button', { name: 'Order Terminal' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send to agent' }));
    await screen.findByRole('dialog', { name: 'The agent is done.' }, { timeout: 15000 });
    fireEvent.click(screen.getByRole('button', { name: 'See result' }));
    await screen.findByText('Receipt');
  }

  it('opens Valio view and restores the same result without refetching', async () => {
    const client = new ReplayGatewayClient();
    const getResult = vi.spyOn(client, 'getResult');
    await openFirstResult(client);
    const resultPanel = screen.getByText('Receipt').closest('[role="dialog"]');
    fireEvent.click(await screen.findByRole('button', { name: 'See it from Valio Aimo’s side' }));
    expect(await screen.findByRole('heading', { name: 'Valio Aimo view' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kitchen', hidden: true }).parentElement).toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
    expect(await screen.findByText('Receipt')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kitchen' }).parentElement).not.toHaveAttribute('hidden');
    expect(screen.getByText('Receipt').closest('[role="dialog"]')).toBe(resultPanel);
    expect(getResult).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('canvas')).toHaveLength(1);
  }, 30000);

  it('opens comparison through the result action and returns to levels', async () => {
    const client = new ReplayGatewayClient();
    await openFirstResult(client);
    fireEvent.click(await screen.findByRole('button', { name: 'Compare presets' }));
    expect(await screen.findByRole('heading', { name: 'Agents don’t need a chatbot. They need a mandate.' })).toBeInTheDocument();
    expect(document.querySelectorAll('canvas')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));
    expect(await screen.findByRole('heading', { name: 'Agent Kitchen' })).toBeInTheDocument();
  }, 30000);
});

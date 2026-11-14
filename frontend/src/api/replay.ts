import discoveryData from '../../mocks/discovery.json';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { GatewayError, type GatewayClient, type MandateDraft } from './gateway';
import { controlsOf, sameControls } from './mandate';
import { DiscoverySchema, LevelMockSchema, type AgentStep, type LevelMock, type LogResponse, type LogVerify } from './schemas';

const levels: LevelMock[] = [level1, level2, level3].map((mock) => LevelMockSchema.parse(mock));
const discovery = DiscoverySchema.parse(discoveryData.response);
type Session = { recording: LevelMock['presets'][string]; cursor: number; tampered?: { log: LogResponse['events']; verify: LogVerify } };

export class ReplayGatewayClient implements GatewayClient {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly options: { tamperLog?: boolean } = {}) {}

  async discovery() {
    return discovery;
  }

  async startLevel(levelId: string, preset: string) {
    const level = levels.find((item) => item.start.level.levelId === levelId);
    if (!level) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const recording = level.presets[preset];
    if (!recording) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const tampered = this.options.tamperLog && level.tamperedDemo?.preset === preset
      ? { log: level.tamperedDemo.log, verify: level.tamperedDemo.verify }
      : undefined;
    this.sessions.set(level.start.sessionId, { recording, cursor: 0, tampered });
    return level.start;
  }

  async presets(levelId: string) {
    const level = levels.find((item) => item.start.level.levelId === levelId);
    if (!level) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return Object.fromEntries(Object.entries(level.presets).map(([key, value]) => [key, value.mandate]));
  }

  async signMandate(sessionId: string, draft: MandateDraft) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const level = levels.find((item) => item.start.sessionId === sessionId)!;
    const match = Object.values(level.presets).find(({ mandate }) => sameControls(controlsOf(mandate), controlsOf(draft)));
    if (!match) throw new GatewayError('NO_RECORDING', 'Replay has no recorded mandate for these values. Pick a preset, or use a live gateway.', 404);
    this.sessions.set(sessionId, { recording: match, cursor: 0 });
    return match.mandate;
  }

  async nextStep(sessionId: string): Promise<AgentStep | null> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return session.recording.steps[session.cursor++] ?? null;
  }

  async getResult(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return session.recording.result;
  }

  async getLog(view: 'buyer' | 'valio', opts: { since?: number; limit?: number } = {}): Promise<LogResponse> {
    if (view !== 'buyer') throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const session = this.latestSession();
    if (!session || !session.recording.log && !session.tampered) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const events = session.tampered?.log ?? session.recording.log!;
    const filtered = events.filter(({ seq }) => opts.since === undefined || seq > opts.since);
    return { events: opts.limit === undefined ? filtered : filtered.slice(0, opts.limit) };
  }

  async verifyLog(): Promise<LogVerify> {
    const session = this.latestSession();
    const verify = session?.tampered?.verify ?? session?.recording.verify;
    if (!verify) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return verify;
  }

  private latestSession(): Session | undefined {
    return [...this.sessions.values()].at(-1);
  }

  async compare(levelId: string) {
    const level = levels.find((item) => item.start.level.levelId === levelId);
    if (!level) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return level.compare;
  }
}

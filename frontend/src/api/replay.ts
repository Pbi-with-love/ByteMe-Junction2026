import discoveryData from '../../mocks/discovery.json';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { GatewayError, type GatewayClient, type MandateDraft } from './gateway';
import { controlsOf, sameControls } from './mandate';
import { ApprovalDecisionSchema, ApprovalSchema, DiscoverySchema, LevelMockSchema, type AgentStep, type Approval, type ApprovalDecision, type LevelMock, type LogResponse, type LogVerify } from './schemas';

const levels: LevelMock[] = [level1, level2, level3].map((mock) => LevelMockSchema.parse(mock));
const discovery = DiscoverySchema.parse(discoveryData.response);
export function decisionKey(decisions: string[]): string { return decisions.join(','); }
type Session = { recording: LevelMock['presets'][string]; cursor: number; decisions: string[]; settled: Map<string, ApprovalDecision>; used: Set<string>; tampered?: { log: LogResponse['events']; verify: LogVerify }; dataBoundaryValioLog?: LogResponse['events'] };

export class ReplayGatewayClient implements GatewayClient {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly options: { tamperLog?: boolean; levels?: unknown[]; dataBoundaryDemo?: boolean } = {}) {}

  private mockLevels(): LevelMock[] { return this.options.levels ? this.options.levels.map((item) => LevelMockSchema.parse(item)) : levels; }

  async discovery() {
    return discovery;
  }

  async startLevel(levelId: string, preset: string) {
    const level = this.mockLevels().find((item) => item.start.level.levelId === levelId);
    if (!level) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const recording = level.presets[preset];
    if (!recording) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const tampered = this.options.tamperLog && level.tamperedDemo?.preset === preset
      ? { log: level.tamperedDemo.log, verify: level.tamperedDemo.verify }
      : undefined;
    this.sessions.set(level.start.sessionId, { recording, cursor: 0, decisions: [], settled: new Map(), used: new Set(), tampered, dataBoundaryValioLog: this.options.dataBoundaryDemo && level.dataBoundaryDemo?.preset === preset ? level.dataBoundaryDemo.valioLog : undefined });
    return level.start;
  }

  async presets(levelId: string) {
    const level = this.mockLevels().find((item) => item.start.level.levelId === levelId);
    if (!level) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return Object.fromEntries(Object.entries(level.presets).map(([key, value]) => [key, value.mandate]));
  }

  async signMandate(sessionId: string, draft: MandateDraft) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const level = this.mockLevels().find((item) => item.start.sessionId === sessionId)!;
    const match = Object.values(level.presets).find(({ mandate }) => sameControls(controlsOf(mandate), controlsOf(draft)));
    if (!match) throw new GatewayError('NO_RECORDING', 'Replay has no recorded mandate for these values. Pick a preset, or use a live gateway.', 404);
    this.sessions.set(sessionId, { recording: match, cursor: 0, decisions: [], settled: new Map(), used: new Set() });
    return match.mandate;
  }

  async nextStep(sessionId: string): Promise<AgentStep | null> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const prior = session.recording.steps[session.cursor - 1]?.approval;
    if (prior?.status === 'OPEN' && !session.used.has(prior.approvalId)) { session.decisions.push('expired'); session.used.add(prior.approvalId); }
    const step = session.recording.steps[session.cursor++] ?? null;
    return step;
  }

  async getResult(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return this.recordFor(sessionId).result;
  }

  private recordFor(sessionId: string): LevelMock['presets'][string] & { result: LevelMock['presets'][string]['result']; log?: LogResponse['events']; verify?: LogVerify } {
    const session = this.sessions.get(sessionId);
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    if (!session.recording.outcomes) return session.recording;
    const key = decisionKey(session.decisions);
    const outcome = session.recording.outcomes[key] as (typeof session.recording.outcomes)[string] & { log?: LogResponse['events']; verify?: LogVerify };
    if (!outcome) throw new GatewayError('NO_RECORDING', `Replay has no recording for these decisions (${key}). Follow the recorded path, or use a live gateway.`, 404);
    return { ...session.recording, ...outcome };
  }

  async decideApproval(approvalId: string, decision: 'approved' | 'rejected' | 'alternative', planId?: string): Promise<ApprovalDecision> {
    const session = this.latestSession();
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    if (session.used.has(approvalId)) {
      const conflict = session.recording.decisions?.[approvalId]?.conflict;
      this.throwRecord(conflict);
    }
    const record = session.recording.decisions?.[approvalId];
    const item = decision === 'alternative' ? (planId ? record?.alternative[planId] : undefined) : record?.[decision];
    if (!item) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    if (item.httpStatus < 200 || item.httpStatus >= 300) this.throwRecord(item);
    const parsed = ApprovalDecisionSchema.safeParse(item.body);
    if (!parsed.success) throw new GatewayError('INVALID_RESPONSE', 'Invalid response', item.httpStatus);
    session.used.add(approvalId);
    session.settled.set(approvalId, parsed.data);
    session.decisions.push(decision === 'alternative' ? `alternative:${planId}` : decision);
    return parsed.data;
  }

  async getApproval(approvalId: string): Promise<Approval> {
    const session = this.latestSession();
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const settled = session.settled.get(approvalId);
    if (settled) return ApprovalSchema.parse(settled);
    const expired = session.recording.decisions?.[approvalId]?.expired;
    if (expired && expired.httpStatus >= 200 && expired.httpStatus < 300) return ApprovalSchema.parse(expired.body);
    this.throwRecord(expired);
  }

  private throwRecord(record: { httpStatus: number; body: unknown } | undefined): never {
    if (!record) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const parsed = record.body as { error?: { code?: string; message?: string; requestId?: string; details?: unknown } };
    throw new GatewayError(parsed.error?.code ?? 'HTTP_ERROR', parsed.error?.message ?? 'HTTP error', record.httpStatus, parsed.error?.requestId, parsed.error?.details);
  }

  async getLog(view: 'buyer' | 'valio', opts: { since?: number; limit?: number } = {}): Promise<LogResponse> {
    const session = this.latestSession();
    if (!session) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const events = view === 'valio' && session.dataBoundaryValioLog
      ? session.dataBoundaryValioLog
      : view === 'valio'
        ? this.recordFor(this.latestSessionId()!).valioLog
        : session.tampered?.log ?? this.recordFor(this.latestSessionId()!).log;
    if (!events) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const filtered = events.filter(({ seq }) => opts.since === undefined || seq > opts.since);
    return { events: opts.limit === undefined ? filtered : filtered.slice(0, opts.limit) };
  }

  async verifyLog(): Promise<LogVerify> {
    const session = this.latestSession();
    const verify = session?.tampered?.verify ?? (session ? this.recordFor(this.latestSessionId()!).verify : undefined);
    if (!verify) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return verify;
  }

  private latestSession(): Session | undefined {
    return [...this.sessions.values()].at(-1);
  }

  private latestSessionId(): string | undefined { return [...this.sessions.keys()].at(-1); }

  async compare(levelId: string) {
    const level = this.mockLevels().find((item) => item.start.level.levelId === levelId);
    if (!level) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return level.compare;
  }
}

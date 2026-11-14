import { AgentStepSchema, CompareSchema, DiscoverySchema, ErrorEnvelopeSchema, GameResultSchema, GameStartSchema, LogResponseSchema, LogVerifySchema, MandateSchema, TokenResponseSchema } from './schemas';
import { ApprovalDecisionSchema, ApprovalSchema } from './schemas';
import { GatewayError, type GatewayClient } from './gateway';
import type { AgentStep, Compare, Discovery, GameResult, GameStart, Mandate } from './schemas';
import type { MandateDraft } from './gateway';
import type { AgentActivity } from '../components/AgentWorking';
import { z, type ZodType } from 'zod';

const ApprovalDecisionResponseSchema = z.object({ approval: ApprovalSchema, order: z.object({ status: z.string() }).passthrough() });
const SessionSchema = z.object({ status: z.enum(['CREATED', 'RUNNING', 'FINISHED', 'FAILED']), steps: z.array(AgentStepSchema), error: z.string().optional(), activity: z.enum(['idle', 'searching', 'quoting', 'ordering', 'explaining']).optional() });

export class HttpGatewayClient implements GatewayClient {
  private token: string | undefined;
  private operatorToken: string | undefined;
  private readonly runStarted = new Set<string>();
  private readonly cursors = new Map<string, number>();
  private readonly activities = new Map<string, AgentActivity>();

  constructor(private readonly baseUrl: string, private readonly upstreamMode = 'replay', private readonly pollIntervalMs = 500) {}

  private async request<T>(path: string, schema: ZodType<T>, init: RequestInit = {}, includeHumanToken = true): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...(includeHumanToken && this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new GatewayError('NETWORK_ERROR', `Cannot reach the gateway at ${this.baseUrl}. Start the backend or set VITE_GATEWAY_MODE=replay.`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      const envelope = ErrorEnvelopeSchema.safeParse(body);
      if (!envelope.success) throw new GatewayError('HTTP_ERROR', 'HTTP error', response.status);
      const error = envelope.data.error;
      throw new GatewayError(error.code, error.message, response.status, error.requestId, error.details);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new GatewayError('INVALID_RESPONSE', 'Invalid response', response.status);
    return parsed.data;
  }

  discovery(): Promise<Discovery> {
    return this.request('/.well-known/agent-commerce.json', DiscoverySchema);
  }

  async startLevel(levelId: string, preset: string): Promise<GameStart> {
    const start = await this.request(`/v1/game/levels/${encodeURIComponent(levelId)}/start`, GameStartSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, mode: this.upstreamMode }),
    });
    this.token = start.tokens.human;
    this.runStarted.delete(start.sessionId);
    this.cursors.set(start.sessionId, 0);
    this.activities.set(start.sessionId, 'idle');
    return start;
  }

  async presets(levelId: string): Promise<Record<string, Mandate>> {
    return this.request(`/v1/game/levels/${encodeURIComponent(levelId)}/presets`, z.record(z.string(), MandateSchema), {}, false);
  }

  signMandate(_sessionId: string, draft: MandateDraft): Promise<Mandate> {
    return this.request('/v1/mandates', MandateSchema, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
  }

  decideApproval(approvalId: string, decision: 'approved' | 'rejected' | 'alternative', planId?: string) {
    if (decision === 'alternative' && !planId) return Promise.reject(new GatewayError('VALIDATION_ERROR', 'planId is required for an alternative decision', 400));
    const body = decision === 'alternative' ? { decision, planId } : { decision };
    return this.request(`/v1/approvals/${encodeURIComponent(approvalId)}`, ApprovalDecisionResponseSchema, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((wrapped) => {
      const response = wrapped;
      const selectedDecision = response.approval.decision ?? (decision === 'alternative' ? `alternative:${planId}` : decision);
      return ApprovalDecisionSchema.parse({ ...response.approval, decision: selectedDecision, orderStatus: response.order.status });
    });
  }

  getApproval(approvalId: string) {
    return this.request(`/v1/approvals/${encodeURIComponent(approvalId)}`, ApprovalSchema);
  }

  activity(sessionId: string): AgentActivity { return this.activities.get(sessionId) ?? 'idle'; }

  async nextStep(sessionId: string): Promise<AgentStep | null> {
    const sessionPath = `/v1/game/sessions/${encodeURIComponent(sessionId)}`;
    if (!this.runStarted.has(sessionId)) {
      try {
        await this.request(`/v1/game/sessions/${encodeURIComponent(sessionId)}/run`, z.unknown(), { method: 'POST' });
      } catch (error) {
        if (!(error instanceof GatewayError) || error.httpStatus !== 409 || error.code !== 'INVALID_STATE') throw error;
        const current = await this.request(sessionPath, SessionSchema);
        if (current.status !== 'RUNNING' && current.status !== 'FINISHED') throw error;
      }
      this.runStarted.add(sessionId);
    }

    while (true) {
      const session = await this.request(sessionPath, SessionSchema);
      this.activities.set(sessionId, session.activity ?? (session.status === 'RUNNING' ? 'searching' : 'idle'));
      if (session.status === 'FAILED') throw new GatewayError('AGENT_FAILED', session.error ?? 'Agent failed');
      const cursor = this.cursors.get(sessionId) ?? 0;
      const step = session.steps[cursor];
      if (step) {
        this.cursors.set(sessionId, cursor + 1);
        return step;
      }
      if (session.status === 'FINISHED') { this.activities.set(sessionId, 'idle'); return null; }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  getResult(sessionId: string): Promise<GameResult> {
    return this.request(`/v1/game/sessions/${encodeURIComponent(sessionId)}/result`, GameResultSchema);
  }

  getLog(view: 'buyer' | 'valio', opts: { since?: number; limit?: number } = {}) {
    if (view === 'valio') return this.getValioLog(opts);
    const query = new URLSearchParams({ view });
    if (opts.since !== undefined) query.set('since', String(opts.since));
    if (opts.limit !== undefined) query.set('limit', String(opts.limit));
    return this.request(`/v1/log?${query.toString()}`, LogResponseSchema);
  }

  private async getValioLog(opts: { since?: number; limit?: number } = {}) {
    if (!this.operatorToken) {
      const result = await this.request('/v1/auth/tokens', TokenResponseSchema, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'operator' }),
      });
      this.operatorToken = result.token;
    }
    const query = new URLSearchParams({ view: 'valio' });
    if (opts.since !== undefined) query.set('since', String(opts.since));
    if (opts.limit !== undefined) query.set('limit', String(opts.limit));
    return this.request(`/v1/log?${query.toString()}`, LogResponseSchema, { headers: { Authorization: `Bearer ${this.operatorToken}` } });
  }

  verifyLog() {
    return this.request('/v1/log/verify', LogVerifySchema);
  }

  compare(levelId: string): Promise<Compare> {
    return this.request(`/v1/game/levels/${encodeURIComponent(levelId)}/compare`, CompareSchema);
  }
}

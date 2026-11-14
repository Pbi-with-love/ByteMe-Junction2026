import { CompareSchema, DiscoverySchema, ErrorEnvelopeSchema, GameResultSchema, GameStartSchema, LogResponseSchema, LogVerifySchema, MandateSchema, TokenResponseSchema } from './schemas';
import { ApprovalDecisionSchema, ApprovalSchema } from './schemas';
import { GatewayError, type GatewayClient } from './gateway';
import type { AgentStep, Compare, Discovery, GameResult, GameStart, Mandate } from './schemas';
import type { MandateDraft } from './gateway';
import type { ZodType } from 'zod';

export class HttpGatewayClient implements GatewayClient {
  private token: string | undefined;
  private operatorToken: string | undefined;

  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, schema: ZodType<T>, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new GatewayError('NETWORK_ERROR');
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
      body: JSON.stringify({ preset, mode: 'live' }),
    });
    this.token = start.tokens.human;
    return start;
  }

  async presets(_levelId: string): Promise<Record<string, Mandate>> { throw new GatewayError('NOT_IMPLEMENTED'); }

  signMandate(_sessionId: string, draft: MandateDraft): Promise<Mandate> {
    return this.request('/v1/mandates', MandateSchema, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
  }

  decideApproval(approvalId: string, decision: 'approved' | 'rejected' | 'alternative', planId?: string) {
    if (decision === 'alternative' && !planId) return Promise.reject(new GatewayError('VALIDATION_ERROR', 'planId is required for an alternative decision', 400));
    const body = decision === 'alternative' ? { decision, planId } : { decision };
    return this.request(`/v1/approvals/${encodeURIComponent(approvalId)}`, ApprovalDecisionSchema, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  getApproval(approvalId: string) {
    return this.request(`/v1/approvals/${encodeURIComponent(approvalId)}`, ApprovalSchema);
  }

  async nextStep(_sessionId: string): Promise<AgentStep | null> {
    throw new GatewayError('NOT_IMPLEMENTED');
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

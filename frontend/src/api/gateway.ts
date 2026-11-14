import type { AgentStep, Compare, Discovery, GameResult, GameStart, Mandate } from './schemas';

export type MandateDraft = Omit<Mandate, 'mandateId' | 'customerId' | 'issuedAt' | 'status' | 'signature' | 'summaryText'>;
import { HttpGatewayClient } from './http';
import { ReplayGatewayClient } from './replay';

export interface GatewayClient {
  discovery(): Promise<Discovery>;
  startLevel(levelId: string, preset: string): Promise<GameStart>;
  nextStep(sessionId: string): Promise<AgentStep | null>;
  getResult(sessionId: string): Promise<GameResult>;
  getLog(view: 'buyer' | 'valio', opts?: { since?: number; limit?: number }): Promise<import('./schemas').LogResponse>;
  verifyLog(): Promise<import('./schemas').LogVerify>;
  compare(levelId: string): Promise<Compare>;
  presets(levelId: string): Promise<Record<string, Mandate>>;
  signMandate(sessionId: string, draft: MandateDraft): Promise<Mandate>;
}

export class GatewayError extends Error {
  constructor(
    public code: string,
    message = code,
    public httpStatus?: number,
    public requestId?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export function createGatewayClient(env: Record<string, string | undefined>): GatewayClient {
  const mode = env.VITE_GATEWAY_MODE;
  if (!mode || mode === 'replay') return new ReplayGatewayClient({ tamperLog: env.VITE_REPLAY_TAMPER === '1', dataBoundaryDemo: env.VITE_REPLAY_PROBE === '1' });
  if (mode === 'live') return new HttpGatewayClient(env.VITE_GATEWAY_URL ?? 'http://localhost:8000');
  throw new Error(`Unknown VITE_GATEWAY_MODE: ${mode}`);
}

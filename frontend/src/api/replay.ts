import discoveryData from '../../mocks/discovery.json';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { GatewayError, type GatewayClient } from './gateway';
import { DiscoverySchema, LevelMockSchema, type AgentStep, type LevelMock } from './schemas';

const levels: LevelMock[] = [level1, level2, level3].map((mock) => LevelMockSchema.parse(mock));
const discovery = DiscoverySchema.parse(discoveryData.response);
type Session = { recording: LevelMock['presets'][string]; cursor: number };

export class ReplayGatewayClient implements GatewayClient {
  private readonly sessions = new Map<string, Session>();

  async discovery() {
    return discovery;
  }

  async startLevel(levelId: string, preset: string) {
    const level = levels.find((item) => item.start.level.levelId === levelId);
    if (!level) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    const recording = level.presets[preset];
    if (!recording) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    this.sessions.set(level.start.sessionId, { recording, cursor: 0 });
    return level.start;
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

  async compare(levelId: string) {
    const level = levels.find((item) => item.start.level.levelId === levelId);
    if (!level) throw new GatewayError('NOT_FOUND', 'Not found', 404);
    return level.compare;
  }
}

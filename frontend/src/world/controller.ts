import type { StationId } from './map';
import type { RobotState } from './robot';
export type BurstKind = 'stamp' | 'delivered';
export interface WorldController {
  walkTo(station: StationId): Promise<void>;
  setRobotState(state: RobotState): void;
  carry(on: boolean): void;
  say(text: string | null): void;
  burst(kind: BurstKind): void;
}

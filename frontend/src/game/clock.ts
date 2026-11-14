import type { GameStart } from '../api/schemas';
import { formatTime } from '../lib/format';

type Clock = GameStart['clock'];
const minuteOfDay = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const bounds = (clock: Clock) => ({ start: minuteOfDay(clock.start), end: minuteOfDay(clock.end) });
export function gameOffsetMs(iso: string, clock: Clock): number {
  const { start, end } = bounds(clock);
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const offset = (Number(p.hour) * 60 + Number(p.minute) - start) * clock.realSecondsPerGameMinute * 1000;
  return Math.max(0, Math.min((end - start) * clock.realSecondsPerGameMinute * 1000, offset));
}
export function gameTimeAt(clock: Clock, elapsedMs: number): string {
  const { start, end } = bounds(clock);
  const max = (end - start) * clock.realSecondsPerGameMinute * 1000;
  const minutes = Math.floor(Math.min(max, Math.max(0, elapsedMs)) / (clock.realSecondsPerGameMinute * 1000));
  const value = Math.min(end, start + minutes);
  return formatTime(`2000-01-01T${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}:00+02:00`);
}

import type { Light } from '../api/schemas';
import PixelSprite from './PixelSprite';
const style: Record<Light, string> = { GREEN: 'light-green', BLUE: 'light-blue', YELLOW: 'light-yellow', RED: 'light-red' };
const icon: Record<Light, 'calm' | 'info' | 'puzzled' | 'stop'> = { GREEN: 'calm', BLUE: 'info', YELLOW: 'puzzled', RED: 'stop' };
const word: Record<Light, string> = { GREEN: 'Green', BLUE: 'Blue', YELLOW: 'Yellow', RED: 'Red' };
export default function LightBadge({ light, label }: { light: Light; label?: string }) {
  return <span data-light={light} className={`light-badge ${style[light]}`}><PixelSprite name={icon[light]} /><span>{label ?? word[light]}</span></span>;
}

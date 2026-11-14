import { expect,it } from 'vitest';
import { particlesAt } from './effects';
it('generates deterministic stamp and delivery bursts',()=>{expect(particlesAt('stamp',0)).toHaveLength(10);expect(particlesAt('stamp',299).every(p=>'sprite'in p&&p.sprite==='particle_stamp')).toBe(true);expect(particlesAt('stamp',300).every(p=>'size'in p&&p.size===2)).toBe(true);expect(particlesAt('stamp',600)).toEqual([]);expect(particlesAt('delivered',0)).toHaveLength(12);expect(particlesAt('delivered',125)[0]).toMatchObject({sprite:'sparkle_1'});expect(particlesAt('delivered',750)).toEqual([]);});

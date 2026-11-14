import type { Mandate } from './schemas';
import type { MandateDraft } from './gateway';

export type Controls = { perOrderEur: number; substitution: string; lateDelivery: string; excludeAllergens: string[] };
export const LIMIT_OPTIONS_EUR: readonly number[] = [200, 500, 2000];
export function controlsOf(m: Mandate): Controls { return { perOrderEur: m.limits.perOrderEur, substitution: m.substitution, lateDelivery: m.lateDelivery, excludeAllergens: [...m.hardConstraints.excludeAllergens] }; }
export function sameControls(a: Controls, b: Controls): boolean { return a.perOrderEur === b.perOrderEur && a.substitution === b.substitution && a.lateDelivery === b.lateDelivery && a.excludeAllergens.length === b.excludeAllergens.length && [...a.excludeAllergens].sort().every((code, index) => code === [...b.excludeAllergens].sort()[index]); }
export function toDraft(base: Mandate, c: Controls): MandateDraft { return { agentId: base.agentId, issuedBy: base.issuedBy, limits: { perOrderEur: c.perOrderEur, perWeekEur: base.limits.perWeekEur }, substitution: c.substitution, lateDelivery: c.lateDelivery, hardConstraints: { excludeAllergens: [...c.excludeAllergens], requireLabels: [...base.hardConstraints.requireLabels] }, priorities: [...base.priorities], validUntil: base.validUntil }; }
export function limitOptions(presets: Record<string, Mandate>): number[] { return [...new Set([...LIMIT_OPTIONS_EUR, ...Object.values(presets).map(({ limits }) => limits.perOrderEur)])].sort((a, b) => a - b); }
export function allergenRuleCodes(presets: Record<string, Mandate>): string[] { return [...new Set(Object.values(presets).flatMap(({ hardConstraints }) => hardConstraints.excludeAllergens))].sort(); }

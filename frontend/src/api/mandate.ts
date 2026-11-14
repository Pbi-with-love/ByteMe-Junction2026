import type { Mandate } from './schemas';
import type { MandateDraft } from './gateway';

export type Controls = { perOrderEur: number; substitution: string; lateDelivery: string; excludeAllergens: string[]; priority: string };
export const PRIORITY_OPTIONS = ['on_time', 'price'] as const;
export const LIMIT_OPTIONS_EUR: readonly number[] = [200, 500, 2000];
type MandateControls = Mandate | MandateDraft;
export function controlsOf(m: MandateControls): Controls { return { perOrderEur: m.limits.perOrderEur, substitution: m.substitution, lateDelivery: m.lateDelivery, excludeAllergens: [...m.hardConstraints.excludeAllergens], priority: m.priorities[0] }; }
export function sameControls(a: Controls, b: Controls): boolean { return a.perOrderEur === b.perOrderEur && a.substitution === b.substitution && a.lateDelivery === b.lateDelivery && a.priority === b.priority && a.excludeAllergens.length === b.excludeAllergens.length && [...a.excludeAllergens].sort().every((code, index) => code === [...b.excludeAllergens].sort()[index]); }
export function toDraft(base: Mandate, c: Controls): MandateDraft { return { agentId: base.agentId, issuedBy: base.issuedBy, limits: { perOrderEur: c.perOrderEur, perWeekEur: base.limits.perWeekEur }, substitution: c.substitution, lateDelivery: c.lateDelivery, hardConstraints: { excludeAllergens: [...c.excludeAllergens], requireLabels: [...base.hardConstraints.requireLabels] }, priorities: [c.priority, ...base.priorities.filter((p) => p !== c.priority)], validUntil: base.validUntil }; }
export function priorityOptions(presets: Record<string, Mandate>): string[] { return [...new Set([...PRIORITY_OPTIONS, ...Object.values(presets).map((mandate) => mandate.priorities[0])])]; }
export function limitOptions(presets: Record<string, Mandate>): number[] { return [...new Set([...LIMIT_OPTIONS_EUR, ...Object.values(presets).map(({ limits }) => limits.perOrderEur)])].sort((a, b) => a - b); }
export function allergenRuleCodes(presets: Record<string, Mandate>): string[] { return [...new Set(Object.values(presets).flatMap(({ hardConstraints }) => hardConstraints.excludeAllergens))].sort(); }

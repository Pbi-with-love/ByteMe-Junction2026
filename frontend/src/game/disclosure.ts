import type { AgentStep, PlanLine } from '../api/schemas';

function helsinkiDate(dateTime: string): string {
 const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(dateTime));
 const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
 return `${values.year}-${values.month}-${values.day}`;
}

export function optionDisclosure(planId: string, step: AgentStep): { lateLines: PlanLine[]; allergens: string[] } {
 const plan = step.quote.plans.find(item => item.planId === planId);
 if (!plan) return { lateLines: [], allergens: [] };
 const deadlineDate = helsinkiDate(step.quote.need.deadline);
 const lateLines = plan.lines.filter(line => line.availableDate > deadlineDate);
 const allergens: string[] = [];
 for (const line of plan.lines) {
  for (const allergen of [...(line.allergens ?? []), ...(line.mayContain ?? [])]) if (!allergens.includes(allergen)) allergens.push(allergen);
  const row = step.search.results.find(result => result.productId === line.productId);
  if (!row || !('allergens' in row) || !row.allergens) continue;
  for (const allergen of row.allergens) if (!allergens.includes(allergen)) allergens.push(allergen);
 }
 return { lateLines, allergens };
}

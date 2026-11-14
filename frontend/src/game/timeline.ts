import type { AgentStep, Light, Quote, ReasonCode, SearchResponse } from '../api/schemas';
import type { DirectorStep } from '../world/director';

export interface TimelineEntry {
  id: string;
  kind: 'search' | 'quote' | 'order';
  stepIndex: number;
  at: string;
  light: Light | null;
  status?: 'ORDERED' | 'PENDING_APPROVAL' | 'BLOCKED' | 'ERROR';
  title: string;
  reasons: ReasonCode[];
  step: DirectorStep;
}
const rec = (quote: Quote) => quote.plans.find(p => p.recommended) ?? quote.plans[0];
export function nonValioBrands(quote: Quote, search: SearchResponse): string[] {
  const brands = new Set<string>();
  for (const line of rec(quote)?.lines ?? []) {
    const product = search.results.find(p => p.productId === line.productId);
    if (product && 'brand' in product && product.brand && !/^Valio\b/.test(product.brand)) brands.add(product.brand);
  }
  return [...brands];
}
export function toTimelineEntries(step: DirectorStep, stepIndex: number): TimelineEntry[] {
  const base = { step, stepIndex };
  const searchExcluded = step.search.results.filter(row => row.excluded).length;
  const quote = step.quote;
  const recommended = rec(quote);
  const order = step.order;
  let orderEntry: TimelineEntry;
  if (order.httpStatus === 201) {
    const body = order.body as Extract<AgentStep['order'], { httpStatus: 201 }>['body'];
    orderEntry = { ...base, id: `${stepIndex}-order`, kind: 'order', at: body.createdAt, light: quote.plans.find(p => p.planId === body.planId)?.policy.light ?? null, status: 'ORDERED', title: `Ordered ${body.orderId}`, reasons: [] };
  } else if (order.httpStatus === 202) {
    const body = order.body as Extract<AgentStep['order'], { httpStatus: 202 }>['body'];
    orderEntry = { ...base, id: `${stepIndex}-order`, kind: 'order', at: step.approval?.createdAt ?? quote.createdAt, light: 'YELLOW', status: 'PENDING_APPROVAL', title: 'Approval requested', reasons: body.reasons };
  } else if (order.httpStatus === 403) {
    const body = order.body as { error: { message: string } };
    orderEntry = { ...base, id: `${stepIndex}-order`, kind: 'order', at: quote.createdAt, light: 'RED', status: 'BLOCKED', title: body.error.message, reasons: [] };
  } else {
    const body = order.body as { error: { code: string; message: string } };
    orderEntry = { ...base, id: `${stepIndex}-order`, kind: 'order', at: quote.createdAt, light: null, status: 'ERROR', title: `${body.error.code}: ${body.error.message}`, reasons: [] };
  }
  return [
    { ...base, id: `${stepIndex}-search`, kind: 'search', at: quote.createdAt, light: null, title: `Searched the catalog: ${step.search.total} products, ${searchExcluded} excluded`, reasons: [] },
    { ...base, id: `${stepIndex}-quote`, kind: 'quote', at: quote.createdAt, light: recommended?.policy.light ?? null, title: recommended?.summary ?? 'Quote created', reasons: recommended?.policy.reasons ?? [] },
    orderEntry,
  ];
}

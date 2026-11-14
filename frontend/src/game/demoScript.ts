export type DemoCard = { title: string; text: string; pauseDisabled?: boolean; automatic?: boolean };

export const narratorCopy: DemoCard[] = [
  { title: 'Welcome to Agent Kitchen', text: 'This is Agent Kitchen: an AI agent buys ingredients for a hotel. You are the kitchen manager, and your only job is to decide how much authority the agent gets. Every price, block and order you will see comes from a real gateway.' },
  { title: 'The level', text: 'Level 1: a hotel needs 1 000 l of lactose-free milk for Monday morning, but only 700 l of the usual Valio milk can arrive in time.' },
  { title: 'The briefing', text: 'This briefing is what the manager knows. For the missing 300 l the agent can buy a similar product that arrives on time, or wait a day for Valio’s own milk. Which of these it may do alone depends on your mandate.' },
  { title: 'Manager Desk', text: 'The Manager Desk is where authority is given. The written permission is called a mandate.' },
  { title: 'Balanced mandate', text: 'Balanced: orders up to {perOrderLimit} are fine on their own, same-category substitutes are allowed, late delivery is not. Tight enough to be safe, loose enough to let the agent work.' },
  { title: 'Sign the mandate', text: 'Signing makes the promise binding. The gateway checks this signature on every request the agent makes: no valid mandate, no purchase.' },
  { title: 'Send to agent', text: 'The agent is a separate program that calls the gateway like any outside agent would. It has no special access, so any agent could take its place.' },
  { title: 'The agent is working', text: 'The agent searches the catalog, asks Valio Aimo for a signed quote, and the gateway rates each plan: green, blue, yellow or red.' },
  { title: 'Approval needed', text: 'Yellow: the best plan costs {planTotal}, above your {perOrderLimit} limit, so the agent may not decide alone. It asks you, and that costs one of your three hearts.', pauseDisabled: true },
  { title: 'You approve', text: 'You approve. The decision is logged and the order is placed at the fixed price Valio Aimo quoted.' },
  { title: 'The result', text: '{stars} of 3 stars. Kitchen {kitchen}: the milk arrived on time. Safety {safety}: no hard rule was broken; {heartsLeft} hearts left.' },
  { title: 'Receipt and log', text: 'The receipt explains itself, and the log is a hash chain: anyone can verify that nothing was changed afterwards. This is the proof that both sides kept their promises.' },
  { title: 'Valio Aimo’s view', text: 'This board is Valio Aimo’s side of the agent’s calls. The table “Returned to agent vs withheld” lists what the agent was given and what was held back. Under “Data boundary”, purchase prices, margins and other customers’ data sit in “Never exposed”.' },
  { title: 'Compare mandates', text: 'Same level, three mandates. Strict asks {strictApprovals} times and leaves the kitchen short, Loose never asks and quietly accepts a late delivery, Balanced finds the balance. The mandate is the guardrail.' },
  { title: 'The mandate is the guardrail', text: 'That is Agent Kitchen. Agents don’t need a chatbot. They need a mandate.', automatic: false },
];

export function interpolateDemoText(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{(\w+)\}([,.;:]?)/g, (_match, key: string, punctuation: string) => values[key] ? `${values[key]}${punctuation}` : '')
    .replace(/\s+([,.;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

export function demoCardText(index: number, values: Record<string, string | undefined>): string {
  if (index === 4 && !values.perOrderLimit) return 'Balanced: orders within the mandate’s limit are fine on their own, same-category substitutes are allowed, late delivery is not. Tight enough to be safe, loose enough to let the agent work.';
  if (index === 8 && (!values.planTotal || !values.perOrderLimit)) return 'Yellow: the best plan is above the mandate limit, so the agent may not decide alone. It asks you, and that costs one of your three hearts.';
  if (index === 10 && (!values.stars || !values.kitchen || !values.safety || !values.heartsLeft)) {
    const lead = [values.stars ? `${values.stars} of 3 stars` : '', values.kitchen ? `Kitchen score ${values.kitchen}` : ''].filter(Boolean).join('. ');
    const tail = [values.safety ? `Safety score ${values.safety}` : '', values.heartsLeft ? `${values.heartsLeft} hearts left` : ''].filter(Boolean).join('; ');
    return [lead, tail].filter(Boolean).join('. ') + (lead || tail ? '.' : 'The result is shown here.');
  }
  if (index === 13 && !values.strictApprovals) return 'Same level, three mandates. Strict can leave the kitchen short, Loose quietly accepts a late delivery, Balanced finds the balance. The mandate is the guardrail.';
  return interpolateDemoText(narratorCopy[index]!.text, values);
}

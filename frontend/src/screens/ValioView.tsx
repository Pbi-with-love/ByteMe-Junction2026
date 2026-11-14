import { useEffect, useState } from 'react';
import type { GatewayClient } from '../api/gateway';
import type { Discovery, LogEvent } from '../api/schemas';
import LightBadge from '../components/LightBadge';
import PixelPanel from '../components/PixelPanel';
import { formatTime } from '../lib/format';

type Props = { client: GatewayClient; onBack(): void; onLoaded?: () => void };
type Data = { discovery: Discovery; events: LogEvent[] };

function Chips({ values, locked = false, never = [], empty = 'Nothing' }: { values: string[]; locked?: boolean; never?: string[]; empty?: string }) {
  if (!values.length) return <span>{empty}</span>;
  return <ul className="valio-chips">{values.map((value) => { const isLocked = locked || never.includes(value); return <li key={value} className={isLocked ? 'valio-locked' : undefined}>
    {isLocked && <span aria-hidden="true">▣ </span>}{value}{isLocked && <span> · never exposed</span>}
  </li>;})}</ul>;
}

export default function ValioView({ client, onBack, onLoaded }: Props) {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    Promise.all([client.discovery(), client.getLog('valio')]).then(([discovery, log]) => {
      if (active) { setData({ discovery, events: [...log.events].sort((a, b) => a.seq - b.seq) }); onLoaded?.(); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load Valio view');
    });
    return () => { active = false; };
  }, [client, onLoaded]);

  if (!data) {
    if (error) return <div className="valio-screen"><header className="valio-header"><div><h1>Valio Aimo view</h1><span className="valio-operator">Operator · read-only</span></div><button type="button" className="button button-ghost" onClick={onBack}>Back to results</button></header><main><div role="alert" className="valio-error">Error: {error}</div></main></div>;
    return <main className="valio-loading"><PixelPanel variant="notice" title="Loading Valio view…" /></main>;
  }

  const { discovery, events } = data;
  const agents = [...new Set(events.map((event) => event.agentId))].map((agentId) => {
    const own = events.filter((event) => event.agentId === agentId);
    return { agentId, customerId: own[0]!.customerId, mandates: [...new Set(own.filter((event) => event.type === 'MANDATE_SIGNED').map((event) => event.refs?.mandateId).filter((id): id is string => Boolean(id)))] };
  });
  const blocked = events.filter((event) => event.light === 'RED' || ['POLICY_BLOCKED', 'DATA_BOUNDARY_BLOCKED'].includes(event.type));
  const scenarios = events.filter((event) => event.actor === 'scenario');
  const disclosed = events.filter((event) => event.disclosure);
  const never = discovery.dataDisclosure.neverExposed;
  return <div className="valio-screen">
    <header className="valio-header"><div><h1 tabIndex={-1}>Valio Aimo view</h1><span className="valio-operator">Operator · read-only</span></div><button type="button" className="button button-ghost" onClick={onBack}>Back to results</button></header>
    <main className="valio-main">
      <section className="valio-section valio-boundary"><h2>Data boundary</h2><div className="valio-tiers">{(['public', 'customerScoped', 'neverExposed'] as const).map((key, index) => <section key={key}><h3>{['Public', 'Customer-scoped', 'Never exposed'][index]}</h3><Chips values={discovery.dataDisclosure[key]} locked={key === 'neverExposed'} /></section>)}</div></section>
      <div className="valio-columns"><div className="valio-left">
        <section className="valio-section"><h2>Active agents</h2><div className="valio-scroll"><table><caption className="sr-only">Active agents</caption><thead><tr><th>Agent</th><th>Customer</th><th>Mandates</th></tr></thead><tbody>{agents.map((agent) => <tr key={agent.agentId}><td>{agent.agentId}</td><td>{agent.customerId}</td><td><Chips values={agent.mandates} empty="None" /></td></tr>)}</tbody></table></div></section>
        <section className="valio-section"><h2>Blocked attempts</h2><div className="valio-scroll">{blocked.length ? blocked.map((event) => <article className="valio-blocked" key={event.eventId}><div><LightBadge light="RED" /> {formatTime(event.at)} · {event.agentId}</div><strong>{event.type}</strong><Chips values={event.reasons} /><p>{event.summary}</p></article>) : <p>No blocked attempts.</p>}</div></section>
        <section className="valio-section"><h2>Scenario adjustments</h2>{scenarios.length ? scenarios.map((event) => <article className="valio-scenario" key={event.eventId}><strong>Scenario adjustment</strong> · {formatTime(event.at)}<p>{event.summary}</p></article>) : <p>No scenario adjustments.</p>}</section>
      </div><section className="valio-section"><h2>Returned to agent vs withheld</h2><div className="valio-scroll"><table><caption className="sr-only">Returned to agent vs withheld</caption><thead><tr>{['Time', 'Agent', 'Call', 'Returned to agent', 'Withheld'].map((title) => <th key={title}>{title}</th>)}</tr></thead><tbody>{disclosed.map((event) => <tr key={event.eventId}><td>{formatTime(event.at)}</td><td>{event.agentId}</td><td>{event.type}</td><td><Chips values={event.disclosure!.returnedToAgent} /></td><td><Chips values={event.disclosure!.withheld} never={never} /></td></tr>)}</tbody></table></div></section></div>
    </main>
  </div>;
}

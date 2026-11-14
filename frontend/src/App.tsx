import { useEffect, useState } from 'react';
import type { GatewayClient } from './api/gateway';
import { LEVELS } from './game/levels';

export default function App({ client }: { client: GatewayClient }) {
  const [provider, setProvider] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    client.discovery()
      .then((discovery) => {
        if (active) setProvider(discovery.provider);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { active = false; };
  }, [client]);

  if (error) return <main><p role="alert">{error}</p></main>;
  if (!provider) return <main>Connecting…</main>;
  return (
    <main>
      <h1>{provider}</h1>
      <section>
        {LEVELS.map((level) => (
          <article key={level.levelId}>
            <h2>{level.title}</h2>
          </article>
        ))}
      </section>
    </main>
  );
}

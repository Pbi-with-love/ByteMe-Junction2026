import { useState } from 'react';
import App from './App';
import { createGatewayClient, gatewayMode } from './api/gateway';
import ErrorBoundary from './components/ErrorBoundary';
import ModeBadge from './components/ModeBadge';

type Environment = Record<string, string | undefined>;
type Runtime = { mode: 'replay' | 'live'; client: ReturnType<typeof createGatewayClient> } | { error: string };

export default function Root({ env }: { env: Environment }) {
  const [runtime] = useState<Runtime>(() => {
    try {
      const mode = gatewayMode(env);
      return { mode, client: createGatewayClient(env, mode) };
    }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  });
  const [appKey, setAppKey] = useState(0);

  if ('error' in runtime) return <main className="demo-error" role="alert"><h1>Gateway configuration error</h1><p>{runtime.error}</p></main>;
  return <>
    <ModeBadge mode={runtime.mode} />
    <ErrorBoundary onReset={() => setAppKey((key) => key + 1)}>
      <App key={appKey} client={runtime.client} />
    </ErrorBoundary>
  </>;
}

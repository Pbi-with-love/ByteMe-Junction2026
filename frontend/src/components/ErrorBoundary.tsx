import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; onReset: () => void };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(_error: Error, _info: ErrorInfo) { /* React reports render failures in development. */ }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render() {
    if (this.state.error) return <main className="demo-error" role="alert">
      <svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg>
      <h1>Something went wrong</h1><p>{this.state.error.message}</p>
      <button className="button button-ghost" onClick={this.reset}>Back to levels</button>
    </main>;
    return this.props.children;
  }
}

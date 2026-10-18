import { Component } from 'react';
import { LogoMark } from './ui/Logo';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('React error boundary caught an error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center">
          <LogoMark size={36} className="mx-auto" />
          <h1 className="mt-5 text-lg font-semibold text-fg">Something went wrong</h1>
          <p className="mt-2 text-sm text-fg-muted">
            This page hit an unexpected error. Monitoring keeps running on the server — reload to continue.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">
              Reload page
            </button>
            <a href="/" className="btn-secondary">
              Go to home
            </a>
          </div>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;

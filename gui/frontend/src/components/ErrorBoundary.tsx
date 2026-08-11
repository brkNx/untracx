import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging — in production, send to monitoring service
    console.error('ErrorBoundary caught:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Bir hata oluştu</h2>
          <p>{this.state.error?.message || 'Beklenmeyen bir hata.'}</p>
          <button
            className="btn btn--primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tekrar Dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

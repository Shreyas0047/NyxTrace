/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 * Prevents white blank screens on component errors
 */

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: error.stack || '',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      hasError: true,
      error,
      errorInfo: errorInfo.componentStack || '',
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: '',
    });
    this.props.onReset?.();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[var(--surface-container-low)]  flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="bg-white  rounded-3xl border border-red-500/30 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-600 " />
              </div>

              <h1 className="text-2xl font-bold text-white mb-3">
                Something went wrong
              </h1>

              <p className="text-[var(--text-secondary)]  mb-6">
                We encountered an error loading this page. This has been logged and we'll work to fix it.
              </p>

              {typeof window !== 'undefined' && this.state.error && (
                <div className="mb-6 p-4 bg-[var(--surface-container-low)]  rounded-lg text-left">
                  <p className="text-red-600  text-sm font-mono mb-2">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  <details className="text-xs text-[var(--text-secondary)] font-mono">
                    <summary className="cursor-pointer text-[var(--text-secondary)]  hover:text-[var(--text-secondary)] ">
                      Stack trace
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">
                      {this.state.error.stack}
                    </pre>
                  </details>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={this.handleReset}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
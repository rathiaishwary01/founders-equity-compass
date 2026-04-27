import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you'd send this to Sentry or similar
    console.error("Simulator error caught by boundary:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <div>
            <h2 className="text-base font-bold text-red-700">Something went wrong in the simulator</h2>
            <p className="text-sm text-red-500 mt-1">
              This is usually caused by an unexpected combination of inputs. Your saved data is safe.
            </p>
          </div>
          {this.state.error && (
            <details className="text-left">
              <summary className="text-xs text-red-400 cursor-pointer">Technical details</summary>
              <pre className="text-[10px] text-red-400 mt-2 overflow-auto bg-red-100 rounded p-2">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

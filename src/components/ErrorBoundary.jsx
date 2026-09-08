import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
            <span className="text-5xl">😵</span>
            <h1 className="text-xl font-black text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-500">The page encountered an error. Try refreshing.</p>
            {this.state.error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2 text-left overflow-auto max-h-40">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#7A4BC8] text-white rounded-xl text-sm font-bold"
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm font-bold"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Admin Portal:', error, errorInfo);
  }

  private handleReload = () => {
    localStorage.removeItem('rfy_admin_token');
    localStorage.removeItem('rfy_admin_user');
    window.location.href = '/admin/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#FBFBFD] flex items-center justify-center p-6 text-[#172B3A]">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#EDF2F1] shadow-xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-[#172B3A] mb-2">Something went wrong</h2>
            <p className="text-xs text-[#8A97A0] mb-6">
              The dashboard encountered an unexpected state. Click below to refresh and re-enter.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#1FAE72] to-[#5FD9A4] text-white font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 shadow-md shadow-emerald-500/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Admin Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

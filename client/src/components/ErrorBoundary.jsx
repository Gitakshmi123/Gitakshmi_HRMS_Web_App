import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center">
                    <h2 className="text-2xl font-black text-rose-800 uppercase tracking-tighter mb-4">Component Critical Failure</h2>
                    <p className="text-sm text-rose-600 mb-6 font-medium">The system encountered an unhandled exception in this module.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                    >
                        Re-Initialize Session
                    </button>
                    <pre className="mt-8 p-4 bg-slate-900 text-rose-400 text-[10px] text-left rounded-xl overflow-auto max-h-40">
                        {this.state.error?.toString()}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

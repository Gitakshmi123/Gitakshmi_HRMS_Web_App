import React from 'react';
import { AlertCircle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('=== PAYSLIP BUILDER ERROR BOUNDARY ===');
        console.error('Error:', error);
        console.error('Error Stack:', error.stack);
        console.error('Component Stack:', errorInfo.componentStack);
        this.setState({
            error,
            errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-red-100 rounded-full">
                                <AlertCircle size={32} className="text-red-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-gray-900">Builder Crashed</h1>
                                <p className="text-sm text-gray-500">The visual builder encountered an error</p>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                            <p className="font-mono text-sm text-red-800 whitespace-pre-wrap break-words">
                                {this.state.error?.toString()}
                            </p>
                        </div>

                        {this.state.errorInfo && (
                            <details className="bg-gray-50 rounded-xl p-4 text-sm font-mono text-gray-600">
                                <summary className="cursor-pointer font-bold text-gray-900 mb-2">Stack Trace</summary>
                                <pre className="overflow-auto text-xs whitespace-pre-wrap break-words">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

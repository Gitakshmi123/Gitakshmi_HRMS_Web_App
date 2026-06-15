import React from 'react';

export default function NotFound(){
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="w-full max-w-md text-center">
        <h1 className="text-9xl font-black text-indigo-100 selection:bg-transparent tracking-tighter">404</h1>
        <div className="relative -mt-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Page Not Found</h2>
          <p className="text-slate-500 font-medium mb-8">The page you are looking for might have been removed or is temporarily unavailable.</p>
          <a href="/" className="inline-flex items-center px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all">
            Return Home
          </a>
        </div>
      </div>
    </div>
  );
}

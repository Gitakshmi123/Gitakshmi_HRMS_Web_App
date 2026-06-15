import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function HRLogin() {
  const { loginHR, logout, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // CRITICAL: Call proper logout so AuthContext user state is also cleared on mounting login page
    logout();
  }, [logout]);

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (isSubmitting || authLoading) return;

    setError('');
    setIsSubmitting(true);

    try {
      const res = await loginHR(email.trim(), password);
      if (res.success) {
        navigate('/tenant/dashboard'); // Redirect to tenant dashboard
      } else {
        setError(res.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = isSubmitting || authLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-10 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-1">Company Login</h2>
        <p className="text-center text-slate-500 text-sm mb-8">Access your HR & Management Panel</p>

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              type="email" 
              required 
              disabled={isLoading}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400" 
              placeholder="admin@company.com" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              type="password" 
              required 
              disabled={isLoading}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400" 
              placeholder="••••••••" 
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Logging in...
                </>
              ) : 'Sign In'}
            </button>
          </div>

          <div className="flex flex-col gap-3 items-center pt-4 border-t border-slate-100">
            <div className="flex gap-4">
               <button type="button" onClick={() => navigate('/employee/login')} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">Employee Portal</button>
               <span className="text-slate-300">|</span>
               <button type="button" onClick={() => navigate('/login')} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Super Admin</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

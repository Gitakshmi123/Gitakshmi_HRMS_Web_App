import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import Loader from '../components/common/Loader';

export default function VerifyCompany() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying...');

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      setMessage('Missing verification token');
      return;
    }

    (async () => {
      try {
        const res = await api.get(`/company/verify-company/${token}?json=1`);
        if (res.status === 200 && res.data && (res.data.success === true || typeof res.data === 'string')) {
          setStatus('success');
          setMessage('Company successfully activated. You can now login.');
        } else {
          setStatus('error');
          setMessage(res.data?.message || 'Verification failed');
        }
      } catch (err) {
        setStatus('error');
        const msg = err?.response?.data?.error || err?.response?.data?.message || err.message;
        setMessage(msg || 'Invalid or expired verification link');
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md text-center">
        {status === 'loading' && <Loader text="Verifying Company" />}
        {status === 'success' && (
          <>
            <h2 className="text-xl font-semibold mb-2">Verification Successful</h2>
            <p className="mb-4">{message}</p>
            <Link to="/login" className="px-4 py-2 bg-blue-600 text-white rounded">Go to Login</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 className="text-xl font-semibold mb-2">Verification Failed</h2>
            <p className="mb-4">{message}</p>
            <Link to="/" className="px-4 py-2 bg-gray-600 text-white rounded">Home</Link>
          </>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { useLocation } from 'react-router-dom';
import { buildSsoLoginRedirectUrl } from '../../utils/api';

export function AccessDeniedPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 520, padding: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Access Denied</h1>
        <p>Your account does not have access to HRMS in GT ONE.</p>
      </div>
    </div>
  );
}

export function AuthErrorPage() {
  const location = useLocation();
  const errorMessage = String(location.state?.message || 'Unable to validate session with backend.');
  const retryUrl = buildSsoLoginRedirectUrl(`${window.location.origin}/tenant/dashboard`);
  const retryLabel = 'Go To Login Portal';

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 720, padding: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Authentication Error</h1>
        <p style={{ marginBottom: 16 }}>{errorMessage}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href={retryUrl}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              textDecoration: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {retryLabel}
          </a>
        </div>
      </div>
    </div>
  );
}

export function UnauthorizedPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 560, padding: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Unauthorized</h1>
        <p>You do not have permission to access this page.</p>
      </div>
    </div>
  );
}

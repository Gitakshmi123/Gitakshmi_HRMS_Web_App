/**
 * PermissionGate.jsx
 * ──────────────────────────────────────────────────────────────────
 * Conditional rendering based on page-level RBAC permissions.
 *
 * Usage:
 *   <PermissionGate module="people.employees" action="view">
 *     <EmployeesPage />
 *   </PermissionGate>
 *
 *   <Can module="people.employees" action="create">
 *     <AddEmployeeButton />
 *   </Can>
 */

import React from 'react';
import { ShieldOff } from 'lucide-react';
import { useRBAC } from '../../context/RBACContext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

/* ─── No-Access Page ─────────────────────────────────────────── */
export function NoAccessPage({ module, action = 'view' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '40px 24px', textAlign: 'center',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
        border: '1.5px solid #fecaca',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, boxShadow: '0 8px 24px rgba(239,68,68,0.12)'
      }}>
        <ShieldOff size={34} color="#ef4444" strokeWidth={1.8}/>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
        Access Restricted
      </h2>
      <p style={{ fontSize: 14, color: '#64748b', maxWidth: 320, lineHeight: 1.65, margin: '0 0 24px' }}>
        You don't have <strong>{action}</strong> permission
        {module ? ` for "${module}"` : ''}.
        Contact your administrator to request access.
      </p>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 18px', borderRadius: 10,
        background: '#fef2f2', border: '1px solid #fecaca',
        fontSize: 12, fontWeight: 700, color: '#b91c1c', letterSpacing: '0.05em'
      }}>
        🔒 PERMISSION DENIED
      </div>
    </div>
  );
}

/* ─── Main Gate ──────────────────────────────────────────────── */
/**
 * @param {string}   module      - Page key e.g. "people.employees"
 * @param {string}   action      - "view" | "create" | "edit" | "delete"
 * @param {boolean}  renderNull  - If true, render nothing instead of NoAccessPage
 * @param {ReactNode} fallback   - Custom fallback instead of NoAccessPage
 * @param {boolean}  showLoading - Show spinner while permissions load (default true)
 */
export default function PermissionGate({
  module,
  action = 'view',
  renderNull   = false,
  fallback     = null,
  showLoading  = true,
  children,
}) {
  const { hasPermission, loading } = useRBAC();

  if (loading && showLoading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'rbac-spin 0.8s linear infinite' }}/>
        <style>{`@keyframes rbac-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!hasPermission(module, action)) {
    if (renderNull) return null;
    if (fallback)   return <>{fallback}</>;
    return <NoAccessPage module={module} action={action}/>;
  }

  return <>{children}</>;
}

/* ─── Route-level Guard ──────────────────────────────────────── */
function RedirectWithToast({ module }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    toast(`Access Restricted: Contact Admin for ${module || 'this'} access`, {
      icon: '🛡️',
      style: {
        background: '#059669', // Professional Emerald Green
        color: '#fff',
        fontWeight: '600',
        padding: '12px 20px',
        borderRadius: '10px'
      }
    });

    // Navigate safely to dashboard
    navigate('/employee', { replace: true });
  }, [navigate, module]);

  return null;
}

export function RoutePermissionGuard({ module, action = 'view', children }) {
  const { hasPermission, loading } = useRBAC();

  if (loading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'rbac-spin 0.8s linear infinite' }} />
        <style>{`@keyframes rbac-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!hasPermission(module, action)) {
    return <NoAccessPage module={module} action={action} />;
  }

  return <>{children}</>;
}

/* ─── Inline / Button guard (renders null on fail) ──────────── */
/**
 * <Can module="people.employees" action="create">
 *   <button>Add Employee</button>
 * </Can>
 */
export function Can({ module, action = 'view', children }) {
  return (
    <PermissionGate module={module} action={action} renderNull showLoading={false}>
      {children}
    </PermissionGate>
  );
}

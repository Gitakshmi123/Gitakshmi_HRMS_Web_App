import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { normalizeModuleCode } from '../../utils/moduleConfig';

/**
 * Renders children only when the canonical module is enabled for the company.
 * Use on dashboards/widgets — pair with ProtectedModule on routes.
 */
export default function ModuleGate({ module, children, fallback = null }) {
  const { hasModule } = useAuth();
  const code = normalizeModuleCode(module);
  if (!code || !hasModule(code)) return fallback;
  return <>{children}</>;
}

import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { normalizeModuleCode } from '../utils/moduleConfig';

/**
 * UI helpers for feature areas keyed by canonical module codes (from JWT / tenant config).
 */
export function useModuleAccess() {
  const { enabledModules, hasModule } = useAuth();

  const enabledKeySet = useMemo(() => {
    if (!enabledModules || typeof enabledModules !== 'object') return new Set();
    return new Set(
      Object.entries(enabledModules)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    );
  }, [enabledModules]);

  const filterByModule = useCallback(
    (items, getModuleCode) => {
      if (!Array.isArray(items)) return [];
      return items.filter((item) => {
        const code = normalizeModuleCode(getModuleCode(item));
        if (!code) return false;
        return hasModule(code);
      });
    },
    [hasModule]
  );

  return {
    enabledModules,
    enabledKeySet,
    hasModule,
    filterByModule,
  };
}

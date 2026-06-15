import { useEffect, useState } from "react";
import api from "../utils/api";
import { getSessionToken } from "../utils/ssoToken";

/**
 * Shared hook to fetch the global navigation structure (modules -> pages -> subpages).
 * Frontend Sidebar and Access Control both use this as their single source of truth.
 */
let modulesCache = null;
let modulesCacheAt = 0;
let inflightModulesPromise = null;
const MODULES_CACHE_TTL_MS = 5 * 60 * 1000;

export const useModules = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Optimization: Do not fetch if no session token is present
    if (!getSessionToken()) {
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (modulesCache && now - modulesCacheAt < MODULES_CACHE_TTL_MS) {
      setModules(modulesCache);
      setLoading(false);
      return;
    }

    if (!inflightModulesPromise) {
      inflightModulesPromise = api.get("/system/modules-full")
        .then((res) => {
          const parsedModules = Array.isArray(res.data)
            ? res.data
            : (Array.isArray(res.data?.modules) ? res.data.modules : []);

          modulesCache = parsedModules;
          modulesCacheAt = Date.now();

          try {
            localStorage.setItem('hrms_modules_cache', JSON.stringify(parsedModules));
          } catch (_) { /* ignore cache errors */ }

          return parsedModules;
        })
        .finally(() => {
          inflightModulesPromise = null;
        });
    }

    inflightModulesPromise
      .then((parsedModules) => {
        setModules(parsedModules || []);
      })
      .catch((err) => {
        setError(err);
        try {
          const cached = JSON.parse(localStorage.getItem('hrms_modules_cache') || '[]');
          if (Array.isArray(cached) && cached.length > 0) {
            setModules(cached);
          }
        } catch (_) { /* ignore cache errors */ }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { modules, loading, error };
};

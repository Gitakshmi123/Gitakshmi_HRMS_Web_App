/* eslint-disable react-refresh/only-export-components */
/**
 * RBACContext.jsx — Dynamic Page-Level RBAC System
 */

import React, { useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PermissionContext from './RBACContextInstance';
import { useAuth } from './AuthContext';
import { hrmsApi } from '../utils/api';
import { checkPermission, normalizePermissionMap, enrichWithRoutes } from '../utils/permissions';
import { getLegacyPermissionMap, normalizeActionKey } from '../utils/legacyRolePermissions';
import { isPrivilegedManagementRole } from '../utils/employeeAccess';

/* ── Constants ─────────────────────────────────────────────────── */
const LS_PERM_KEY   = 'rbac_perm_map';   // localStorage: serialized permission map
const LS_ROLE_KEY   = 'rbac_role';        // localStorage: role string
const LS_VER_KEY    = 'rbac_perm_ver';    // localStorage: permission version number
const REFETCH_EVENT = 'rbac:refetch';     // DOM event name
const BROADCAST_KEY = 'rbac_sync_signal';
const POLL_MS       = 300000;
const DEBUG         = false;               // silence noisy logs in normal runtime
const RATE_LIMIT_BACKOFF_MS = [800, 1500];
const FETCH_COOLDOWN_MS = 15000;
const RATE_LIMIT_COOLDOWN_MS = 30000;
const LEGACY_ROLE_MODE = false;

/* ── Logger ────────────────────────────────────────────────────── */
const log  = (...a) => DEBUG && console.log ('[RBAC]', ...a);
const warn = (...a) => DEBUG && console.warn('[RBAC]', ...a);

/* ── Helpers ───────────────────────────────────────────────────── */
function buildMap(raw) {
  const map = normalizePermissionMap(raw);
  log('Permission map built:', map);
  return map;
}

function readLS() {
  try {
    const raw = localStorage.getItem(LS_PERM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeLS(map, role, version) {
  try {
    localStorage.setItem(LS_PERM_KEY, JSON.stringify(map));
    if (role)    localStorage.setItem(LS_ROLE_KEY, role);
    if (version !== undefined) localStorage.setItem(LS_VER_KEY, String(version));
    log('Permissions cached in localStorage, role:', role, 'version:', version);
  } catch (e) { warn('localStorage write failed:', e.message); }
}

function clearLS() {
  try {
    localStorage.removeItem(LS_PERM_KEY);
    localStorage.removeItem(LS_ROLE_KEY);
    localStorage.removeItem(LS_VER_KEY);
    log('localStorage permissions cleared');
  } catch {
    // localStorage can be unavailable in private/security contexts.
  }
}

function getNormalizedRoleName(user) {
  return String(user?.roleName || (user?.role && typeof user.role === 'object' ? user.role.name : user?.role) || 'employee').toLowerCase();
}

function isPsaRole(user) {
  const role = getNormalizedRoleName(user);
  return role === 'psa' || role === 'super_admin' || role === 'superadmin';
}

/* ── Context ───────────────────────────────────────────────────── */

/* ── Provider ──────────────────────────────────────────────────── */
export const PermissionProvider = ({ children }) => {
  const { user, isInitialized } = useAuth();

  const [permMap,  setPermMap]  = useState(() => readLS());
  const [permRole, setPermRole] = useState(() => localStorage.getItem(LS_ROLE_KEY));
  const [permVer,  setPermVer]  = useState(() => Number(localStorage.getItem(LS_VER_KEY) || 0));
  const [loading,  setLoading]  = useState(() => !readLS());
  const fetching = useRef(false);
  const hasFetchedForUserRef = useRef(null);
  const retryLaterRef = useRef(null);
  const lastFetchAtRef = useRef(0);
  const pauseUntilRef = useRef(0);

  const getWith429Retry = useCallback(async (requestFactory) => {
    let lastError = null;
    for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFF_MS.length; attempt += 1) {
      try {
        return await requestFactory();
      } catch (err) {
        lastError = err;
        if (err?.response?.status === 429 && attempt < RATE_LIMIT_BACKOFF_MS.length) {
          const waitMs = RATE_LIMIT_BACKOFF_MS[attempt];
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }, []);

  const fetchPermissions = useCallback(async (isBackground = false) => {
    if (!user) return;
    if (isPsaRole(user)) {
      const roleName = getNormalizedRoleName(user);
      const userKey = `${user.id}:${roleName}`;
      if (hasFetchedForUserRef.current !== userKey || !permMap || Object.keys(permMap).length !== 0) {
        setPermMap({});
        setPermRole(roleName);
        setPermVer(0);
        hasFetchedForUserRef.current = userKey;
        writeLS({}, roleName, 0);
      }
      setLoading(false);
      return;
    }
    if (fetching.current) { log('Fetch already in progress, skipping'); return; }
    const now = Date.now();
    if (pauseUntilRef.current > now) {
      log('RBAC fetch paused due to previous failures');
      return;
    }
    if (now - lastFetchAtRef.current < FETCH_COOLDOWN_MS) {
      log('RBAC fetch skipped due to cooldown');
      return;
    }

    fetching.current = true;
    lastFetchAtRef.current = now;
    if (!isBackground) setLoading(true);
    log(`Fetching permissions … user.id=${user.id}, role=${user.role} (isBackground: ${isBackground})`);

    try {
      const permRes = await getWith429Retry(() => hrmsApi.get('/auth/me/permissions', { _silent: true }));
      const modRes = await getWith429Retry(() => hrmsApi.get('/system/modules-full', { _silent: true }));

      const { permissions, role, success, permVersion = 0 } = permRes.data;
      const allModules = Array.isArray(modRes.data)
        ? modRes.data
        : (Array.isArray(modRes.data?.modules) ? modRes.data.modules : []);

      if (!success) {
        warn('API returned success=false:', permRes.data);
        return;
      }

      log('API raw response:', { role, permissions, permVersion });

      const cachedVer = Number(localStorage.getItem(LS_VER_KEY) || 0);
      if (permVersion > cachedVer) {
        log(`🔄 Permission version upgraded: ${cachedVer} → ${permVersion}`);
      }

      let map = buildMap(permissions);
      map = enrichWithRoutes(map, allModules);

      const resolvedRole = role || user.role;
      setPermMap(map);
      setPermRole(resolvedRole);
      setPermVer(permVersion);
      hasFetchedForUserRef.current = `${user.id}:${resolvedRole}`;
      writeLS(map, resolvedRole, permVersion);

      log('✅ Permissions loaded:', { role: resolvedRole, pageCount: Object.keys(map).length });
    } catch (err) {
      warn('API fetch failed:', err?.message);
      if (err?.response?.status === 429 && !retryLaterRef.current) {
        pauseUntilRef.current = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        retryLaterRef.current = window.setTimeout(() => {
          retryLaterRef.current = null;
          fetchPermissions(true);
        }, 2500);
      }
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        pauseUntilRef.current = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      }
      if (user?.permissions?.length) {
        let map = buildMap(user.permissions);
        setPermMap(map);
        writeLS(map, user.role, 0);
      }
    } finally {
      fetching.current = false;
      if (!isBackground) setLoading(false);
    }
  }, [user, getWith429Retry]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      clearLS();
      hasFetchedForUserRef.current = null;
      setPermMap(null);
      setPermRole(null);
      setLoading(false);
      return;
    }

    const userRole = getNormalizedRoleName(user);
    const userKey = `${user.id}:${userRole}`;
    if (isPsaRole(user)) {
      if (hasFetchedForUserRef.current !== userKey || !permMap || Object.keys(permMap).length !== 0) {
        setPermMap({});
        setPermRole(userRole);
        setPermVer(0);
        hasFetchedForUserRef.current = userKey;
        writeLS({}, userRole, 0);
      }
      setLoading(false);
      return;
    }
    // Only fetch if we haven't successfully fetched for this specific user/role yet
    if (hasFetchedForUserRef.current === userKey && permMap) {
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(() => fetchPermissions(!!permMap), 200);
    return () => window.clearTimeout(timer);
  }, [user?.id, user?.role, user?.roleName, isInitialized, fetchPermissions, permMap]);

  useEffect(() => {
    const handler = () => fetchPermissions();
    window.addEventListener(REFETCH_EVENT, handler);
    return () => window.removeEventListener(REFETCH_EVENT, handler);
  }, [fetchPermissions]);

  useEffect(() => {
    const roleName = String(user?.roleName || user?.role || '').toLowerCase();
    const isPrivilegedSyncRole = ['hr', 'admin', 'company_super_admin', 'company_admin', 'super_admin', 'psa'].includes(roleName);
    if (!isPrivilegedSyncRole) return () => {};
    const onStorage = (event) => {
      if (event.key === BROADCAST_KEY && user) fetchPermissions(true);
    };
    window.addEventListener('storage', onStorage);
    const intervalId = window.setInterval(() => { if (user) fetchPermissions(true); }, POLL_MS);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(intervalId);
      if (retryLaterRef.current) window.clearTimeout(retryLaterRef.current);
    };
  }, [fetchPermissions, user]);

  const hasPermission = useCallback((pageKey, action = 'view') => {
    if (!user) return false;
    const normalizedAction = normalizeActionKey(action);
    const roleName = String(user?.roleName || (user?.role && typeof user.role === 'object' ? user.role.name : user?.role) || 'employee').toLowerCase();
    const normalizedPageKey = String(pageKey || '').toLowerCase();
    const entry = permMap?.[pageKey] || permMap?.[normalizedPageKey] || 
                  (permMap && Object.keys(permMap).find(k => k.toLowerCase() === normalizedPageKey) ? permMap[Object.keys(permMap).find(k => k.toLowerCase() === normalizedPageKey)] : null);
    
    // Administrative roles bypass all permission checks to ensure they can manage the system
    // only if no explicit permission entry exists in the map.
    if (isPrivilegedManagementRole(roleName)) {
        if (entry) {
            if (normalizedAction === 'any') {
                if (typeof entry.view === 'boolean' || typeof entry.create === 'boolean' || typeof entry.edit === 'boolean' || typeof entry.delete === 'boolean') {
                    return !!(entry.view || entry.create || entry.edit || entry.delete);
                }
            } else if (typeof entry[normalizedAction] === 'boolean') {
                return entry[normalizedAction];
            }
        }
        return true;
    }

    const legacyMap = LEGACY_ROLE_MODE ? getLegacyPermissionMap(roleName) : null;
    if (legacyMap && checkPermission(legacyMap, pageKey, normalizedAction)) return true;

    if (entry && typeof entry[normalizedAction] === 'boolean') return entry[normalizedAction];

    if (!entry && !(permMap && Object.keys(permMap).length > 0) && ['employee', 'manager', 'staff', 'user'].includes(roleName)) {
      return checkPermission(getLegacyPermissionMap(roleName), pageKey, normalizedAction);
    }

    return checkPermission(permMap, pageKey, normalizedAction);
  }, [user, permMap]);

  const triggerRefetch = useCallback(() => window.dispatchEvent(new Event(REFETCH_EVENT)), []);
  const getFieldAccess = useCallback(() => ({ visible: true, editable: true }), []);

  const value = useMemo(() => ({
    hasPermission,
    permMap,
    permRole,
    permVersion: permVer,
    loading,
    permissions: permMap,
    refetchPermissions: fetchPermissions,
    triggerRefetch,
    user,
    getFieldAccess,
  }), [hasPermission, permMap, permRole, permVer, loading, fetchPermissions, triggerRefetch, user, getFieldAccess]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

export const useRBAC = () => {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('useRBAC must be used within RBACProvider');
  return ctx;
};

export const usePermission = (pageKey, action = 'view') => {
  const ctx = useContext(PermissionContext);
  return ctx ? ctx.hasPermission(pageKey, action) : false;
};

export const RBACProvider = PermissionProvider;
export const RBACContext  = PermissionContext;
export const emitRbacRefetch = () => {
  try {
    localStorage.setItem(REFETCH_EVENT, String(Date.now()));
    localStorage.setItem(BROADCAST_KEY, JSON.stringify({ at: Date.now() }));
  } catch {
    // Cross-tab notification is best-effort only.
  }
  window.dispatchEvent(new Event(REFETCH_EVENT));
};

export default PermissionProvider;

/* eslint-disable react-refresh/only-export-components */
import { useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { AuthContext } from "./AuthContextInstance";
import { hrmsApi, parseAxiosError, SSO_API_ROOT, buildSsoLoginRedirectUrl, getSsoPortalLoginUrl } from "../utils/api";
import { consumeTokenFromUrl, clearSession, getSessionToken, applyAuthHeader } from "../utils/ssoToken";
import { buildEnabledModulesFromSession } from "../utils/sessionModuleMap";
import { normalizeModuleCode } from "../utils/moduleConfig";
import { isEmployeeLikeRole } from "../utils/employeeAccess";
import { setToken } from "../utils/token";
import locationTrackingService from "../services/locationTracking.service";
import Loader from "../components/common/Loader";
import {
  getDirectLoginPath,
  getHostedHrmsSsoTarget,
  getPreferredLoginPath,
  shouldUseHostedHrmsSsoHandoff,
  USE_SSO_ONLY_AUTH,
} from "../utils/appConfig";


const SSO_LOGOUT_BASE_URL = `${SSO_API_ROOT}/api/auth/logout`;
const MANUAL_LOGOUT_KEY = 'hrms:manual-logout-at';
const MANUAL_LOGOUT_TTL_MS = 2 * 60 * 1000;
const STORAGE_NAMES = ['localStorage', 'sessionStorage'];
const SESSION_ARTIFACT_KEYS = [
  'enabledModules',
  'modules',
  'tenantId',
  'company',
  'companyId',
  'companyCode',
  'companyName',
  'tenant_nav_intent',
];
/** Keep in sync with RBACContext localStorage keys and legacy auth cache keys. */
const RBAC_CACHE_KEYS = [
  'rbac:permissions',
  'rbac:role',
  'rbac:permVersion',
  'rbac:lastFetchedAt',
  'rbac_perm_map',
  'rbac_role',
  'rbac_perm_ver',
];

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

function normalizeUser(user) {
  if (!user) return null;

  return {
    ...user,
    id: user.id || user._id,
    role: (user.role?.name || user.role || 'employee').toLowerCase(),
    roleName: (user.roleName || user.role?.name || user.role || 'employee').toLowerCase(),
  };
}

function removeStorageKeyEverywhere(key) {
  if (typeof window === 'undefined') return;
  STORAGE_NAMES.forEach((storageName) => {
    try {
      window[storageName]?.removeItem(key);
    } catch {
      /* ignore private mode / storage restrictions */
    }
  });
}

function clearLocalSessionArtifacts() {
  SESSION_ARTIFACT_KEYS.forEach(removeStorageKeyEverywhere);
  // clearManualLogoutMark(); // REMOVED: allow skipCookieRestore to function for 2 mins
  RBAC_CACHE_KEYS.forEach(removeStorageKeyEverywhere);
}

function clearManualLogoutMark() {
  removeStorageKeyEverywhere(MANUAL_LOGOUT_KEY);
}

function markManualLogout() {
  try {
    localStorage.setItem(MANUAL_LOGOUT_KEY, String(Date.now()));
  } catch {
    /* ignore storage restrictions */
  }
}

function hasRecentManualLogoutMark() {
  const raw = Number(localStorage.getItem(MANUAL_LOGOUT_KEY) || 0);
  if (!Number.isFinite(raw) || raw <= 0) return false;
  return (Date.now() - raw) <= MANUAL_LOGOUT_TTL_MS;
}

function getAxiosStatus(error) {
  const status = Number(error?.response?.status || 0);
  return Number.isFinite(status) ? status : 0;
}

function isExpectedSessionProbeFailure(error) {
  const status = getAxiosStatus(error);
  return status === 401 || status === 403;
}

function persistTenantContext(payload) {
  const company = payload?.company;
  const user = payload?.user;

  try {
    if (company && typeof company === "object") {
      localStorage.setItem("company", JSON.stringify(company));
    }

    const tenantId = String(user?.tenantId || company?.tenantId || company?._id || "").trim();
    if (tenantId) {
      localStorage.setItem("tenantId", tenantId);
      localStorage.setItem("companyId", tenantId);
    }

    const companyCode = String(user?.companyCode || company?.code || "").trim();
    if (companyCode) {
      localStorage.setItem("companyCode", companyCode);
    }

    const companyName = String(
      company?.companyName || company?.name || user?.companyName || user?.tenantName || ""
    ).trim();
    if (companyName) {
      localStorage.setItem("companyName", companyName);
    }
  } catch {
    /* ignore storage restrictions */
  }
}

function persistEnabledModuleState(normalized, enabledKeys) {
  try {
    localStorage.setItem("enabledModules", JSON.stringify(normalized || {}));
    localStorage.setItem("modules", JSON.stringify(Array.isArray(enabledKeys) ? enabledKeys : []));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [enabledModules, setEnabledModules] = useState(() => {
    try {
      const raw = localStorage.getItem("enabledModules");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const checkAuthInProgress = useRef(false);

  /**
   * Builds the SSO login URL with the current page as the redirect target.
   */
  const getDefaultSsoTarget = useCallback(() => {
    if (shouldUseHostedHrmsSsoHandoff()) {
      return getHostedHrmsSsoTarget();
    }

    return `${window.location.origin}/tenant/dashboard`;
  }, []);

  const getSsoRedirectUrl = useCallback(() => {
    const defaultSsoTarget = getDefaultSsoTarget();

    if (shouldUseHostedHrmsSsoHandoff()) {
      return buildSsoLoginRedirectUrl(defaultSsoTarget);
    }

    const currentPath = String(window.location.pathname || "").toLowerCase();
    const isLocalLoginRoute = [
      "/login",
      "/tenant/login",
      "/login/hr",
      "/login/employee",
      "/employee/login"
    ].includes(currentPath);

    const currentUrl = isLocalLoginRoute
      ? defaultSsoTarget
      : `${window.location.origin}${window.location.pathname}${window.location.search}`;
    return buildSsoLoginRedirectUrl(currentUrl);
  }, [getDefaultSsoTarget]);

  const applySessionFromAuthResponse = useCallback((payload) => {
    if (!payload?.user) return;
    const token = String(payload?.token || payload?.accessToken || "").trim();
    if (token) {
      setToken(token);
      applyAuthHeader(token);
    }
    clearManualLogoutMark();
    setError(null);
    setAccessDenied(false);
    const nextUser = normalizeUser(payload.user);
    setUser(prev => {
      // Prevent reference change if basic user info is identical (stops cascading re-renders)
      if (prev && nextUser && prev.id === nextUser.id && prev.role === nextUser.role && prev.email === nextUser.email) {
        return prev;
      }
      return nextUser;
    });
    persistTenantContext(payload);
    const { normalized, enabledKeys } = buildEnabledModulesFromSession({
      bearerToken: token || getSessionToken(),
      apiResponse: payload,
    });
    setEnabledModules(normalized);
    persistEnabledModuleState(normalized, enabledKeys);

    hrmsApi.get("/tenants/my-modules", { _silent: true })
      .then((res) => {
        const latest = buildEnabledModulesFromSession({
          bearerToken: token || getSessionToken(),
          apiResponse: {
            ...payload,
            enabledModules: res.data?.enabledModules,
            modules: res.data?.modules,
            company: {
              ...(payload.company || {}),
              enabledModules: res.data?.enabledModules,
              modules: res.data?.modules,
            },
          },
        });
        setEnabledModules(latest.normalized);
        persistEnabledModuleState(latest.normalized, latest.enabledKeys);
      })
      .catch(() => {
        /* keep the login payload module state */
      });
  }, []);

  const refreshEnabledModules = useCallback(async () => {
    const res = await hrmsApi.get("/tenants/my-modules", { _silent: true });
    const latest = buildEnabledModulesFromSession({
      bearerToken: getSessionToken(),
      apiResponse: {
        enabledModules: res.data?.enabledModules,
        modules: res.data?.modules,
        company: {
          enabledModules: res.data?.enabledModules,
          modules: res.data?.modules,
        },
      },
    });
    setEnabledModules(latest.normalized);
    persistEnabledModuleState(latest.normalized, latest.enabledKeys);
    return latest.normalized;
  }, []);

  /**
   * Checks the user's authentication status with the HRMS server.
   */
  const checkAuth = useCallback(async () => {
    if (checkAuthInProgress.current) return;
    checkAuthInProgress.current = true;
    setLoading(true);
    
    // Preserve normal token handoff links, but do not launch or require SSO.
    const tokenFromUrl = consumeTokenFromUrl();
    const storedToken = tokenFromUrl || getSessionToken();
    const hasActiveToken = !!storedToken;
    const skipCookieRestore = !hasActiveToken && hasRecentManualLogoutMark();
    const currentPath = String(window.location.pathname || "").toLowerCase();
    const isSsoEntryPath = [
      "/",
      "/login",
      "/tenant/login",
      "/login/hr",
      "/login/employee",
      "/employee/login",
      "/sso-redirect",
    ].includes(currentPath);

    try {
      if (skipCookieRestore) {
        console.log("[HRMS] Skipping session restore because a recent manual logout was detected.");
        setUser(null);
        setEnabledModules(null);
        setIsInitialized(true);
        return;
      }

      if (!hasActiveToken) {
        console.log("[HRMS] No local token found, enforcing login screen on new browser session.");
        setUser(null);
        setEnabledModules(null);
        setError(null);
        setAccessDenied(false);
        setIsInitialized(true);
        return;
      }

      // Hard refresh resets in-memory axios defaults, so re-apply the stored token
      // before the first auth probe.
      applyAuthHeader(storedToken);
      
      const primaryEndpoint = "/auth/me";

      console.log(`[HRMS] Verifying session with backend (Primary: ${primaryEndpoint})...`);

      let hrmsSessionRes = null;
      let lastSessionError = null;
      
      try {
        hrmsSessionRes = await hrmsApi.get(primaryEndpoint, { _silent: true });
      } catch (err) {
        lastSessionError = err;
        hrmsSessionRes = null;
      }

      if (hrmsSessionRes?.data?.user) {
        applySessionFromAuthResponse(hrmsSessionRes.data);
        setError(null);
        setAccessDenied(false);
        console.log("[HRMS] Authentication successful for user:", hrmsSessionRes.data.user.email);
      } else {
        const status = lastSessionError?.response?.status;
        setUser(null);
        setEnabledModules(null);
        setError(null);
        setAccessDenied(false);
        if (!isExpectedSessionProbeFailure(lastSessionError) && status) {
          console.warn("[HRMS] No user returned from backend session check.");
        }
        // Clear rejected tokens from both URL handshakes and persisted storage so
        // the app can recover cleanly instead of bouncing with a stale session.
        if (hasActiveToken && (status === 401 || status === 403)) {
          clearSession();
        }
      }
    } catch (err) {
      console.error("[HRMS] Fatal error during auth check:", err.message);
      const status = err?.response?.status;
      setUser(null);
      setEnabledModules(null);
      if (hasActiveToken && (status === 401 || status === 403)) {
        clearSession();
      }
      
      const parsed = parseAxiosError(err);
      if (status === 403) {
        setError("Access Denied: You do not have permission to access HRMS.");
        setAccessDenied(true);
      } else if (status !== 401) {
        setError(parsed.message);
      }
    } finally {
      setLoading(false);
      setIsInitialized(true);
      checkAuthInProgress.current = false;
    }
  }, [applySessionFromAuthResponse]);

  // --- Direct login helpers (local/dev) ---
  const loginUnified = useCallback(async (identifier, password, companyCode = null) => {
    try {
      const res = await hrmsApi.post("/auth/login-unified", { 
        identifier, 
        password, 
        companyCode: companyCode?.trim() || null 
      });
      if (res.data?.user) {
        // Purge any stale artifacts from previous sessions (e.g. if user logged out and logged in as someone else)
        clearLocalSessionArtifacts();
        applySessionFromAuthResponse(res.data);
      }
      return { success: true, ...res.data };
    } catch (err) {
      const parsed = parseAxiosError(err);
      return { success: false, message: err?.response?.data?.message || parsed.message };
    }
  }, [applySessionFromAuthResponse]);

  const loginHR = useCallback(async (companyCode, email, password) => {
    try {
      const res = await hrmsApi.post("/auth/login-hr", { companyCode, email, password });
      if (res.data?.user) {
        clearLocalSessionArtifacts();
        applySessionFromAuthResponse(res.data);
      }
      return { success: true, ...res.data };
    } catch (err) {
      const parsed = parseAxiosError(err);
      return { success: false, message: err?.response?.data?.message || parsed.message };
    }
  }, [applySessionFromAuthResponse]);

  const loginEmployee = useCallback(async (companyCode, identifier, password) => {
    try {
      const res = await hrmsApi.post("/auth/login-employee", { companyCode, identifier, password });
      if (res.data?.user) {
        clearLocalSessionArtifacts();
        applySessionFromAuthResponse(res.data);
      }
      return { success: true, ...res.data };
    } catch (err) {
      const parsed = parseAxiosError(err);
      return { success: false, message: err?.response?.data?.message || parsed.message };
    }
  }, [applySessionFromAuthResponse]);

  /**
   * Redirects to the SSO portal if unauthenticated.
   */
  const redirectToLogin = useCallback(() => {
    const fallbackPath = getPreferredLoginPath({
      pathname: window.location.pathname,
      role: user?.roleName || user?.role,
    });
    window.location.href = USE_SSO_ONLY_AUTH
      ? getSsoRedirectUrl()
      : `${window.location.origin}${fallbackPath}`;
  }, [getSsoRedirectUrl, user]);

  const forceLogout = useCallback(async () => {
    try {
      setLoading(true);
      const defaultSsoTarget = getDefaultSsoTarget();
      const directLoginPath = getDirectLoginPath(
        window.location.pathname,
        user?.roleName || user?.role
      );
      const postLogoutUrl = USE_SSO_ONLY_AUTH
        ? (getSsoPortalLoginUrl() || buildSsoLoginRedirectUrl(defaultSsoTarget))
        : `${window.location.origin}${directLoginPath}`;

      await locationTrackingService.stop({
        reason: 'LOGOUT',
        trackingState: 'PAUSED',
        clearStorage: true
      }).catch(() => {});

      markManualLogout();
      clearSession();
      clearLocalSessionArtifacts();
      setUser(null);
      setEnabledModules(null);
      // SSO Redirect Logout
      if (USE_SSO_ONLY_AUTH) {
        const ssoLogoutUrl = new URL(SSO_LOGOUT_BASE_URL);
        ssoLogoutUrl.searchParams.set("redirect", postLogoutUrl);
        window.location.replace(ssoLogoutUrl.toString());
        return;
      }
      await Promise.allSettled([
        hrmsApi.post("/auth/logout"),
        USE_SSO_ONLY_AUTH
          ? fetch(SSO_LOGOUT_BASE_URL, {
            method: "POST",
            credentials: "include",
            mode: "cors",
            keepalive: true,
          })
          : Promise.resolve(),
      ]);

      try {
        window.location.replace(postLogoutUrl);
      } catch {
        window.location.href = postLogoutUrl;
      }
    } catch (err) {
      console.error("Critical logout error:", err);
      const fallbackPath = getPreferredLoginPath({
        pathname: window.location.pathname,
        role: user?.roleName || user?.role,
      });
      window.location.href = USE_SSO_ONLY_AUTH
        ? (getSsoPortalLoginUrl() || buildSsoLoginRedirectUrl(getDefaultSsoTarget()))
        : `${window.location.origin}${fallbackPath}`;
    }
  }, [getDefaultSsoTarget, user]);

  /**
   * Logout handler with pending tasks validation.
   */
  const logout = useCallback(async () => {
    // Always logout immediately (do not block logout based on tasks)
    return forceLogout();
  }, [forceLogout]);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for global 401 events from the Axios interceptor
  useEffect(() => {
    const handleUnauthorized = (event) => {
      // Ignore background/silent 401s to prevent interrupting the user session
      if (event?.detail?._silent) {
        console.warn("[AUTH] Background unauthorized event ignored.");
        return;
      }

      locationTrackingService.resetRuntime(true);
      setUser(null);
      setEnabledModules(null);
      // ProtectedRoute will handle the smooth redirect to /login via React Router.
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    if (user) {
      const trackingRole =
        user?.roleName || (typeof user?.role === "object" ? user?.role?.name : user?.role) || "";
      if (isEmployeeLikeRole(trackingRole)) {
        locationTrackingService.resumeIfNeeded({
          role: trackingRole,
          userId: user?.id || user?._id || "",
        }).catch(() => {});
        return;
      }

      locationTrackingService.resetRuntime(true);
      return;
    }

    locationTrackingService.resetRuntime(false);
  }, [user]);

  /**
   * Returns the dashboard route based on the user's role.
   */
  const getRouteByRole = useCallback((role) => {
    const r = String(role || "").toLowerCase();
    
    // 1. PSA / Super Admin (Product Owner)
    if (["psa", "super_admin", "superadmin"].includes(r)) {
      return "/psa";
    }

    // 2. HR / Company Admin (Tenant Owner)
    if (["admin", "hr", "company_admin", "owner", "company", "company_super_admin", "sub_company_admin", "branch_head", "division_head", "department_head", "designation_head"].includes(r)) {
      return "/hr";
    }

    // 3. Employee / Staff
    return "/employee";
  }, []);

  const hasModule = useCallback(
    (moduleCodeOrLabel) => {
      const key = normalizeModuleCode(moduleCodeOrLabel);
      if (!key) return false;
      const r = String(
        user?.roleName ||
          (user?.role && typeof user.role === "object" ? user.role.name : user?.role) ||
          ""
      ).toLowerCase();
      if (["psa", "super_admin", "superadmin"].includes(r)) return true;
      return enabledModules?.[key] === true;
    },
    [enabledModules, user]
  );

  // Memoize context value for compatibility and performance
  const value = useMemo(() => ({
    user,
    enabledModules,
    hasModule,
    loading,
    authLoading: loading, // Compatibility alias
    isLoading: loading,   // Some pages use this name
    isInitialized,
    authError: error,     // Compatibility alias
    error,
    accessDenied,
    isAuthenticated: !!user,
    logout,
    checkAuth,
    refreshEnabledModules,
    refreshUser: checkAuth, // Compatibility alias
    redirectToLogin,
    loginUnified,
    loginHR,
    loginEmployee,
    getLocalLoginRoute: () => {
      return getPreferredLoginPath({
        pathname: window.location.pathname,
        role: user?.roleName || user?.role,
      });
    },
    getRouteByRole
  }), [user, enabledModules, hasModule, loading, isInitialized, error, accessDenied, logout, checkAuth, refreshEnabledModules, redirectToLogin, loginUnified, loginHR, loginEmployee, getRouteByRole]);

  return (
    <AuthContext.Provider value={value}>
      {isInitialized ? children : (
        <Loader
          fullPage
          title="Authenticating..."
          subtitle="Establishing secure connection with HRMS server."
          hint="Validating session, syncing permissions, and preparing your workspace."
        />
      )}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

import axios from "axios";
import { getToken } from "./token";
import GitakshmiLogo from "../assets/gitakshmi-hr-logo.svg";

import APP_CONFIG from "./appConfig";

export const SSO_API_ROOT = APP_CONFIG.SSO_API_ROOT || '';
export const SSO_LOGIN_URL = APP_CONFIG.SSO_LOGIN_URL || '';
export const SSO_PORTAL_LOGIN_URL = APP_CONFIG.SSO_PORTAL_LOGIN_URL || '';
export const HRMS_API_ROOT = APP_CONFIG.HRMS_API_ROOT;
export const API_ROOT = HRMS_API_ROOT;

const getApiOriginPrefix = () => String(API_ROOT || "").replace(/\/+$/, "");

const shouldProxyCloudinaryImage = (value) => {
  try {
    const url = new URL(String(value || "").trim(), window.location.origin);
    return (
      /^https?:$/i.test(url.protocol) &&
      url.hostname.toLowerCase() === "res.cloudinary.com" &&
      url.pathname.includes("/image/upload/")
    );
  } catch {
    return false;
  }
};

export const resolveBrowserSafeAssetUrl = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;
  if (shouldProxyCloudinaryImage(rawValue)) {
    return `${getApiOriginPrefix()}/api/assets/image-proxy?url=${encodeURIComponent(rawValue)}`;
  }
  return rawValue;
};

const isUrlLikeRedirectTarget = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return /^https?:\/\//i.test(normalized) || normalized.startsWith("/");
};

export const buildSsoLoginRedirectUrl = (redirectTarget) => {
  return '/login';
};

export const getSsoPortalLoginUrl = () => {
  return '/login';
};

/**
 * Reusable Axios instance for SSO (Auth) service (Disabled)
 */
export const ssoApi = null;

/**
 * Reusable Axios instance for HRMS service
 */
export const hrmsApi = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30000,
});

const readStoredAuthToken = () => {
  try {
    return getToken();
  } catch {
    return null;
  }
};

const shouldSkipStoredAuthHeader = (config) => {
  const rawUrl = String(config?.url || "").trim();
  if (!rawUrl) return false;

  let pathname = rawUrl.toLowerCase();
  try {
    pathname = new URL(rawUrl, window.location.origin).pathname.toLowerCase();
  } catch {
    pathname = rawUrl.toLowerCase();
  }

  const isCandidateApi =
    pathname === "/candidate" ||
    pathname.startsWith("/candidate/");

  if (!isCandidateApi) return false;

  const currentPath = String(window.location.pathname || "").toLowerCase();
  return (
    currentPath.startsWith("/candidate") ||
    currentPath.startsWith("/jobs") ||
    currentPath.startsWith("/apply-job") ||
    currentPath.startsWith("/careers")
  );
};

const attachStoredAuthHeader = (config) => {
  const headers = { ...(config.headers || {}) };

  if (!shouldSkipStoredAuthHeader(config)) {
    const token = readStoredAuthToken();
    if (token && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const tenantId = String(window.localStorage.getItem('tenantId') || window.localStorage.getItem('companyId') || window.localStorage.getItem('candidate_tenantId') || '').trim();
    const companyCode = String(window.localStorage.getItem('companyCode') || window.localStorage.getItem('candidate_company') || '').trim();
    if (tenantId && !headers['X-Tenant-ID'] && !headers['x-tenant-id']) {
      headers['X-Tenant-ID'] = tenantId;
    }
    if (companyCode && !headers['X-Company-Code'] && !headers['x-company-code']) {
      headers['X-Company-Code'] = companyCode;
    }
  } catch {
    // localStorage may be unavailable in private/security contexts.
  }

  config.headers = headers;
  return config;
};

hrmsApi.interceptors.request.use(attachStoredAuthHeader);

function isCandidatePortalRequest(config) {
  return shouldSkipStoredAuthHeader(config);
}

hrmsApi.interceptors.request.use((config) => {
  if (!isCandidatePortalRequest(config)) {
    return config;
  }

  // Candidate portal auth relies on the httpOnly candidate cookie.
  // Strip inherited HRMS bearer headers so /candidate/* endpoints do not
  // accidentally authenticate as an employee/HR session.
  const headers = { ...(config.headers || {}) };
  delete headers.Authorization;
  delete headers.authorization;
  config.headers = headers;

  return config;
});

// Response interceptor to handle unauthorized access globally (attached to both)
const unauthorizedInterceptor = (error) => {
  // If the request is marked as silent (e.g. during checkAuth fallbacks), do not trigger a global redirect.
  if (error.response?.status === 401 && !error.config?._silent) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
  return Promise.reject(error);
};

hrmsApi.interceptors.response.use((response) => response, unauthorizedInterceptor);

export const parseAxiosError = (error) => {
  if (!error) return { message: "Unknown error" };
  const data = error.response?.data || {};
  let message = data.message || data.error || error.message || 'An error occurred';

  if (!error.response) {
    const rawMessage = String(error.message || '').toLowerCase();
    if (
      rawMessage.includes('timeout') ||
      rawMessage.includes('network error') ||
      rawMessage.includes('econnrefused') ||
      rawMessage.includes('failed to fetch')
    ) {
      message =
        'Backend server unreachable. Please make sure the HRMS API server is running, then try again.';
    }
  }

  if (message === 'invalid_credentials') {
    message = 'Invalid email or password. Please try again.';
  } else if (message === 'account_deactivated') {
    message = 'Your account has been deactivated. Please contact support.';
  } else if (
    message === 'no_token' ||
    message === 'invalid_token' ||
    message === 'access_token_expired' ||
    message === 'no_refresh_token' ||
    message === 'invalid_refresh_token'
  ) {
    message = 'Session expired. Please log in again.';
  }

  return {
    message,
    status: error.response?.status,
  };
};

/**
 * Standard utility to resolve a tenant/company logo URL.
 * Handles absolute URLs, relative paths with API_ROOT, and legacy meta fields.
 */
export const resolveTenantLogoUrl = (tenant) => {
  const rawLogo = String(tenant?.logo || tenant?.meta?.logo || "").trim();
  if (!rawLogo) return GitakshmiLogo;
  if (/^(https?:)?\/\//i.test(rawLogo) || rawLogo.startsWith("data:")) {
    return resolveBrowserSafeAssetUrl(rawLogo);
  }
  return `${API_ROOT}${rawLogo.startsWith("/") ? "" : "/"}${rawLogo}`;
};

/**
 * Default export remains hrmsApi for backward compatibility with most existing calls.
 */
export default hrmsApi;

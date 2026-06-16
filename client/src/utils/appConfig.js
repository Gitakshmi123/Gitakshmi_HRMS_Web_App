/**
 * Centralized application URL configuration.
 * Change VITE_APP_BASE_URL for the normal HRMS build target.
 */

const isLocalHostname = (hostname) => {
  const h = String(hostname || '').toLowerCase();
  return (
    ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(h) ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    h.startsWith('172.') ||
    h.endsWith('.local')
  );
};

const isLocal = typeof window !== 'undefined' && isLocalHostname(window.location.hostname);
const ssoOnLocalhostEnabled =
  String(import.meta.env.VITE_SSO_ON_LOCALHOST || '').toLowerCase() === 'true';
const allowRemoteHrmsApiOnLocalhost =
  String(import.meta.env.VITE_ALLOW_REMOTE_HRMS_API_ON_LOCALHOST || '').toLowerCase() === 'true';

const stripTrailingSlash = (value = '') => String(value || '').trim().replace(/\/+$/, '');
const stripApiSuffix = (value = '') => stripTrailingSlash(value).replace(/\/api$/i, '');
const joinUrl = (base = '', path = '') => {
  const normalizedBase = stripTrailingSlash(base);
  const normalizedPath = String(path || '').trim();
  if (!normalizedBase) return normalizedPath || '';
  if (!normalizedPath) return normalizedBase;
  return `${normalizedBase}/${normalizedPath.replace(/^\/+/, '')}`;
};
const getBrowserOrigin = () => '';

const PRIMARY_APP_BASE_URL = stripApiSuffix(
  import.meta.env.VITE_APP_BASE_URL ||
  import.meta.env.VITE_BASE_URL ||
  import.meta.env.VITE_HRMS_API_ROOT ||
  import.meta.env.BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  ''
);
const EXPLICIT_SSO_BASE_URL = stripApiSuffix(import.meta.env.VITE_SSO_BASE_URL || import.meta.env.VITE_SSO_URL);
const EXPLICIT_TMS_BASE_URL = stripApiSuffix(import.meta.env.VITE_TMS_BASE_URL || import.meta.env.VITE_TMS_URL);

const LOCAL_DEFAULTS = {
  APP_BASE_URL: PRIMARY_APP_BASE_URL || 'http://localhost:5003',
};

const PRODUCTION_DEFAULTS = {
  APP_BASE_URL: PRIMARY_APP_BASE_URL || getBrowserOrigin(),
};

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const isLocalUrl = (value) => {
  if (!isAbsoluteHttpUrl(value)) return false;
  try {
    const parsed = new URL(value);
    return isLocalHostname(parsed.hostname);
  } catch {
    return false;
  }
};

const resolveLocalAwareUrl = ({
  envValue,
  localFallback,
  productionFallback,
  allowRemoteOnLocalhost = false,
}) => {
  const normalizedEnvValue = String(envValue || '').trim();

  if (!isLocal) {
    if (normalizedEnvValue && !isLocalUrl(normalizedEnvValue)) {
      return normalizedEnvValue;
    }

    if (productionFallback && !isLocalUrl(productionFallback)) {
      return productionFallback;
    }

    return getBrowserOrigin();
  }

  if (!normalizedEnvValue) {
    return localFallback;
  }

  if (allowRemoteOnLocalhost || isLocalUrl(normalizedEnvValue)) {
    return normalizedEnvValue;
  }

  return localFallback;
};

export const APP_CONFIG = {
  get APP_BASE_URL() {
    return resolveLocalAwareUrl({
      envValue: PRIMARY_APP_BASE_URL,
      localFallback: LOCAL_DEFAULTS.APP_BASE_URL,
      productionFallback: PRODUCTION_DEFAULTS.APP_BASE_URL,
      allowRemoteOnLocalhost: allowRemoteHrmsApiOnLocalhost,
    });
  },

  get HRMS_URL() {
    return this.APP_BASE_URL;
  },

  get TMS_URL() {
    return resolveLocalAwareUrl({
      envValue: EXPLICIT_TMS_BASE_URL,
      localFallback: this.APP_BASE_URL,
      productionFallback: this.APP_BASE_URL,
      allowRemoteOnLocalhost: allowRemoteHrmsApiOnLocalhost,
    });
  },
  
  get HRMS_API_ROOT() {
    return resolveLocalAwareUrl({
      envValue: stripApiSuffix(import.meta.env.VITE_HRMS_API_ROOT || import.meta.env.VITE_API_URL || PRIMARY_APP_BASE_URL),
      localFallback: this.APP_BASE_URL,
      productionFallback: this.HRMS_URL,
      allowRemoteOnLocalhost: allowRemoteHrmsApiOnLocalhost,
    });
  }
};

export const IS_LOCAL_RUNTIME = isLocal;
export const USE_SSO_ONLY_AUTH = false; // Forced to false to remove GT-ONE dependency

export function shouldUseHostedHrmsSsoHandoff() {
  return false;
}

export function getHostedHrmsSsoTarget() {
  return `${APP_CONFIG.HRMS_URL}/tenant/dashboard`;
}

export function getDirectLoginPath() {
  return '/login';
}

export function getPreferredLoginPath() {
  return '/login';
}

export default APP_CONFIG;

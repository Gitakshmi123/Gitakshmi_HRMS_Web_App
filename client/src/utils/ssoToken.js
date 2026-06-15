import api, { ssoApi, hrmsApi } from './api';
import { getToken, removeToken, setToken } from './token';

const TOKEN_PARAM_KEYS = [
  'token',
  'accessToken',
  'access_token',
  'ssoToken',
  'sso_token',
  'jwt',
  'id_token',
];

function parseHashParams(hashValue = '') {
  const hash = String(hashValue || '').replace(/^#/, '');
  if (!hash) return new URLSearchParams();
  if (hash.includes('=')) return new URLSearchParams(hash);
  return new URLSearchParams();
}

function normalizeTokenValue(rawValue = '') {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  return value.replace(/^Bearer\s+/i, '').trim();
}

export function applyAuthHeader(token) {
  if (token) {
    const header = `Bearer ${token}`;
    api.defaults.headers.common.Authorization = header;
    if (ssoApi) ssoApi.defaults.headers.common.Authorization = header;
    if (hrmsApi) hrmsApi.defaults.headers.common.Authorization = header;
    return;
  }
  
  delete api.defaults.headers.common.Authorization;
  if (ssoApi) delete ssoApi.defaults.headers.common.Authorization;
  if (hrmsApi) delete hrmsApi.defaults.headers.common.Authorization;
}

export function consumeTokenFromUrl() {
  const url = new URL(window.location.href);
  const hashParams = parseHashParams(url.hash);
  let token = '';

  for (const key of TOKEN_PARAM_KEYS) {
    const fromQuery = normalizeTokenValue(url.searchParams.get(key));
    if (fromQuery) {
      token = fromQuery;
      break;
    }
    const fromHash = normalizeTokenValue(hashParams.get(key));
    if (fromHash) {
      token = fromHash;
      break;
    }
  }

  if (!token) return null;

  console.log('[HRMS] token found in URL');
  setToken(token);
  console.log('[HRMS] token stored');
  applyAuthHeader(token);

  TOKEN_PARAM_KEYS.forEach((key) => {
    url.searchParams.delete(key);
    hashParams.delete(key);
  });

  const nextHash = hashParams.toString();
  const normalizedHash = nextHash ? `#${nextHash}` : '';
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${normalizedHash}`);
  return token;
}

export function clearSession() {
  removeToken();
  applyAuthHeader(null);
}

export function getSessionToken() {
  return getToken();
}

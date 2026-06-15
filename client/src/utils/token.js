export const HRMS_TOKEN_KEY = 'hrms_token';
const LEGACY_KEYS = ['token', 'accessToken'];
const STORAGE_SCOPES = ['sessionStorage'];

function eachStorage(callback) {
  if (typeof window === 'undefined') return;
  for (const storageName of STORAGE_SCOPES) {
    try {
      const storage = window[storageName];
      if (storage) callback(storage);
    } catch {
      // Ignore private mode / access errors and keep the other storage usable.
    }
  }
}

function readFromStorage(key) {
  let value = null;
  eachStorage((storage) => {
    if (value) return;
    const next = storage.getItem(key);
    if (next) value = next;
  });
  return value;
}

function writeToAllStorages(key, value) {
  eachStorage((storage) => {
    storage.setItem(key, value);
  });
}

function removeFromAllStorages(key) {
  eachStorage((storage) => {
    storage.removeItem(key);
  });
}

export function setToken(token) {
  if (!token) {
    removeToken();
    return;
  }

  writeToAllStorages(HRMS_TOKEN_KEY, token);
  // Keep legacy keys for backward compatibility while migrating old sessions.
  LEGACY_KEYS.forEach((k) => writeToAllStorages(k, token));
}

export function getToken() {
  const primary = readFromStorage(HRMS_TOKEN_KEY);
  if (primary) return primary;

  for (const key of LEGACY_KEYS) {
    const legacy = readFromStorage(key);
    if (legacy) {
      setToken(legacy);
      return legacy;
    }
  }
  return null;
}

export function removeToken() {
  removeFromAllStorages(HRMS_TOKEN_KEY);
  LEGACY_KEYS.forEach((k) => removeFromAllStorages(k));
}

// Basic token sanity check (not a substitute for server validation).
export function isValidToken(token) {
  if (!token) return false;
  if (typeof token !== 'string') return false;
  if (token === 'null' || token === 'undefined') return false;
  if (token.includes('.') && token.length > 20) return true;
  return token.length > 10;
}

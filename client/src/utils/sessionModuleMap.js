import { jwtDecode } from 'jwt-decode';
import { normalizeEnabledModules } from './moduleConfig';

/**
 * Client-side JWT decode for claim extraction only (not signature verification).
 * Verification is done by the API when the token is sent as Bearer / cookie.
 */
export function readJwtPayloadUnsafe(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

function pickEnabledModulesObject(src) {
  if (!src || typeof src !== 'object') return {};
  const direct = src.enabledModules;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return { ...direct };
  }
  const nested =
    src.company?.enabledModules ||
    src.tenant?.enabledModules ||
    src.organization?.enabledModules;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...nested };
  }
  return {};
}

function pickModulesArray(src) {
  if (!src || typeof src !== 'object') return [];
  if (Array.isArray(src.modules)) return src.modules.map(String);
  if (Array.isArray(src.company?.modules)) return src.company.modules.map(String);
  if (Array.isArray(src.tenant?.modules)) return src.tenant.modules.map(String);
  return [];
}

/**
 * Merges module toggles from Bearer JWT (if present) and /auth/sso/me | /auth/me response.
 * Later sources override earlier: JWT < user object < top-level API fields.
 */
export function buildEnabledModulesFromSession({ bearerToken, apiResponse }) {
  const jwtPayload = readJwtPayloadUnsafe(bearerToken);
  const data = apiResponse && typeof apiResponse === 'object' ? apiResponse : {};
  const user = data.user && typeof data.user === 'object' ? data.user : {};

  const mergedObject = {
    ...pickEnabledModulesObject(jwtPayload),
    ...pickEnabledModulesObject(user),
    ...pickEnabledModulesObject(data),
  };

  const legacyLists = [
    ...pickModulesArray(jwtPayload),
    ...pickModulesArray(user),
    ...pickModulesArray(data),
  ];

  const normalized = normalizeEnabledModules(mergedObject, legacyLists);
  const enabledKeys = Object.entries(normalized)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  return { normalized, enabledKeys, jwtPayload };
}

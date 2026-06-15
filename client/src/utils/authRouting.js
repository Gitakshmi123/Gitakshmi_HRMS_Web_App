import { SSO_LOGIN_URL } from "./api";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_LOGIN_PATHS = new Set([
  "/login",
  "/tenant/login",
  "/login/hr",
  "/login/employee",
  "/employee/login",
  "/sso-redirect",
]);

function getBrowserLocation() {
  if (typeof window === "undefined") {
    return {
      origin: "",
      pathname: "/",
      search: "",
      hostname: "",
    };
  }

  return window.location;
}

function normalizePathname(pathname) {
  const location = getBrowserLocation();

  try {
    const parsed = new URL(String(pathname || location.pathname || "/"), location.origin || "http://localhost");
    const cleaned = parsed.pathname.replace(/\/+$/, "");
    return cleaned || "/";
  } catch {
    const cleaned = String(pathname || "/")
      .trim()
      .split("?")[0]
      .replace(/\/+$/, "");
    return cleaned || "/";
  }
}

export function isSsoBypassEnabled() {
  return String(import.meta.env.VITE_SSO_BYPASS || "").toLowerCase() === "true";
}

export function isLocalDevelopmentHost(hostname = getBrowserLocation().hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return LOCAL_HOSTS.has(normalized) || normalized.endsWith(".local");
}

export function isEmployeeFacingPath(pathname = getBrowserLocation().pathname) {
  const normalized = normalizePathname(pathname);
  return (
    normalized.startsWith("/employee") ||
    normalized.startsWith("/onboarding") ||
    normalized.startsWith("/ess")
  );
}

export function getLocalLoginRoute(pathname = getBrowserLocation().pathname) {
  return isEmployeeFacingPath(pathname) ? "/employee/login" : "/login";
}

export function resolvePostLoginRedirect(
  pathname = getBrowserLocation().pathname,
  search = getBrowserLocation().search,
  origin = getBrowserLocation().origin
) {
  const normalizedPath = normalizePathname(pathname);
  const baseOrigin = String(origin || "").trim();
  const targetPath = LOCAL_LOGIN_PATHS.has(normalizedPath)
    ? "/tenant/dashboard"
    : `${normalizedPath}${search || ""}`;

  return baseOrigin ? `${baseOrigin}${targetPath}` : targetPath;
}

function isInternalLoginEndpoint(loginUrl = SSO_LOGIN_URL) {
  const location = getBrowserLocation();
  if (!location.origin) return false;

  try {
    const parsed = new URL(String(loginUrl || "").trim(), location.origin);
    return (
      parsed.origin.toLowerCase() === location.origin.toLowerCase() &&
      LOCAL_LOGIN_PATHS.has(normalizePathname(parsed.pathname))
    );
  } catch {
    return false;
  }
}

function isUrlLikeRedirectTarget(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return /^https?:\/\//i.test(normalized) || normalized.startsWith("/");
}

export function shouldUseSsoAuth() {
  return false;
}

export function buildSsoLoginUrl(
  redirectTarget = resolvePostLoginRedirect(),
  loginUrl = SSO_LOGIN_URL
) {
  const location = getBrowserLocation();
  const baseLoginUrl = String(loginUrl || "").trim();

  if (!baseLoginUrl) {
    return getLocalLoginRoute();
  }

  try {
    const parsed = new URL(baseLoginUrl, location.origin || undefined);
    const configuredRedirect = String(parsed.searchParams.get("redirect") || "").trim();

    // Preserve GT One app aliases such as `redirect=hrms`.
    // Those are not callback URLs and GT One rejects us if we overwrite them.
    if (configuredRedirect && !isUrlLikeRedirectTarget(configuredRedirect)) {
      return parsed.toString();
    }

    parsed.searchParams.set("redirect", redirectTarget);
    return parsed.toString();
  } catch {
    const separator = baseLoginUrl.includes("?") ? "&" : "?";
    return `${baseLoginUrl}${separator}redirect=${encodeURIComponent(redirectTarget)}`;
  }
}

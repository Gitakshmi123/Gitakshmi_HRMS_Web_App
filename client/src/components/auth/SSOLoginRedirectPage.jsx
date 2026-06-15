import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';
import { getSessionToken } from '../../utils/ssoToken';
import { 
  getDirectLoginPath, 
  getHostedHrmsSsoTarget, 
  shouldUseHostedHrmsSsoHandoff, 
  USE_SSO_ONLY_AUTH 
} from '../../utils/appConfig';
import { buildSsoLoginRedirectUrl } from '../../utils/api';

export default function SSOLoginRedirectPage() {
  const { user, isInitialized, getRouteByRole, checkAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showRetry, setShowRetry] = React.useState(false);
  const [isRestoringStoredSession, setIsRestoringStoredSession] = React.useState(false);
  const hasRetriedStoredSessionRef = React.useRef(false);

  const hasSsoTokenInCurrentUrl = React.useMemo(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(String(url.hash || '').replace(/^#/, ''));
    const tokenKeys = ['token', 'accessToken', 'access_token', 'ssoToken', 'sso_token', 'jwt', 'id_token'];
    return tokenKeys.some((key) => {
      const fromQuery = String(url.searchParams.get(key) || '').trim();
      const fromHash = String(hashParams.get(key) || '').trim();
      return Boolean(fromQuery || fromHash);
    });
  }, []);

  // Decide where to go after successful login
  const currentPath = String(window.location.pathname || "").toLowerCase();
  const resumeUrl = React.useMemo(() => {
    const from = location.state?.from;
    const pathname = String(from?.pathname || "").trim();
    if (!pathname || pathname.toLowerCase() === "/sso-redirect") {
      return "";
    }

    const search = String(from?.search || "");
    const hash = String(from?.hash || "");
    return `${window.location.origin}${pathname}${search}${hash}`;
  }, [location.state]);

  const redirectTarget = [
    "/login",
    "/tenant/login",
    "/login/hr",
    "/login/employee",
    "/employee/login",
    "/sso-redirect"
  ].includes(currentPath)
    ? (resumeUrl || `${window.location.origin}/tenant/dashboard`)
    : window.location.href;

  const finalSsoUrl = buildSsoLoginRedirectUrl(redirectTarget);
  const hostedHrmsTarget = React.useMemo(() => {
    const fallbackTarget = getHostedHrmsSsoTarget();
    if (!resumeUrl) {
      return fallbackTarget;
    }

    try {
      const hostedUrl = new URL(fallbackTarget);
      const resumeTarget = new URL(resumeUrl);
      hostedUrl.pathname = resumeTarget.pathname;
      hostedUrl.search = resumeTarget.search;
      hostedUrl.hash = resumeTarget.hash;
      return hostedUrl.toString();
    } catch {
      return fallbackTarget;
    }
  }, [resumeUrl]);

  const isHandoffLoop = React.useMemo(() => {
    try {
      const target = new URL(hostedHrmsTarget);
      return target.origin === window.location.origin;
    } catch {
      return false;
    }
  }, [hostedHrmsTarget]);

  // Automatic redirect logic
  React.useEffect(() => {
    const hasStoredToken = Boolean(getSessionToken());

    if (shouldUseHostedHrmsSsoHandoff() && !hasSsoTokenInCurrentUrl && !hasStoredToken && !isHandoffLoop) {
      console.log("[SSO] Localhost SSO handoff enabled, forwarding to hosted HRMS...");
      try {
        window.location.replace(hostedHrmsTarget);
      } catch {
        window.location.href = hostedHrmsTarget;
      }
      return;
    }

    if (!USE_SSO_ONLY_AUTH) {
      navigate(getDirectLoginPath(window.location.pathname), { replace: true });
      return;
    }

    // 1. If already logged in, go to dashboard
    if (isInitialized && user) {
      const target = getRouteByRole(user?.roleName || user?.role);
      console.log("[SSO] User already authenticated, redirecting to:", target);
      navigate(target, { replace: true });
      return;
    }
    
    // 2. If we still have a token in URL/storage, give AuthContext one more chance
    // to hydrate the session before bouncing back to GT ONE.
    if (isInitialized && !user && (hasSsoTokenInCurrentUrl || hasStoredToken) && !hasRetriedStoredSessionRef.current) {
      hasRetriedStoredSessionRef.current = true;
      setIsRestoringStoredSession(true);
      console.log("[SSO] Token detected, retrying HRMS session restore before redirecting to GT One...");
      void checkAuth().finally(() => {
        setIsRestoringStoredSession(false);
      });
      return;
    }

    // 3. If initialization finished and there is no valid recoverable token/session, go to GT One.
    if (isInitialized && !user && !hasSsoTokenInCurrentUrl && !hasStoredToken && !isRestoringStoredSession) {
      console.log("[SSO] No session found, redirecting to GT One login portal...");
      try {
        window.location.replace(finalSsoUrl);
      } catch {
        window.location.href = finalSsoUrl;
      }
    }

    // 4. Show retry button after 5 seconds if still "loading"
    const timer = setTimeout(() => {
      if (!isInitialized || ((hasSsoTokenInCurrentUrl || hasStoredToken) && !user)) {
        setShowRetry(true);
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [isHandoffLoop, isInitialized, user, finalSsoUrl, navigate, getRouteByRole, hasSsoTokenInCurrentUrl, checkAuth, hostedHrmsTarget, isRestoringStoredSession]);

  if (!USE_SSO_ONLY_AUTH) {
    return null;
  }

  return (
    <Loader
      fullPage
      title={user ? 'Redirecting...' : 'Securing Connection'}
      subtitle={
        user
          ? 'Establishing your authenticated session.'
          : isRestoringStoredSession
            ? 'Restoring your HRMS session from the GT One token.'
            : 'Verifying your GT One credentials. This should only take a moment.'
      }
      hint="Connecting your account, checking access, and opening the right workspace."
      footer={
        showRetry ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-center">
            <p className="text-sm font-medium text-amber-900">Taking longer than expected?</p>
            <p className="mt-1 text-xs leading-5 text-amber-700">
              You can return to the login portal and restart the secure handoff.
            </p>
            <button
              type="button"
              onClick={() => { window.location.href = finalSsoUrl; }}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Go to Login Portal
            </button>
          </div>
        ) : null
      }
    />
  );
}

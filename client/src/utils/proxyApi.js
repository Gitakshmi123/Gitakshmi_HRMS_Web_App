/**
 * proxyApi.js
 * ─────────────────────────────────────────────────────────────────
 * Dedicated axios instance for the API Proxy Layer.
 *
 * ALL frontend calls for employees / onboarding / payroll should
 * use this instance instead of the raw `api` client.
 *
 * Why a separate instance?
 *   • Keeps proxy traffic isolated from general API traffic in logs
 *   • Allows proxy-specific timeout / retry tuning independent of
 *     the main `api` instance
 *   • Makes it trivial to swap the proxy base-path in one place
 *
 * Architecture
 *   Browser → /api/proxy/... → Express Proxy Layer → Internal Service
 *
 * The real internal service URL is hidden inside the server —
 * the browser only ever sees /api/proxy/*.
 * ─────────────────────────────────────────────────────────────────
 */

import axios from 'axios';

/* ── Base path – NEVER point directly at /api/employee etc. ────── */
const PROXY_BASE_PATH = '/api/proxy';

const proxyApi = axios.create({
    baseURL: PROXY_BASE_PATH,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
    /**
     * withCredentials: true
     *   Required so the HttpOnly cookie carrying the JWT is sent with
     *   every cross-site or same-origin proxy request automatically —
     *   the frontend never touches the raw token.
     */
    withCredentials: true,
});

/* ─────────────────────────────────────────────────────────────────
   Request interceptor
   ─────────────────────────────────────────────────────────────────
   Marks every request as a proxy call so server logs can identify
   it.  The JWT is handled automatically via the cookie; we do NOT
   manually attach Authorization headers here (that's the server's
   job inside proxy.middleware.js).
   ───────────────────────────────────────────────────────────────── */
proxyApi.interceptors.request.use(
    (config) => {
        config.headers['X-Requested-Via'] = 'hrms-proxy-client';
        return config;
    },
    (error) => Promise.reject(error)
);

/* ─────────────────────────────────────────────────────────────────
   Response interceptor
   ─────────────────────────────────────────────────────────────────
   Re-uses the same session-expiry / refresh logic as the main `api`
   instance so the UX is consistent across proxy and direct calls.
   ───────────────────────────────────────────────────────────────── */

let _refreshPromise = null;

async function _refreshSession() {
    if (!_refreshPromise) {
        _refreshPromise = axios
            .post('/api/auth/refresh-token', null, { withCredentials: true })
            .finally(() => {
                _refreshPromise = null;
            });
    }
    return _refreshPromise;
}

function _getLoginRoute() {
    return '/login';
}

proxyApi.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config || {};
        const status = error.response?.status;

        /* Auto-refresh on 401 (once per request) */
        if (status === 401 && !originalRequest._proxyRetry) {
            originalRequest._proxyRetry = true;

            try {
                await _refreshSession();
                return proxyApi(originalRequest);
            } catch {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('auth:unauthorized'));

                    const pathname = window.location.pathname.toLowerCase();
                    if (!pathname.includes('/login')) {
                        setTimeout(() => {
                            window.location.href = _getLoginRoute();
                        }, 500);
                    }
                }
            }
        }

        return Promise.reject(error);
    }
);

export default proxyApi;

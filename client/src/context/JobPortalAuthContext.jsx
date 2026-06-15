/* eslint-disable react-refresh/only-export-components */
/**
 * JobPortalAuthContext.jsx
 * COMPLETELY ISOLATED from HRMS AuthContext
 * Used ONLY for Job Portal (candidate login/signup)
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback
} from 'react';
import api from '../utils/api';
import { getToken, removeToken } from '../utils/token';
import { jwtDecode } from 'jwt-decode';

export const JobPortalAuthContext = createContext(null);

export const useJobPortalAuth = () => {
  const context = useContext(JobPortalAuthContext);
  if (!context) {
    throw new Error(
      'useJobPortalAuth must be used within JobPortalAuthProvider'
    );
  }
  return context;
};

function getLegacyCandidateToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = jwtDecode(token);
    const tokenRole = String(payload?.role || '').toLowerCase();
    return tokenRole === 'candidate' ? token : null;
  } catch {
    return null;
  }
}

export function JobPortalAuthProvider({ children }) {
  const [candidate, setCandidate] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // --------------------------------------------
  // Initialize authentication on mount
  // --------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const currentPath = String(window.location.pathname || '');
    const isPublicJobsPath = currentPath.startsWith('/jobs/');
    const isCandidateAuthPath =
      currentPath === '/candidate/login' ||
      currentPath === '/candidate/signup';

    const initializeJobPortalAuth = async () => {
      let tokenIsCandidate = false;
      try {
        const token = getLegacyCandidateToken();
        const cachedCandidateStr = localStorage.getItem('candidate');
        
        // Strict Guard: If we are on a public jobs page and have absolutely no 
        // evidence of a candidate session, do not even attempt a probe.
        // This stops the noisy 401 errors in the console.
        if (isPublicJobsPath && !token && !cachedCandidateStr) {
           if (isMounted) {
             setCandidate(null);
             setIsInitialized(true);
           }
           return;
        }

        // On login/signup pages, if no token, skip the probe.
        if (isCandidateAuthPath && !token) {
          if (isMounted) {
            setCandidate(null);
            setIsInitialized(true);
          }
          return;
        }

        // If we have cached data, we'll try to verify it, but silently.
        try {
          // Primary session: server sets httpOnly `candidateAccessToken` on login.
          const meRes = await api.get('/candidate/me', { _silent: true });
          if (meRes.data?.success && meRes.data?.candidate) {
            const updatedInfo = {
              ...meRes.data.candidate,
              role: 'candidate'
            };
            if (isMounted) {
              setCandidate(updatedInfo);
              localStorage.setItem('candidate', JSON.stringify(updatedInfo));
            }
            return;
          }
        } catch {
          // If we are on a public page and the probe fails, just stop here.
          if (isPublicJobsPath || isCandidateAuthPath) {
             if (isMounted) setIsInitialized(true);
             return;
          }
        }

        // Fallback to legacy token logic if cookie probe failed or was skipped
        if (!token) {
          if (isMounted) {
            setCandidate(null);
            localStorage.removeItem('candidate');
          }
          return;
        }

        let payload;
        try {
          payload = jwtDecode(token);
        } catch {
          throw new Error('Invalid JWT token');
        }

        const tokenRole = String(payload?.role || '').toLowerCase();
        tokenIsCandidate = tokenRole === 'candidate';

        if (!tokenIsCandidate) {
          if (isMounted) {
            setCandidate(null);
          }
          return;
        }

        // Final sync with backend if we have a token but no verified session yet
        try {
          const res = await api.get('/candidate/me', { _silent: true });
          if (res.data?.success && res.data?.candidate) {
            const updatedInfo = {
              ...res.data.candidate,
              role: 'candidate'
            };

            if (isMounted) {
              setCandidate(updatedInfo);
              localStorage.setItem('candidate', JSON.stringify(updatedInfo));
            }
          }
        } catch (apiErr) {
          if (apiErr.response?.status === 401) {
            removeToken();
            localStorage.removeItem('candidate');
            if (isMounted) setCandidate(null);
          }
        }
      } catch {
        console.warn('[JobPortalAuth] Init failure handled silently');
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    initializeJobPortalAuth();

    const handleUnauthorized = () => {
      localStorage.removeItem('candidate');
      if (isMounted) {
        setCandidate(null);
      }
    };

    window.addEventListener('candidate:unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener('candidate:unauthorized', handleUnauthorized);
    };
  }, []);

  // --------------------------------------------
  // Login
  // --------------------------------------------
  const loginCandidate = useCallback(async (tenantId, email, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.post('/candidate/login', {
        tenantId,
        email,
        password
      });
      const resolvedTenantId = String(
        res.data?.candidate?.tenantId ?? tenantId ?? ''
      ).trim();

      const candidateData = {
        ...res.data.candidate,
        role: 'candidate',
        tenantId: resolvedTenantId || String(tenantId).trim()
      };

      localStorage.setItem('candidate', JSON.stringify(candidateData));
      setCandidate(candidateData);

      return { success: true, candidate: candidateData };
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Login failed';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------------------------------------------
  // Registration
  // --------------------------------------------
  const registerCandidate = useCallback(async (data) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.post('/candidate/register', data);
      return { success: true, ...res.data };
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Registration failed';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------------------------------------------
  // Logout
  // --------------------------------------------
  const logoutCandidate = useCallback(() => {
    api.post('/candidate/logout', {}, { _silent: true }).catch(() => {});
    localStorage.removeItem('candidate');
    setCandidate(null);
  }, []);

  // --------------------------------------------
  // Refresh candidate profile
  // --------------------------------------------
  const refreshCandidate = useCallback(async () => {
    if (!candidate || candidate.role !== 'candidate') return;

    try {
      const res = await api.get('/candidate/me', { _silent: true });
      if (res.data?.success) {
        const updatedInfo = {
          ...candidate,
          ...res.data.candidate
        };
        setCandidate(updatedInfo);
        localStorage.setItem(
          'candidate',
          JSON.stringify(updatedInfo)
        );
      }
    } catch (err) {
      console.warn('[JobPortalAuth] Refresh failed:', err.message);
    }
  }, [candidate]);

  const value = {
    candidate,
    isInitialized,
    isLoading,
    error,
    loginCandidate,
    registerCandidate,
    logoutCandidate,
    refreshCandidate
  };

  return (
    <JobPortalAuthContext.Provider value={value}>
      {children}
    </JobPortalAuthContext.Provider>
  );
}

export default JobPortalAuthProvider;

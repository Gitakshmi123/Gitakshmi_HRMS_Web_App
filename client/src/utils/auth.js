export const TOKEN_KEY = 'token';
export const CANDIDATE_KEY = 'candidate';
export const TENANT_KEY = 'tenantId';

// Isolated candidate portal keys
export const CANDIDATE_TENANT_KEY = 'candidate_tenantId';
export const CANDIDATE_COMPANY_KEY = 'candidate_company';

export function getToken() {
  return null;
}

export function setToken() {
  // HRMS auth tokens are cookie-only and intentionally inaccessible to JavaScript.
}

export function removeAuth() {
  localStorage.removeItem(CANDIDATE_KEY);
  localStorage.removeItem(CANDIDATE_TENANT_KEY);
  localStorage.removeItem(CANDIDATE_COMPANY_KEY);
}

export function isTokenValid() {
  return false;
}

export function getCandidate() {
  const candidateStr = localStorage.getItem(CANDIDATE_KEY);
  if (!candidateStr) return null;

  try {
    return JSON.parse(candidateStr);
  } catch {
    return null;
  }
}

export function isCandidateLoggedIn() {
  return Boolean(getCandidate());
}

export function logoutCandidate() {
  removeAuth();
}

export function isValidId(id) {
  if (!id) return false;
  const s = String(id);
  return s !== 'null' && s !== 'undefined' && s !== '[object Object]' && s.trim() !== '';
}

export function cleanId(id) {
  if (!id) return null;
  if (typeof id === 'object') return id._id || id.id || null;
  const s = String(id);
  return isValidId(s) ? s : null;
}

export function getTenantId() {
  const tid = localStorage.getItem(TENANT_KEY);
  return isValidId(tid) ? tid : null;
}

export function setTenantId(id) {
  const cid = cleanId(id);
  if (cid) {
    localStorage.setItem(TENANT_KEY, cid);
    localStorage.setItem('companyId', cid);
  }
}

export function getCompany() {
  const companyStr = localStorage.getItem('company');
  try {
    return companyStr ? JSON.parse(companyStr) : null;
  } catch {
    return null;
  }
}

export function setCompany(company) {
  if (company) {
    localStorage.setItem('company', JSON.stringify(company));
    if (company.tenantId || company._id) {
      setTenantId(company.tenantId || company._id);
    }
    if (company.code) {
      localStorage.setItem('companyCode', company.code);
    }
  }
}

// Candidate portal specific helpers
export function getCandidateTenantId() {
  const tid = localStorage.getItem(CANDIDATE_TENANT_KEY);
  return isValidId(tid) ? tid : null;
}

export function setCandidateTenantId(id) {
  const cid = cleanId(id);
  if (cid) {
    localStorage.setItem(CANDIDATE_TENANT_KEY, cid);
  }
}

export function getCandidateCompany() {
  const companyStr = localStorage.getItem(CANDIDATE_COMPANY_KEY);
  try {
    return companyStr ? JSON.parse(companyStr) : null;
  } catch {
    return null;
  }
}

export function setCandidateCompany(company) {
  if (company) {
    localStorage.setItem(CANDIDATE_COMPANY_KEY, JSON.stringify(company));
    if (company.tenantId || company._id) {
      setCandidateTenantId(company.tenantId || company._id);
    }
  }
}

export function getUser() {
  return null;
}

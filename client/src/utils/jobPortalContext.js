import { getCompany, getTenantId } from './auth';

export function normalizePortalValue(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === 'null' || normalized === 'undefined' || normalized === '[object Object]') {
    return null;
  }
  return normalized;
}

export function extractCompanyCodeFromJobsPath(value = '') {
  const match = String(value || '').match(/\/jobs\/([^/?#]+)/i);
  return match ? normalizePortalValue(decodeURIComponent(match[1])) : null;
}

function extractCompanyCodeFromReferrer() {
  if (typeof document === 'undefined' || !document.referrer) return null;

  try {
    const referrerUrl = new URL(document.referrer);
    if (typeof window !== 'undefined' && referrerUrl.origin !== window.location.origin) {
      return null;
    }

    return extractCompanyCodeFromJobsPath(`${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`);
  } catch {
    return null;
  }
}

export function companyMatchesPortalIdentifier(company, identifier) {
  const portalIdentifier = normalizePortalValue(identifier);
  if (!company || !portalIdentifier) return false;

  return [
    normalizePortalValue(company.tenantId),
    normalizePortalValue(company._id),
    normalizePortalValue(company.code),
  ].includes(portalIdentifier);
}

export function getJobPortalIdentifier(searchParams) {
  const queryIdentifier = normalizePortalValue(searchParams?.get('tenantId'));
  if (queryIdentifier) return queryIdentifier;

  const directCompanyCode =
    normalizePortalValue(searchParams?.get('companyCode')) ||
    extractCompanyCodeFromJobsPath(searchParams?.get('redirect')) ||
    extractCompanyCodeFromReferrer();

  if (directCompanyCode) return directCompanyCode;

  const storedCompany = getCompany();

  return (
    normalizePortalValue(storedCompany?.code) ||
    normalizePortalValue(localStorage.getItem('companyCode')) ||
    normalizePortalValue(getTenantId()) ||
    null
  );
}

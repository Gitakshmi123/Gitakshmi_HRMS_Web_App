import { resolveApiOrigin } from './runtimeAssets';

export function extractEmployeeProfilePayload(responseData) {
  if (!responseData || typeof responseData !== 'object') {
    return responseData || null;
  }

  if (responseData.success === true && Object.prototype.hasOwnProperty.call(responseData, 'data')) {
    return responseData.data || null;
  }

  return responseData.data || responseData;
}

export function resolveEmployeeProfileImageUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  const apiOrigin = resolveApiOrigin();
  if (!apiOrigin) {
    return raw;
  }

  return `${apiOrigin}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export function getEmployeeProfileImage(profile = null, user = null) {
  const candidates = [
    profile?.profilePic,
    profile?.profilePicture,
    profile?.avatar,
    profile?.avatarUrl,
    profile?.photo,
    profile?.image,
    profile?.employee?.profilePic,
    user?.profilePic,
    user?.profilePicture,
    user?.avatar,
    user?.avatarUrl,
    user?.photo,
    user?.image
  ];

  for (const candidate of candidates) {
    const resolved = resolveEmployeeProfileImageUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return '';
}

export function isEmployeePendingActivation(profile) {
  if (!profile || typeof profile !== 'object') {
    return false;
  }

  const status = String(profile.status || '').trim().toUpperCase();

  return (
    profile?.meta?.onboardingDraft === true ||
    ['SUBMITTED', 'PENDING', 'DRAFT', 'NOT_STARTED'].includes(status) ||
    (status !== 'ACTIVE' && profile.isActive === false)
  );
}

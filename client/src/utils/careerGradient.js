export const DEFAULT_CAREER_GRADIENT = {
  from: '#4F46E5',
  via: '#9333EA',
  to: '#EC4899',
};

export function parseCareerGradientValue(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return { ...DEFAULT_CAREER_GRADIENT };
  }

  const legacyFrom = normalized.match(/from-\[([^\]]+)\]/)?.[1];
  const legacyVia = normalized.match(/via-\[([^\]]+)\]/)?.[1];
  const legacyTo = normalized.match(/to-\[([^\]]+)\]/)?.[1];

  if (legacyFrom || legacyVia || legacyTo) {
    return {
      from: legacyFrom || DEFAULT_CAREER_GRADIENT.from,
      via: legacyVia || DEFAULT_CAREER_GRADIENT.via,
      to: legacyTo || DEFAULT_CAREER_GRADIENT.to,
    };
  }

  const hexColors = normalized.match(/#[0-9a-fA-F]{3,8}/g);
  if (hexColors?.length >= 2) {
    return {
      from: hexColors[0] || DEFAULT_CAREER_GRADIENT.from,
      via: hexColors[1] || hexColors[0] || DEFAULT_CAREER_GRADIENT.via,
      to: hexColors[2] || hexColors[hexColors.length - 1] || DEFAULT_CAREER_GRADIENT.to,
    };
  }

  return { ...DEFAULT_CAREER_GRADIENT };
}

export function buildCareerGradientValue({
  from = DEFAULT_CAREER_GRADIENT.from,
  via = DEFAULT_CAREER_GRADIENT.via,
  to = DEFAULT_CAREER_GRADIENT.to,
} = {}) {
  return `linear-gradient(90deg, ${from}, ${via}, ${to})`;
}

export function resolveCareerGradientBackground(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return buildCareerGradientValue(DEFAULT_CAREER_GRADIENT);
  }

  if (normalized.startsWith('linear-gradient(')) {
    return normalized;
  }

  const legacyFrom = normalized.match(/from-\[([^\]]+)\]/)?.[1];
  const legacyVia = normalized.match(/via-\[([^\]]+)\]/)?.[1];
  const legacyTo = normalized.match(/to-\[([^\]]+)\]/)?.[1];

  if (legacyFrom || legacyTo) {
    return buildCareerGradientValue({
      from: legacyFrom || DEFAULT_CAREER_GRADIENT.from,
      via: legacyVia || DEFAULT_CAREER_GRADIENT.via,
      to: legacyTo || DEFAULT_CAREER_GRADIENT.to,
    });
  }

  return '';
}

/**
 * Design Tokens - Master source of truth for HR Dashboard design system
 * Used across all HR pages to maintain visual consistency
 */

export const COLORS = {
  // Brand
  brand: '#6366f1',
  brandLight: '#eef2ff',
  brandDark: '#4f46e5',

  // Accents
  accent: '#0ea5e9',
  accentLight: '#e0f2fe',

  // Semantic
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',

  // Extended Palette
  violet: '#8b5cf6',
  violetLight: '#ede9fe',
  orange: '#f97316',
  orangeLight: '#ffedd5',

  // Surfaces & Neutrals
  bg: '#f5f7ff',
  surface: '#ffffff',
  border: '#e8edf5',
  borderLight: '#f1f5f9',

  // Text
  text: '#0f172a',
  textMuted: '#64748b',
  textSoft: '#94a3b8',
};

export const SHADOWS = {
  sm: '0 2px 8px rgba(15,23,42,0.06)',
  md: '0 2px 16px rgba(15,23,42,0.07)',
  lg: '0 8px 24px rgba(15,23,42,0.10)',
  xl: '0 14px 36px rgba(15,23,42,0.15)',
  modal: '0 40px 100px rgba(15,23,42,0.22)',
};

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 20,
  full: 24,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  huge: 32,
};

export const CARD = {
  background: COLORS.surface,
  borderRadius: RADIUS.xl,
  border: `1px solid ${COLORS.border}`,
  boxShadow: SHADOWS.md,
  padding: `${SPACING.xl}px ${SPACING.xl}px`,
};

export const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: 600, letterSpacing: '-0.5px' },
  h2: { fontSize: 24, fontWeight: 600, letterSpacing: '-0.3px' },
  h3: { fontSize: 20, fontWeight: 500 },
  h4: { fontSize: 16, fontWeight: 500 },
  body: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  small: { fontSize: 12, fontWeight: 400, lineHeight: 1.4 },
  xs: { fontSize: 11, fontWeight: 500, lineHeight: 1.3 },
};

export const AVATAR_COLORS = [
  COLORS.brand,
  COLORS.accent,
  COLORS.success,
  COLORS.violet,
  COLORS.warning,
  COLORS.orange,
  COLORS.danger,
];

export const getAvatarColor = (name = '') => {
  const index = (name.charCodeAt(0) || 65) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

/**
 * Global CSS Animations & Utilities to inject into <style> tags
 * Copy this into any page component's <style> block if needed
 */
export const GLOBAL_STYLES = `
  * { box-sizing: border-box; }
  
  @keyframes fadeIn { 
    from { opacity: 0; transform: translateY(12px); } 
    to { opacity: 1; transform: translateY(0); } 
  }
  
  @keyframes slideUp { 
    from { opacity: 0; transform: translateY(14px); } 
    to { opacity: 1; transform: translateY(0); } 
  }
  
  @keyframes spin { 
    to { transform: rotate(360deg); } 
  }
  
  @keyframes pulse { 
    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55); } 
    70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } 
  }
  
  @keyframes modalEnter { 
    from { opacity: 0; transform: scale(0.94) translateY(12px); } 
    to { opacity: 1; transform: scale(1) translateY(0); } 
  }
  
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
`;

export default {
  COLORS,
  SHADOWS,
  RADIUS,
  SPACING,
  CARD,
  TYPOGRAPHY,
  AVATAR_COLORS,
  getAvatarColor,
  GLOBAL_STYLES,
};

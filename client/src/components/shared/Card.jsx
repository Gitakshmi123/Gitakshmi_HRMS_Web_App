import React from 'react';
import { COLORS, CARD, SHADOWS, SPACING } from '../../theme/designTokens';

/**
 * Card - Base container component for grouping content
 * Consistent styling with dashboard appearance
 */
export function Card({ children, padding = SPACING.xl, style = {} }) {
  return (
    <div
      style={{
        background: CARD.background,
        borderRadius: CARD.borderRadius,
        border: CARD.border,
        boxShadow: CARD.boxShadow,
        padding: `${padding}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * StatCard - Metric display with icon and label
 * Used for dashboard KPIs and summary stats
 */
export function StatCard({
  label,
  value,
  color = COLORS.brand,
  Icon,
  delay = 0,
  style = {},
}) {
  return (
    <div
      style={{
        ...CARD,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all .22s',
        animationDelay: `${delay}s`,
        animation: 'fadeIn .4s ease both',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = `0 14px 36px ${color}22`;
        e.currentTarget.style.borderColor = color + '45';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = CARD.boxShadow;
        e.currentTarget.style.borderColor = COLORS.border;
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg,${color},${color}55)`,
          borderRadius: '20px 20px 0 0',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: color + '10',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: color + '18',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        {Icon && <Icon size={16} color={color} />}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: COLORS.text,
          letterSpacing: '-1px',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginTop: 5,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default Card;

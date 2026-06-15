import React from 'react';

/**
 * Badge - Compact labeled pill component
 * Used for status indicators, tags, and labels
 */
export function Badge({ label, color, bg, dot = false }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 800,
        color,
        background: bg,
        padding: '4px 10px',
        borderRadius: 20,
        border: `1px solid ${color}28`,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: color,
            display: 'inline-block',
          }}
        />
      )}
      {label}
    </span>
  );
}

export default Badge;

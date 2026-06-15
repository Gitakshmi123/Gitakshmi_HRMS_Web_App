import React from 'react';
import { COLORS, AVATAR_COLORS, getAvatarColor, SPACING } from '../../theme/designTokens';

/**
 * Avatar - Displays initials in a colored circle
 * Used across employee listings, profiles, and user contexts
 */
export function Avatar({ name = '', size = 38, color }) {
  const parts = name.trim().split(' ').filter(Boolean);
  const init = ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase() || 'NA';
  const col = color || getAvatarColor(name);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: `linear-gradient(135deg, ${col}, ${col}bb)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.34),
        fontWeight: 800,
        color: '#fff',
        flexShrink: 0,
        boxShadow: `0 3px 10px ${col}30`,
      }}
    >
      {init}
    </div>
  );
}

export default Avatar;

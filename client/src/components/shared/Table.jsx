import React from 'react';
import { COLORS, CARD, SPACING } from '../../theme/designTokens';

/**
 * Table - Modernized table component with dashboard styling
 * Features: soft separators, hover highlights, sticky headers, responsive
 */
export function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  emptyIcon = '📋',
  rowStyle = {},
  onRowClick,
  renderCell,
  stickyHeader = true,
}) {
  return (
    <div
      style={{
        ...CARD,
        overflow: 'hidden',
      }}
    >
      {/* Header with metadata */}
      <div
        style={{
          padding: `${SPACING.md}px ${SPACING.lg}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: COLORS.text,
              margin: 0,
            }}
          >
            {columns.length > 0 ? 'Data Table' : 'Table'}
          </h3>
          <p
            style={{
              fontSize: 11,
              color: COLORS.textSoft,
              margin: '3px 0 0',
            }}
          >
            {data.length} record{data.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!loading && data.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: COLORS.success,
                animation: 'pulse 2s infinite',
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: COLORS.textSoft,
                fontWeight: 600,
              }}
            >
              Live data
            </span>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 800,
          }}
        >
          {/* Header Row */}
          <thead>
            <tr
              style={{
                background: COLORS.bg,
                borderBottom: `1px solid ${COLORS.border}`,
                position: stickyHeader ? 'sticky' : 'relative',
                top: 0,
                zIndex: 10,
              }}
            >
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: `${SPACING.sm}px ${SPACING.md}px`,
                    textAlign: col.align || 'left',
                    width: col.width,
                    fontSize: 10,
                    fontWeight: 800,
                    color: COLORS.textSoft,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '70px 0',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        border: `3px solid ${COLORS.border}`,
                        borderTopColor: COLORS.brand,
                        animation: 'spin .8s linear infinite',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: COLORS.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Loading records…
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '70px 0',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 40,
                      marginBottom: 12,
                    }}
                  >
                    {emptyIcon}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: COLORS.textMuted,
                    }}
                  >
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{
                    borderBottom: `1px solid ${COLORS.borderLight}`,
                    transition: 'background .12s',
                    cursor: onRowClick ? 'pointer' : 'default',
                    ...rowStyle,
                  }}
                  onClick={() => onRowClick?.(row, rowIdx)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = COLORS.brandLight;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      style={{
                        padding: `${SPACING.sm}px ${SPACING.md}px`,
                        textAlign: col.align || 'left',
                        fontSize: 13,
                        fontWeight: 500,
                        color: COLORS.text,
                      }}
                    >
                      {renderCell
                        ? renderCell(row, col.key, rowIdx, colIdx)
                        : row[col.key] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;

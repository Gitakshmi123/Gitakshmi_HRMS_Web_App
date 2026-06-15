import React from "react";

export default function TableBlock({ block, onUpdate }) {
  const { title, columns, rows, footerLabel, footerValue } = block.props;

  const updateCell = (r, c, value) => {
    const updated = [...rows];
    updated[r][c] = value;
    onUpdate({ ...block, props: { ...block.props, rows: updated } });
  };

  return (
    <div style={{ marginTop: 20 }}>
      {title && (
        <h4
          style={{
            fontWeight: "bold",
            borderBottom: "1px solid #222",
            paddingBottom: 4,
            marginBottom: 10,
          }}
        >
          {title}
        </h4>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  border: "1px solid #222",
                  padding: "6px",
                  background: "#f5f5f5",
                  fontWeight: "bold",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.isArray(rows) &&
            rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} style={{ border: "1px solid #222" }}>
                    <input
                      value={cell}
                      onChange={(e) => updateCell(r, c, e.target.value)}
                      style={{
                        width: "100%",
                        border: "none",
                        padding: "6px",
                        fontSize: "13px",
                        background: "transparent",
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
        </tbody>

        <tfoot>
          <tr>
            <td
              colSpan={columns.length - 1}
              style={{
                border: "1px solid #222",
                padding: "6px",
                fontWeight: "bold",
              }}
            >
              {footerLabel}
            </td>
            <td style={{ border: "1px solid #222", fontWeight: "bold" }}>
              {footerValue}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

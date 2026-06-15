import React from 'react';

export default function Breadcrumb({ items, onNavigate }) {
  const allItems = [{ label: 'Organization', level: 0, root: true }, ...items];
  return (
    <div className="org-breadcrumb">
      {allItems.map((item, index) => {
        const current = index === allItems.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && <span className="org-breadcrumb-separator">›</span>}
            <button
              type="button"
              className={current ? 'org-breadcrumb-current' : 'org-breadcrumb-link'}
              onClick={() => !current && onNavigate(item)}
              disabled={current}
            >
              {item.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

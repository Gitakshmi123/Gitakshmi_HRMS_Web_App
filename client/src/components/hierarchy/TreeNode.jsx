import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Folders,
  IdCard,
  LayoutGrid,
  UserCircle,
} from 'lucide-react';

const TYPE_META = {
  branch: { icon: Building2, color: '#185FA5' },
  division: { icon: LayoutGrid, color: '#1D9E75' },
  department: { icon: Folders, color: '#BA7517' },
  designation: { icon: IdCard, color: '#993556' },
  employee: { icon: UserCircle, color: '#888780' },
};

function getNodeName(node) {
  return node.name || node.title || node.companyName || `${node.firstName || ''} ${node.lastName || ''}`.trim() || node.email || 'Untitled';
}

function getNodeCode(node) {
  return node.branchCode || node.divisionCode || node.departmentCode || node.designationCode || node.employeeCode || node.employeeId || node.entityCode || node.code || '';
}

export default function TreeNode({ node, depth = 0, onSelect, selectedId, onAddChild, canAddChild }) {
  const [expanded, setExpanded] = useState(true);
  const children = Array.isArray(node.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const meta = TYPE_META[node.type] || TYPE_META.employee;
  const Icon = meta.icon;
  const selected = String(selectedId || '') === String(node._id || '');

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(node);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          paddingLeft: 12 + depth * 20,
          cursor: 'pointer',
          background: selected ? '#E6F1FB' : 'transparent',
          borderLeft: selected ? '2px solid #185FA5' : '2px solid transparent',
          minHeight: 44,
        }}
        onMouseEnter={(event) => {
          if (!selected) event.currentTarget.style.background = 'var(--color-background-secondary)';
        }}
        onMouseLeave={(event) => {
          if (!selected) event.currentTarget.style.background = 'transparent';
        }}
      >
        <button
          type="button"
          aria-label={expanded ? 'Collapse node' : 'Expand node'}
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) setExpanded((value) => !value);
          }}
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: hasChildren ? 'var(--color-text-secondary)' : 'transparent',
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: hasChildren ? 'pointer' : 'default',
          }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <Icon size={17} style={{ color: meta.color, flex: '0 0 auto' }} />

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getNodeName(node)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getNodeCode(node)}
          </div>
        </div>

        {hasChildren && (
          <span
            style={{
              minWidth: 22,
              height: 20,
              borderRadius: 10,
              background: 'var(--color-background-tertiary)',
              color: 'var(--color-text-tertiary)',
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {children.length}
          </span>
        )}

        {node.type !== 'employee' && onAddChild && (!canAddChild || canAddChild(node)) && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddChild(node);
            }}
            style={{
              border: '0.5px solid var(--color-border-tertiary)',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-secondary)',
              borderRadius: 6,
              fontSize: 12,
              padding: '3px 7px',
            }}
          >
            +
          </button>
        )}
      </div>

      {expanded && hasChildren && (
        <div style={{ borderLeft: `1px solid ${meta.color}`, marginLeft: 21 + depth * 20 }}>
          {children.map((child) => (
            <TreeNode
              key={`${child.type}-${child._id}`}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              onAddChild={onAddChild}
              canAddChild={canAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { getNodeCode, getNodeName };

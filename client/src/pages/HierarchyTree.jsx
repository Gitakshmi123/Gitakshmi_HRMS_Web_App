import React, { useMemo, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import TreeNode, { getNodeCode, getNodeName } from '../components/hierarchy/TreeNode';
import CreateNodeModal from '../components/hierarchy/CreateNodeModal';
import useHierarchyData from '../hooks/useHierarchyData';
import { useAuth } from '../context/AuthContext';

const CHILD_BY_TYPE = {
  branch: 'division',
  division: 'department',
  department: 'designation',
  designation: 'employee',
};

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function canAddBranch(role) {
  return ['SUB_COMPANY_ADMIN', 'MAIN_COMPANY_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'ADMIN'].includes(role);
}

function canAddChild(node, role) {
  if (!node || node.type === 'employee') return false;
  if (node.type === 'branch') return ['SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'MAIN_COMPANY_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPER_ADMIN', 'ADMIN'].includes(role);
  if (node.type === 'division') return !['DEPARTMENT_HEAD', 'EMPLOYEE'].includes(role);
  if (node.type === 'department') return role !== 'EMPLOYEE';
  if (node.type === 'designation') return role !== 'EMPLOYEE';
  return false;
}

function addNodeToTree(nodes, parentId, child) {
  if (!parentId) return [...nodes, child];
  return nodes.map((node) => {
    if (String(node._id) === String(parentId)) {
      return { ...node, children: [...(node.children || []), child] };
    }
    return { ...node, children: addNodeToTree(node.children || [], parentId, child) };
  });
}

function responseNode(rawNode, type) {
  return { ...(rawNode || {}), type, children: [] };
}

export default function HierarchyTree() {
  const { user } = useAuth();
  const role = normalizeRole(user?.roleName || (typeof user?.role === 'object' ? user.role?.name : user?.role));
  const { tree, setTree, loading, error } = useHierarchyData();
  const [selected, setSelected] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);

  const companyName = useMemo(() => user?.companyName || user?.company?.companyName || user?.companyCode || 'Current Company', [user]);

  if (role === 'EMPLOYEE') {
    return (
      <div style={pageStyle}>
        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <Building2 size={42} style={{ margin: '0 auto 12px', color: 'var(--color-text-tertiary)' }} />
          <div style={{ fontSize: 18, fontWeight: 500 }}>You don't have access to hierarchy management</div>
        </div>
      </div>
    );
  }

  const openAddBranch = () => {
    setModalConfig({
      type: 'branch',
      parentId: null,
      parentName: companyName,
      onSuccess: (newNode) => setTree((current) => addNodeToTree(current, null, responseNode(newNode, 'branch'))),
    });
  };

  const openAddChild = (node) => {
    const childType = CHILD_BY_TYPE[node.type];
    if (!childType || !canAddChild(node, role)) return;
    setModalConfig({
      type: childType,
      parentId: node._id,
      parentName: getNodeName(node),
      onSuccess: (newNode) => setTree((current) => addNodeToTree(current, node._id, responseNode(newNode, childType))),
    });
  };

  const detailChildType = selected ? CHILD_BY_TYPE[selected.type] : null;

  return (
    <div style={pageStyle}>
      <aside style={leftPanelStyle}>
        <header style={{ padding: 16, borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
          <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Hierarchy Tree</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>{companyName}</p>
        </header>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--color-text-tertiary)' }}>Loading hierarchy...</div>
          ) : error ? (
            <div style={{ padding: 18, fontSize: 13, color: '#B42318' }}>{error}</div>
          ) : tree.length === 0 ? (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--color-text-tertiary)' }}>No hierarchy records found.</div>
          ) : (
            tree.map((node) => (
              <TreeNode
                key={`${node.type}-${node._id}`}
                node={node}
                depth={0}
                onSelect={setSelected}
                selectedId={selected?._id}
                onAddChild={openAddChild}
                canAddChild={(targetNode) => canAddChild(targetNode, role)}
              />
            ))
          )}
        </div>

        {canAddBranch(role) && (
          <div style={{ padding: 16, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
            <button type="button" onClick={openAddBranch} style={primaryButtonStyle}>
              <Plus size={16} />
              Add Branch
            </button>
          </div>
        )}
      </aside>

      <main style={rightPanelStyle}>
        {modalConfig ? (
          <CreateNodeModal modalConfig={modalConfig} onClose={() => setModalConfig(null)} />
        ) : !selected ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <Building2 size={54} style={{ margin: '0 auto 14px', color: 'var(--color-text-tertiary)' }} />
            <div style={{ fontSize: 18, fontWeight: 500 }}>Select a node to view details</div>
          </div>
        ) : (
          <section style={detailCardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>{selected.type}</div>
                <h2 style={{ fontSize: 22, fontWeight: 500, margin: '6px 0 0' }}>{getNodeName(selected)}</h2>
              </div>
              {detailChildType && canAddChild(selected, role) && (
                <button type="button" onClick={() => openAddChild(selected)} style={smallButtonStyle}>
                  <Plus size={15} />
                  Add {detailChildType}
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginTop: 26 }}>
              <Detail label="Code" value={getNodeCode(selected) || '-'} />
              <Detail label="Head Name" value={selected.headName || selected.branchHeadName || selected.departmentHeadName || '-'} />
              <Detail label="Employee Count" value={String(selected.employeeCount || countEmployees(selected))} />
              <Detail label="Created Date" value={selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : '-'} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 5 }}>{value}</div>
    </div>
  );
}

function countEmployees(node) {
  if (!node?.children?.length) return node?.type === 'employee' ? 1 : 0;
  return node.children.reduce((sum, child) => sum + countEmployees(child), 0);
}

const pageStyle = {
  height: '100vh',
  display: 'flex',
  overflow: 'hidden',
  background: 'var(--color-background-tertiary)',
  fontFamily: 'var(--font-sans)',
  color: 'var(--color-text-primary)',
};

const leftPanelStyle = {
  width: 320,
  flex: '0 0 320px',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--color-background-primary)',
  borderRight: '0.5px solid var(--color-border-tertiary)',
};

const rightPanelStyle = {
  flex: 1,
  display: 'flex',
  padding: 24,
  overflow: 'hidden',
  background: 'var(--color-background-secondary)',
};

const detailCardStyle = {
  width: '100%',
  alignSelf: 'flex-start',
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 12,
  padding: 24,
};

const primaryButtonStyle = {
  width: '100%',
  height: 40,
  border: 0,
  borderRadius: 8,
  background: '#185FA5',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontWeight: 500,
};

const smallButtonStyle = {
  height: 36,
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 8,
  background: 'var(--color-background-primary)',
  color: '#185FA5',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '0 12px',
  fontWeight: 500,
  textTransform: 'capitalize',
};

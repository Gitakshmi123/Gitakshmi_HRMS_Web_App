import React, { useEffect, useMemo, useState } from 'react';
import { Building2, GitBranch, MapPin, Network, Users } from 'lucide-react';
import companiesService from '../../services/companiesService';

const byParent = (items, key) => items.reduce((acc, item) => {
  const parent = String(item?.[key] || 'root');
  if (!acc[parent]) acc[parent] = [];
  acc[parent].push(item);
  return acc;
}, {});

function label(item, primary, code) {
  return {
    name: item?.[primary] || item?.name || item?.companyName || 'Untitled',
    code: item?.[code] || item?.entityCode || item?.code || item?.employeeCode || item?.employeeId || ''
  };
}

function TreeNode({ icon: Icon, tone = 'slate', title, code, children }) {
  const toneMap = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-white text-slate-700'
  };

  return (
    <div className="relative pl-5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-slate-200">
      <div className={`rounded-lg border p-3 shadow-sm ${toneMap[tone]}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{title}</p>
            {code && <p className="text-[11px] font-semibold opacity-70 truncate">{code}</p>}
          </div>
        </div>
      </div>
      {children && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

export default function HierarchyTree() {
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState({
    subCompanies: [],
    branches: [],
    divisions: [],
    departments: [],
    designations: [],
    employees: []
  });

  useEffect(() => {
    let mounted = true;
    companiesService.getHierarchyTree()
      .then((res) => {
        if (mounted) setTree(res?.data || {});
      })
      .catch((err) => console.error('Failed to load hierarchy tree:', err))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const grouped = useMemo(() => ({
    branches: byParent(tree.branches || [], 'subCompanyId'),
    divisions: byParent(tree.divisions || [], 'branchId'),
    departments: byParent(tree.departments || [], 'divisionId'),
    designations: byParent(tree.designations || [], 'departmentId'),
    employees: byParent(tree.employees || [], 'designationId')
  }), [tree]);

  const renderEmployees = (designationId) => (grouped.employees[String(designationId)] || []).map((employee) => {
    const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.name || employee.email;
    return (
      <TreeNode
        key={employee._id}
        icon={Users}
        title={fullName}
        code={employee.employeeCode || employee.employeeId}
        tone="slate"
      />
    );
  });

  const renderDesignations = (departmentId) => (grouped.designations[String(departmentId)] || []).map((designation) => {
    const item = label(designation, 'title', 'designationCode');
    return (
      <TreeNode key={designation._id} icon={GitBranch} title={item.name} code={item.code} tone="rose">
        {renderEmployees(designation._id)}
      </TreeNode>
    );
  });

  const renderDepartments = (divisionId) => (grouped.departments[String(divisionId)] || []).map((department) => {
    const item = label(department, 'name', 'departmentCode');
    return (
      <TreeNode key={department._id} icon={Building2} title={item.name} code={item.code} tone="amber">
        {renderDesignations(department._id)}
      </TreeNode>
    );
  });

  const renderDivisions = (branchId) => (grouped.divisions[String(branchId)] || []).map((division) => {
    const item = label(division, 'name', 'divisionCode');
    return (
      <TreeNode key={division._id} icon={Network} title={item.name} code={item.code} tone="emerald">
        {renderDepartments(division._id)}
      </TreeNode>
    );
  });

  const renderBranches = (subCompanyId) => (grouped.branches[String(subCompanyId)] || []).map((branch) => {
    const item = label(branch, 'name', 'branchCode');
    return (
      <TreeNode key={branch._id} icon={MapPin} title={item.name} code={item.code} tone="indigo">
        {renderDivisions(branch._id)}
      </TreeNode>
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Hierarchy Tree</h1>
        <p className="text-sm text-slate-500 mt-1">Company to employee structure, filtered by your login scope.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 overflow-x-auto">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="h-9 w-9 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
          </div>
        ) : (tree.subCompanies || []).length === 0 ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-500">No hierarchy records found.</div>
        ) : (
          <div className="min-w-[720px] space-y-4">
            {(tree.subCompanies || []).map((subCompany) => {
              const item = label(subCompany, 'companyName', 'subCompanyCode');
              return (
                <TreeNode key={subCompany._id} icon={Building2} title={item.name} code={item.code} tone="indigo">
                  {renderBranches(subCompany._id)}
                </TreeNode>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

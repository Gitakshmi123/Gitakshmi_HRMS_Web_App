import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Building2, MapPin, Layers, Folder, BadgeCheck, User, UserCircle,
  ChevronRight, ChevronDown, Search, Plus, MoreVertical, 
  LayoutDashboard, Users, Clock, FileText, TrendingUp,
  X, Filter, Edit2, Trash2, Shield, Eye, EyeOff,
  Globe, Phone, Mail, Calendar, Briefcase, Activity, 
  MoreHorizontal, ChevronLeft, Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRBAC } from '../../context/RBACContext';
import orgService from '../../services/organizationService';
import api from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import clsx from 'clsx';
import EmployeeHierarchyChainPanel from '../../components/Organization/EmployeeHierarchyChainPanel';
import WorkflowSettings from '../settings/WorkflowSettings';

// --- COMPONENTS ---

const SearchHierarchy = ({ value, onChange }) => (
  <div className="sticky top-0 z-20 bg-white border-b border-gray-100 p-4">
    <div className="relative group">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
      <input 
        type="text" 
        placeholder="Search hierarchy..." 
        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-lg text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

const TreeNode = ({ node, level, onSelect, activeId, expandedNodes, toggleExpand }) => {
  const isExpanded = expandedNodes[node._id];
  const isActive = activeId === node._id;
  const hasChildren = node.hasChildren || (node.children && node.children.length > 0) || node.hierarchyType !== 'employee';

  const typeIcons = {
    main: Building2,
    subcompany: Building2,
    branch: MapPin,
    division: Layers,
    department: Folder,
    designation: BadgeCheck,
    employee: User
  };

  const Icon = typeIcons[node.hierarchyType] || Folder;

  return (
    <div className="group/node">
      <div 
        className={clsx(
          "relative flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all duration-200",
          "hover:bg-gray-50",
          isActive ? "bg-blue-50 text-blue-700 font-semibold shadow-sm" : "text-gray-600"
        )}
        style={{ marginLeft: `${level * 12}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Selected indicator */}
        {isActive && (
          <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r-full" />
        )}

        <div 
          className="w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-gray-200 rounded transition-colors"
          onClick={(e) => { e.stopPropagation(); toggleExpand(node); }}
        >
          {hasChildren && node.hierarchyType !== 'employee' ? (
            isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />
          ) : (
            <div className="w-1 h-1 rounded-full bg-gray-300" />
          )}
        </div>

        <Icon size={16} className={clsx(isActive ? "text-blue-600" : "text-gray-400")} />
        
        <span className="flex-1 text-[13px] truncate">
          {node.name || node.title || node.companyName}
        </span>

        {/* Small active dot if needed, based on data */}
        {node.isActive !== false && (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        )}
      </div>
      
      {isExpanded && node.children && (
        <div className="relative">
          {/* Connector line logic could be added here for a more "tree-like" look */}
          {node.children.map(child => (
            <TreeNode 
              key={child._id} 
              node={child} 
              level={level + 1} 
              onSelect={onSelect}
              activeId={activeId}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const OrganizationHeader = ({ node, breadcrumb, onAddNew, onEdit, onDelete, onPermissions, permissions }) => {
  if (!node) return null;
  const type = node.hierarchyType;

  return (
    <div className="flex flex-col gap-4 mb-8">
      {/* Breadcrumb path - Only show if we are deeper than root */}
      {breadcrumb.length > 1 && (
        <div className="flex items-center gap-1 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
          {breadcrumb.map((b, i) => (
            <React.Fragment key={b.id}>
              {i > 0 && <ChevronRight size={10} className="mx-1" />}
              <span className={i === breadcrumb.length - 1 ? "text-blue-600" : ""}>{b.label}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={clsx(
            "w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border-2 shadow-sm",
            type === 'employee' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
          )}>
            {String(node.name || node.title || node.companyName || 'O')[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {node.name || node.title || node.companyName}
              </h1>
              <span className={clsx(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border",
                "bg-white text-gray-500 border-gray-200"
              )}>
                {type}
              </span>
              {node.isActive !== false ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ACTIVE
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200 text-[10px] font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  INACTIVE
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              <span className="font-mono text-[12px] bg-gray-100 px-1.5 rounded text-gray-600">
                {node.entityCode || node.subCompanyCode || node.employeeCode || node.code || node.companyCode || 'System Node'}
              </span>
              {node.designationTitle && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="font-medium">{node.designationTitle}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <ActionToolbar onAddNew={onAddNew} onEdit={onEdit} onDelete={onDelete} onPermissions={onPermissions} node={node} permissions={permissions} />
      </div>
    </div>
  );
};

const ActionToolbar = ({ onAddNew, onEdit, onDelete, onPermissions, node, permissions = {} }) => {
  const isEmployee = node.hierarchyType === 'employee';
  const { canEdit, canCreate, canDelete } = permissions;
  
  const getNextTypeLabel = (currentType) => {
    const labels = {
      main: 'Sub-Company',
      subcompany: 'Branch',
      branch: 'Division',
      division: 'Department',
      department: 'Designation',
      designation: 'Employee'
    };
    return labels[currentType] || 'Unit';
  };

  return (
    <div className="flex items-center gap-3">
      {canEdit && (
        <div className="flex items-center gap-1.5 p-1 bg-white border border-gray-200 rounded-xl shadow-sm">
          <button 
            onClick={() => onEdit?.(node)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all group"
          >
            <Edit2 size={14} className="group-hover:text-blue-500" />
            <span>Edit</span>
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button 
            onClick={() => onPermissions?.(node)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all group"
          >
            <Shield size={14} className="group-hover:text-blue-500" />
            <span>Permissions</span>
          </button>
        </div>
      )}

      {!isEmployee && canCreate && (
        <button 
          onClick={onAddNew}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 border border-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95 transition-all"
        >
          <Plus size={16} strokeWidth={3} />
          <span>Add {getNextTypeLabel(node.hierarchyType)}</span>
        </button>
      )}

      {node._id !== 'root' && canDelete && (
        <button 
          onClick={() => onDelete?.(node)}
          className="p-2.5 text-red-600 bg-white border border-red-100 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all active:scale-90"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
};

const DetailItem = ({ icon: Icon, label, value, colorClass = "text-blue-500 bg-blue-50" }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-blue-100 transition-all group">
      <div className={clsx("p-2.5 rounded-lg shrink-0 transition-colors", colorClass)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</label>
        <div className="text-[14px] font-semibold text-gray-900 truncate">
          {value}
        </div>
      </div>
    </div>
  );
};

const OrganizationDetails = ({ node, parentLabel }) => {
  if (!node) return null;

  const getHeadLabel = (type) => {
    const labels = {
      main: 'Company Admin',
      subcompany: 'Sub-Company Admin',
      branch: 'Branch Head',
      division: 'Division Head',
      department: 'Department Head'
    };
    return labels[type] || 'Administrator';
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DetailItem 
          icon={UserCircle} 
          label={getHeadLabel(node.hierarchyType)} 
          value={node.headName || 'Not Assigned'} 
          colorClass="text-blue-600 bg-blue-50"
        />
        <DetailItem 
          icon={Layers} 
          label="Unit Type" 
          value={node.hierarchyType.toUpperCase()} 
          colorClass="text-purple-500 bg-purple-50"
        />
        <DetailItem 
          icon={Briefcase} 
          label="Parent Unit" 
          value={parentLabel} 
          colorClass="text-orange-500 bg-orange-50"
        />
        <DetailItem 
          icon={Mail} 
          label="Contact Email" 
          value={node.headEmail || node.contactEmail || node.email || node.adminEmail} 
          colorClass="text-emerald-500 bg-emerald-50"
        />
        <DetailItem 
          icon={Phone} 
          label="Contact Phone" 
          value={node.contactPhone || node.phone || node.contactNo} 
          colorClass="text-cyan-500 bg-cyan-50"
        />
        <DetailItem 
          icon={MapPin} 
          label="Primary Location" 
          value={node.city || node.address} 
          colorClass="text-rose-500 bg-rose-50"
        />
      </div>

      {node.children && node.children.length > 0 && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Sub-Units</h2>
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">{node.children.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {node.children.map((child) => (
              <div 
                key={child._id} 
                className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                  <Building2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{child.name || child.title || child.companyName}</h3>
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">{child.hierarchyType}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] font-mono text-blue-600 font-bold bg-blue-50 px-1.5 rounded">{child.code || child.entityCode}</span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <User size={10} />
                      {child.headName || 'No Head'}
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = () => (
  <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-fade-in">
    <div className="w-20 h-20 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-sm">
      <Building2 size={40} />
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">Select an organization unit</h3>
    <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
      Choose a department, branch, or team from the sidebar to view detailed information and manage hierarchy.
    </p>
  </div>
);
// --- MAIN PAGE ---

export default function Organization() {
  const { user } = useAuth();
  const { hasPermission } = useRBAC();
  const navigate = useNavigate();

  const orgPermKeys = ['company.subCompanies', 'people.subCompanies', 'organization.view', 'people.org'];
  const permissions = {
    canView: hasPermission(orgPermKeys, 'view') || hasPermission(orgPermKeys, 'any'),
    canCreate: hasPermission(orgPermKeys, 'create'),
    canEdit: hasPermission(orgPermKeys, 'edit'),
    canDelete: hasPermission(orgPermKeys, 'delete'),
  };
  const [treeData, setTreeData] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [formData, setFormData] = useState({ adminAssignmentType: 'new' });
  const [submitting, setSubmitting] = useState(false);
  const [potentialHeads, setPotentialHeads] = useState([]);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setFormData({ adminAssignmentType: 'new' });
    setFormError('');
    setShowPassword(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'email' && prev.adminAssignmentType === 'new') {
        if (!prev.adminEmail || prev.adminEmail === prev.email) {
          next.adminEmail = value;
        }
      }
      return next;
    });
  };

  const handleAddNew = async () => {
    if (!selectedNode) return;
    const typeMap = {
      main: 'subcompany',
      subcompany: 'branch',
      branch: 'division',
      division: 'department',
      department: 'designation',
      designation: 'employee'
    };
    const nextType = typeMap[selectedNode.hierarchyType];
    if (nextType) {
      setModalType(nextType);
      setModalOpen(true);
      if (['subcompany', 'branch', 'division', 'department'].includes(nextType)) {
        const heads = await orgService.getPotentialHeads();
        setPotentialHeads(heads?.data || []);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const payload = { ...formData };
      if (selectedNode.hierarchyType === 'subcompany') payload.subCompanyId = selectedNode._id;
      if (selectedNode.hierarchyType === 'branch') payload.branchId = selectedNode._id;
      if (selectedNode.hierarchyType === 'division') payload.divisionId = selectedNode._id;
      if (selectedNode.hierarchyType === 'department') payload.departmentId = selectedNode._id;
      if (selectedNode.hierarchyType === 'designation') payload.designationId = selectedNode._id;

      let res;
      const isEdit = formData.isEdit;

      if (isEdit) {
        const id = formData._id;
        switch(modalType) {
          case 'subcompany': res = await orgService.updateSubCompany(id, payload); break;
          case 'branch': res = await orgService.updateBranch(id, payload); break;
          case 'division': res = await orgService.updateDivision(id, payload); break;
          case 'department': res = await orgService.updateDepartment(id, payload); break;
          case 'designation': res = await orgService.updateDesignation(id, payload); break;
          case 'employee': res = await orgService.updateEmployee(id, payload); break;
          default: break;
        }
      } else {
        switch(modalType) {
          case 'subcompany': res = await orgService.createSubCompany(payload); break;
          case 'branch': res = await orgService.createBranch(payload); break;
          case 'division': res = await orgService.createDivision(payload); break;
          case 'department': res = await orgService.createDepartment(payload); break;
          case 'designation': res = await orgService.createDesignation(payload); break;
          case 'employee': res = await orgService.createEmployee(payload); break;
          default: break;
        }
      }

      if (res?.success) {
        if (isEdit) {
          // Update the node in the tree
          Object.assign(selectedNode, res.data);
          // If we updated head info, make sure it reflects
          if (res.data.headName) selectedNode.headName = res.data.headName;
          if (res.data.headEmail) selectedNode.headEmail = res.data.headEmail;
        } else {
          const newNode = { ...res.data, hierarchyType: modalType, hasChildren: modalType !== 'employee' };
          if (selectedNode.children) {
            selectedNode.children.push(newNode);
          } else {
            selectedNode.children = [newNode];
          }
          setExpandedNodes(prev => ({ ...prev, [selectedNode._id]: true }));
        }
        setTreeData([...treeData]);
        closeModal();
      }
    } catch (err) {
      setFormError(err?.response?.data?.message || err.message || 'Error creating entity');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (node) => {
    setModalType(node.hierarchyType);
    setFormData({ 
      ...node, 
      isEdit: true,
      adminName: node.headName && node.headName !== 'Not Assigned' ? node.headName : '',
      adminEmail: node.headEmail || '',
      adminAssignmentType: 'new'
    });
    setModalOpen(true);
  };

  const handlePermissions = (node) => {
    // Redirect to access management with specific scope if possible
    window.location.href = '/hr/access';
  };

  const handleDelete = async (node) => {
    if (node._id === 'root') return;
    if (!window.confirm(`Are you sure you want to delete ${node.name || node.title || node.companyName}? This will also hide all its children.`)) return;

    try {
      let res;
      switch(node.hierarchyType) {
        case 'subcompany': res = await orgService.deleteSubCompany(node._id); break;
        case 'branch': res = await orgService.deleteBranch(node._id); break;
        case 'division': res = await orgService.deleteDivision(node._id); break;
        case 'department': res = await orgService.deleteDepartment(node._id); break;
        case 'designation': res = await orgService.deleteDesignation(node._id); break;
        case 'employee': res = await orgService.deleteEmployee(node._id); break;
        default: return;
      }

      if (res?.success) {
        const removeNode = (list) => {
          for (let i = 0; i < list.length; i++) {
            if (list[i]._id === node._id) {
              list.splice(i, 1);
              return true;
            }
            if (list[i].children && removeNode(list[i].children)) return true;
          }
          return false;
        };
        const newTree = [...treeData];
        removeNode(newTree);
        setTreeData(newTree);
        setSelectedNode(newTree[0]);
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || err.message || 'Error deleting unit');
    }
  };

  const companyName = useMemo(() => {
    return user?.companyName || localStorage.getItem('companyName') || 'Gitakshmi Technologies';
  }, [user]);

  const breadcrumb = useMemo(() => {
    if (!selectedNode) return [{ id: 'root', label: companyName }];
    const path = [];
    const findPath = (nodes, targetId, currentPath) => {
      for (const node of nodes) {
        const newPath = [...currentPath, { id: node._id, label: node.name || node.title || node.companyName }];
        if (node._id === targetId) {
          path.push(...newPath);
          return true;
        }
        if (node.children && findPath(node.children, targetId, newPath)) return true;
      }
      return false;
    };
    findPath(treeData, selectedNode._id, []);
    return path.length > 0 ? path : [{ id: 'root', label: companyName }];
  }, [selectedNode, treeData, companyName]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    const query = searchQuery.toLowerCase();
    const filterNodes = (nodes) => {
      return nodes.filter(node => {
        const match = (node.name || node.title || node.companyName || '').toLowerCase().includes(query);
        if (node.children) {
          const filteredChildren = filterNodes(node.children);
          if (filteredChildren.length > 0) {
            const newNode = { ...node, children: filteredChildren };
            return true;
          }
        }
        return match;
      });
    };
    return filterNodes(JSON.parse(JSON.stringify(treeData)));
  }, [treeData, searchQuery]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const res = await orgService.getSubCompanies();
        const data = res.data || [];
        const company = user?.company || {};
        const storedCode = localStorage.getItem('companyCode');
        
        if (user?.subCompanyId && data.length === 1) {
          const sc = { ...data[0], hierarchyType: 'subcompany', hasChildren: true };
          setTreeData([sc]);
          setSelectedNode(sc);
          setExpandedNodes({ [sc._id]: true });
        } else {
          const mainNode = {
            _id: 'root',
            name: companyName,
            hierarchyType: 'main',
            hasChildren: true,
            code: company.code || user?.companyCode || storedCode,
            headName: user?.name || company.adminName || 'Primary Admin',
            headEmail: company.companyEmail || company.adminEmail || user?.email,
            phone: company.phone,
            address: company.address,
            children: data.map(sc => ({ ...sc, hierarchyType: 'subcompany', hasChildren: true }))
          };
          setTreeData([mainNode]);
          setSelectedNode(mainNode);
          setExpandedNodes({ 'root': true });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [companyName, user]);

  const toggleExpand = async (node) => {
    const nodeId = node._id;
    if (expandedNodes[nodeId]) {
      setExpandedNodes(prev => ({ ...prev, [nodeId]: false }));
      return;
    }

    if (!node.children || node.children.length === 0) {
      try {
        let res;
        switch(node.hierarchyType) {
          case 'main': 
            res = await orgService.getSubCompanies(); 
            if (res.data && res.data.length > 0) {
              node.children = res.data.map(i => ({ ...i, hierarchyType: 'subcompany', hasChildren: true })); 
            } else {
              res = await orgService.getDepartments();
              node.children = res.data.map(i => ({ ...i, hierarchyType: 'department', hasChildren: true }));
            }
            break;
          case 'subcompany': res = await orgService.getBranches(node._id); node.children = res.data.map(i => ({ ...i, hierarchyType: 'branch', hasChildren: true })); break;
          case 'branch': res = await orgService.getDivisions(node._id); node.children = res.data.map(i => ({ ...i, hierarchyType: 'division', hasChildren: true })); break;
          case 'division': res = await orgService.getDepartments(node._id); node.children = res.data.map(i => ({ ...i, hierarchyType: 'department', hasChildren: true })); break;
          case 'department': res = await orgService.getDesignations(node._id); node.children = res.data.map(i => ({ ...i, hierarchyType: 'designation', hasChildren: true })); break;
          case 'designation': res = await orgService.getEmployees(null, node._id); node.children = res.data.map(i => ({ ...i, hierarchyType: 'employee', hasChildren: false })); break;
          default: break;
        }
        setTreeData([...treeData]);
      } catch (err) { console.error(err); }
    }
    setExpandedNodes(prev => ({ ...prev, [nodeId]: true }));
  };

  const renderHeadAssignment = (headLabel, role) => (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h3 className="text-sm font-bold text-gray-900 mb-4">{headLabel} Assignment</h3>
      
      <div className="flex gap-6 mb-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <input type="radio" name="adminAssignmentType" value="existing" checked={formData.adminAssignmentType === 'existing'} onChange={handleFormChange} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
          Select Existing Employee
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <input type="radio" name="adminAssignmentType" value="new" checked={formData.adminAssignmentType === 'new'} onChange={handleFormChange} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
          {formData.isEdit ? 'Update Current Admin' : `Create New ${headLabel}`}
        </label>
      </div>

      {formData.adminAssignmentType === 'existing' ? (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Select Employee</label>
          <select 
            name="headEmployeeId" 
            value={formData.headEmployeeId || ''} 
            onChange={handleFormChange} 
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
          >
            <option value="">-- Choose Employee --</option>
            {potentialHeads.map(h => (
              <option key={h._id} value={h._id}>{h.name} ({h.employeeCode || h.email})</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Admin Full Name</label>
              <input type="text" name="adminName" value={formData.adminName || ''} onChange={handleFormChange} placeholder="John Doe" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Admin Email</label>
              <input type="email" name="adminEmail" value={formData.adminEmail || ''} onChange={handleFormChange} placeholder="email@example.com" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none transition-all" />
            </div>
          </div>
          <div className="space-y-1.5 relative">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Password {formData.isEdit && '(Leave blank to keep current)'}</label>
            <input type={showPassword ? "text" : "password"} name="adminPassword" value={formData.adminPassword || ''} onChange={handleFormChange} placeholder="••••••••" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none transition-all" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition-colors">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3">
        <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
          <Shield size={18} />
        </div>
        <div>
          <span className="text-[12px] font-bold text-blue-800 uppercase tracking-wide">Assigned Role: {role}</span>
          <p className="text-[11px] text-blue-600 mt-1 leading-relaxed">
            Full administrative control over this specific unit and its underlying hierarchy.
          </p>
        </div>
      </div>
    </div>
  );

  const [previewCode, setPreviewCode] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Live Code Preview Effect
  useEffect(() => {
    const name = formData.name || formData.companyName || formData.title;
    if (!modalOpen || !name || name.length < 2) {
      setPreviewCode('');
      return;
    }

    const fetchPreview = async () => {
      setIsPreviewLoading(true);
      try {
        const parentId = selectedNode?._id;
        const res = await api.get(`/organization/preview-code`, {
          params: { type: modalType, name, parentId }
        });
        if (res.data?.success) {
          setPreviewCode(res.data.data.code);
        }
      } catch (err) {
        console.error('Preview error:', err);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    const timeout = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timeout);
  }, [formData.name, formData.companyName, formData.title, modalType, modalOpen, selectedNode]);

  const renderFormFields = () => {
    const field = (name, label, type='text', req=false, disabled=false) => (
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}{req && '*'}</label>
        <div className="relative">
          <input 
            type={type} 
            name={name} 
            value={disabled ? (previewCode || 'Generating...') : (formData[name] || '')} 
            onChange={handleFormChange} 
            placeholder={disabled ? 'System will generate code' : `Enter ${label.toLowerCase()}`} 
            className={clsx(
              "w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition-all pr-10",
              disabled ? "bg-blue-50 border-blue-100 text-blue-700 font-mono font-bold cursor-not-allowed" : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500"
            )}
            required={!disabled && req}
            disabled={disabled}
          />
          {disabled && isPreviewLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {disabled && !isPreviewLoading && previewCode && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500">
              <Shield size={14} />
            </div>
          )}
        </div>
        {disabled && (
          <p className="text-[10px] text-blue-500 font-medium mt-1">Hierarchical code based on parent & unit name</p>
        )}
      </div>
    );

    switch(modalType) {
      case 'subcompany': return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('companyName', 'Sub-Company Name', 'text', true)}
            {field('code', 'Company Code', 'text', false, true)}
          </div>
          {field('email', 'Corporate Email', 'email', true)}
          {renderHeadAssignment('Sub-Company Admin', 'SUB_COMPANY_ADMIN')}
        </div>
      );
      case 'branch': return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('name', 'Branch Name', 'text', true)}
            {field('code', 'Branch Code', 'text', false, true)}
          </div>
          {field('city', 'City', 'text', true)}
          {field('address', 'Full Address')}
          {renderHeadAssignment('Branch Head', 'BRANCH_HEAD')}
        </div>
      );
      case 'division': return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('name', 'Division Name', 'text', true)}
            {field('code', 'Division Code', 'text', false, true)}
          </div>
          {renderHeadAssignment('Division Head', 'DIVISION_HEAD')}
        </div>
      );
      case 'department': return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('name', 'Department Name', 'text', true)}
            {field('code', 'Department Code', 'text', false, true)}
          </div>
          {renderHeadAssignment('Department Head', 'DEPARTMENT_HEAD')}
        </div>
      );
      case 'designation': return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('title', 'Designation Title', 'text', true)}
            {field('code', 'Designation Code', 'text', false, true)}
          </div>
          {field('grade', 'Grade')}
        </div>
      );
      case 'employee': return (
        <div className="space-y-4">
          {field('name', 'Full Name', 'text', true)}
          {field('email', 'Email Address', 'email', true)}
          {field('password', 'Login Password', 'password', true)}
          {field('phone', 'Phone Number')}
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#f8fafc] overflow-hidden font-sans">
      
      {/* MOBILE TRIGGER */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-blue-600 text-white rounded-full shadow-lg"
      >
        <Menu size={24} />
      </button>

      {/* LEFT PANEL: TREE SIDEBAR */}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-40 w-[320px] bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 transform lg:relative lg:translate-x-0",
        !isSidebarOpen && "-translate-x-full lg:translate-x-0 lg:w-0"
      )}>
        <SearchHierarchy value={searchQuery} onChange={setSearchQuery} />
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium uppercase tracking-widest">Syncing hierarchy...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTree.map(node => (
                <TreeNode 
                  key={node._id} 
                  node={node} 
                  level={0} 
                  onSelect={setSelectedNode}
                  activeId={selectedNode?._id}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT PANEL: CONTENT PANEL */}
      <main className="flex-1 overflow-y-auto bg-gray-50/30 custom-scrollbar">
        <div className="max-w-5xl mx-auto p-8">
          {selectedNode ? (
            <div className="animate-fade-in space-y-8">

              <OrganizationHeader 
                node={selectedNode} 
                breadcrumb={breadcrumb} 
                onAddNew={handleAddNew}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPermissions={handlePermissions}
                permissions={permissions}
              />
              <div className="flex items-center gap-6 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('details')}
                  className={clsx(
                    "pb-3 text-sm font-bold transition-colors border-b-2",
                    activeTab === 'details' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  Unit Overview
                </button>
                <button
                  onClick={() => setActiveTab('workflows')}
                  className={clsx(
                    "pb-3 text-sm font-bold transition-colors border-b-2",
                    activeTab === 'workflows' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  Universal Workflows
                </button>
              </div>

              <div className="space-y-6">
                {activeTab === 'details' && (
                  <div className="animate-fade-in">
                    <OrganizationDetails 
                      node={selectedNode} 
                      parentLabel={breadcrumb[breadcrumb.length - 2]?.label || 'System Root'} 
                    />
                  </div>
                )}
                {activeTab === 'workflows' && (
                  <div className="animate-fade-in bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <WorkflowSettings embedded unitId={selectedNode._id} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                <Building2 size={40} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Organization Matrix</h2>
                <p className="text-gray-500 max-w-sm mx-auto text-base leading-relaxed">
                  Select any unit from the organizational tree on the left to view its details, configuration, and structural hierarchy.
                </p>
              </div>
              

            </div>
          )}
        </div>
      </main>

      {/* CREATE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-6 bg-gray-50 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{formData.isEdit ? 'Edit' : 'Create New'} {modalType}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.isEdit ? 'Update existing unit details' : 'Add a new unit to the organization hierarchy'}
                </p>
              </div>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {formError && (
                <div className="flex gap-3 p-4 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
                  <X size={18} className="shrink-0" />
                  <span className="text-sm font-medium">{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {renderFormFields()}
                
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    {submitting ? (formData.isEdit ? 'Updating...' : 'Creating...') : (formData.isEdit ? `Update ${modalType}` : `Create ${modalType}`)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAILWIND ANIMATIONS */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}

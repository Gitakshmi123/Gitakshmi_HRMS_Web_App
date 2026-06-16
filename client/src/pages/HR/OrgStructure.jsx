import React, { useState, useEffect, useRef } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import useOrgStructure from '../../hooks/useOrgStructure';
import { useNavigate, useLocation } from 'react-router-dom';
import { Spin, Empty, Button, Tooltip, Avatar, Badge, Tag, Modal, Select } from 'antd';
import {
    ApartmentOutlined,
    UserOutlined,
    CaretDownOutlined,
    CaretUpOutlined,
    ArrowLeftOutlined,
    InfoCircleOutlined,
    EyeOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { API_ROOT } from '../../utils/api';

const BACKEND_URL = API_ROOT || '';

export default function OrgStructure() {
    const { getCompanyOrgTree, getTopLevelEmployees, getDirectReports, getAllEmployees, setManager } = useOrgStructure();
    const navigate = useNavigate();
    const location = useLocation();
    const [roots, setRoots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1);

    const wrapperRef = useRef(null);
    const contentRef = useRef(null);

    // States for dynamic manager editing
    const [employeesList, setEmployeesList] = useState([]);
    const [managerModalOpen, setManagerModalOpen] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [savingManager, setSavingManager] = useState(false);

    const [dragDropConfirmOpen, setDragDropConfirmOpen] = useState(false);
    const [draggedEmployeeData, setDraggedEmployeeData] = useState(null);
    const [targetManagerData, setTargetManagerData] = useState(null);
    const [isDragOverId, setIsDragOverId] = useState(null);

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 0.1, 1.5));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 0.1, 0.4));
    };

    const handleZoomReset = () => {
        setZoom(1);
    };

    const handleFitScreen = () => {
        if (wrapperRef.current) {
            const tableEl = wrapperRef.current.querySelector('.react-organizational-chart table');
            const wrapperWidth = wrapperRef.current.clientWidth;
            if (tableEl && wrapperWidth) {
                // Get original table width before scaling
                const tableWidth = tableEl.getBoundingClientRect().width / zoom;
                if (tableWidth > 0) {
                    const fitScale = (wrapperWidth - 32) / tableWidth;
                    const clampedScale = Math.min(Math.max(fitScale, 0.35), 1.1);
                    setZoom(clampedScale);
                }
            }
        }
    };

    // Auto-fit tree on initial render and window resize
    useEffect(() => {
        if (roots.length > 0) {
            const timer = setTimeout(() => {
                handleFitScreen();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [roots]);

    const handleOpenManagerModal = async (emp) => {
        setSelectedEmp(emp);
        setSelectedManagerId(emp.manager || '');
        setManagerModalOpen(true);
        const res = await getAllEmployees();
        if (res.success) {
            const list = res.data?.data || res.data || [];
            setEmployeesList(Array.isArray(list) ? list : []);
        }
    };

    const handleSaveManager = async () => {
        if (!selectedEmp) return;
        setSavingManager(true);
        const res = await setManager(selectedEmp._id, selectedManagerId || null);
        if (res.success) {
            // Re-fetch tree roots
            const treeRes = await getCompanyOrgTree(8);
            if (treeRes.success) {
                const treeRoots = extractRoots(treeRes.data);
                setRoots(treeRoots);
            }
            setManagerModalOpen(false);
            setSelectedEmp(null);
        } else {
            alert(res.error || 'Failed to update manager');
        }
        setSavingManager(false);
    };

    const handleConfirmDragDrop = async () => {
        if (!draggedEmployeeData || !targetManagerData) return;
        setSavingManager(true);
        const res = await setManager(draggedEmployeeData._id, targetManagerData._id);
        if (res.success) {
            const treeRes = await getCompanyOrgTree(8);
            if (treeRes.success) {
                const treeRoots = extractRoots(treeRes.data);
                setRoots(treeRoots);
            }
        } else {
            alert(res.error || 'Failed to update manager');
        }
        setSavingManager(false);
        setDragDropConfirmOpen(false);
        setDraggedEmployeeData(null);
        setTargetManagerData(null);
    };

    const toOrgNode = (employee) => {
        const nestedChildren = employee?.subordinates || employee?.reports || employee?.children || [];
        return {
            ...employee,
            isExpanded: employee.isExpanded !== undefined 
                ? employee.isExpanded 
                : (employee.type === 'company' || employee.type === 'department' || nestedChildren.length > 0),
            loaded: nestedChildren.length > 0,
            children: nestedChildren.map(toOrgNode)
        };
    };

    const extractRoots = (payload) => {
        const rootCandidates = payload?.hierarchy || payload?.reports || payload?.roots || [];

        if (Array.isArray(rootCandidates) && rootCandidates.length > 0) {
            return rootCandidates.map(toOrgNode);
        }

        if (payload?.root) {
            return [toOrgNode({
                ...payload.root,
                reports: payload.reports || payload.root.reports || payload.root.subordinates || []
            })];
        }

        return [];
    };

    // Initial load of roots
    useEffect(() => {
        const fetchRoots = async () => {
            setLoading(true);
            const treeRes = await getCompanyOrgTree(8);
            if (treeRes.success) {
                const treeRoots = extractRoots(treeRes.data);
                setRoots(treeRoots);
                setLoading(false);
                return;
            }

            const rootRes = await getTopLevelEmployees();
            if (rootRes.success) {
                setRoots((rootRes.data.employees || []).map(emp => ({
                    ...emp,
                    isExpanded: false,
                    loaded: false,
                    children: []
                })));
            }
            setLoading(false);
        };
        fetchRoots();
    }, []);

    const toggleNode = async (nodeId, currentRoots) => {
        const updateRecursive = async (nodes) => {
            return Promise.all(nodes.map(async (node) => {
                if (node._id === nodeId) {
                    if (node.isExpanded) return { ...node, isExpanded: false };
                    if (!node.loaded) {
                        const res = await getDirectReports(node._id);
                        if (res.success) {
                            return {
                                ...node,
                                isExpanded: true,
                                loaded: true,
                                children: res.data.map(child => ({
                                    ...child,
                                    isExpanded: false,
                                    loaded: false,
                                    children: []
                                }))
                            };
                        }
                    }
                    return { ...node, isExpanded: true };
                }
                if (node.children?.length > 0) {
                    return { ...node, children: await updateRecursive(node.children) };
                }
                return node;
            }));
        };
        const newRoots = await updateRecursive(currentRoots);
        setRoots(newRoots);
    };

    const openEmployeeProfile = (employee) => {
        if (!employee?._id) return;
        const basePath = location.pathname.startsWith('/tenant') ? '/tenant/employees' : '/hr/employees';
        navigate(`${basePath}/${employee._id}/profile`, { state: { employee } });
    };

    const EmployeeNode = ({ employee, siblingCount = 1 }) => {
        const isExpanded = employee.isExpanded;
        const [isHovered, setIsHovered] = useState(false);

        // Ultra-Adaptive Density Engine: Multiple tiers for perfect screen fit
        const getDensityClass = () => {
            if (siblingCount <= 2) return 'density-xl';
            if (siblingCount <= 4) return 'density-normal';
            if (siblingCount <= 8) return 'density-compact';
            if (siblingCount <= 12) return 'density-tight';
            if (siblingCount <= 20) return 'density-nano';
            return 'density-micro';
        };

        const densityClass = getDensityClass();

        if (employee.type === 'company' || employee.type === 'department') {
            const isCompany = employee.type === 'company';
            const name = employee.firstName || employee.name || employee.department || 'General';
            return (
                <div
                    className={`org-node inline-flex flex-col items-center relative group transition-all duration-300 ${densityClass} cursor-pointer`}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (typeof toggleNode === 'function') toggleNode(employee._id, roots);
                    }}
                >
                    <div className={`
                        px-4 py-2 rounded-md shadow-md border transition-all duration-300 transform group-hover:scale-105
                        ${isCompany 
                            ? 'bg-slate-800 border-slate-900 text-white dark:bg-slate-100 dark:border-white dark:text-slate-900' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 border-indigo-700 text-white dark:from-blue-700 dark:to-indigo-700 dark:border-indigo-800'}
                    `}>
                        <div className="font-extrabold tracking-wider text-[11px] uppercase whitespace-nowrap px-1">
                            {name}
                        </div>
                        {isCompany ? (
                            <div className="text-[9px] font-bold opacity-70 mt-0.5 uppercase tracking-widest">Organization</div>
                        ) : (
                            <div className="text-[8px] font-bold opacity-80 mt-0.5 uppercase tracking-widest text-blue-100">Department</div>
                        )}
                    </div>

                    {/* Hover-Revealed Expansion Arrow */}
                    <div
                        className={`
                            absolute -bottom-5 left-1/2 -translate-x-1/2 transition-all duration-300 cursor-pointer z-10
                            ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
                            bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-md
                        `}
                    >
                        {isExpanded ? <CaretUpOutlined style={{ fontSize: '8px' }} /> : <CaretDownOutlined style={{ fontSize: '10px' }} />}
                    </div>
                </div>
            );
        }

        return (
            <div
                className={`org-node inline-flex flex-col items-center relative group transition-all duration-300 ${densityClass} hover:z-[100] cursor-pointer ${isDragOverId === employee._id ? 'ring-4 ring-indigo-500 ring-offset-4 rounded-xl scale-105 bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => openEmployeeProfile(employee)}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('application/json', JSON.stringify(employee));
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    if (isDragOverId !== employee._id) setIsDragOverId(employee._id);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isDragOverId === employee._id) setIsDragOverId(null);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOverId(null);
                    try {
                        const draggedData = JSON.parse(e.dataTransfer.getData('application/json'));
                        if (draggedData._id && draggedData._id !== employee._id && draggedData.manager !== employee._id) {
                            setDraggedEmployeeData(draggedData);
                            setTargetManagerData(employee);
                            setDragDropConfirmOpen(true);
                        }
                    } catch (err) {}
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openEmployeeProfile(employee);
                }}
            >
                {/* Avatar Core - Adaptive Fluidity */}
                <Tooltip
                    placement="right"
                    title={
                        <div style={{ minWidth: 180 }}>
                            <div><strong>ID:</strong> {String(employee._id || '').slice(-8).toUpperCase()}</div>
                            <div><strong>Department:</strong> {employee.department || 'General'}</div>
{/* <div><strong>Branch:</strong> {employee.branch || 'Headquarters'}</div> */}
                        </div>
                    }
                >
                    <div className={`
                        node-avatar-box relative transition-all duration-300 p-0.5 rounded-full
                        ${isExpanded ? 'ring-[3px] ring-indigo-500 ring-offset-4 dark:ring-offset-slate-950 shadow-2xl shadow-indigo-500/30' : ''}
                    `}>
                        <Avatar
                            src={employee.profilePic ? (employee.profilePic.startsWith('http') ? employee.profilePic : `${BACKEND_URL}${employee.profilePic.startsWith('/') ? '' : '/'}${employee.profilePic}`) : null}
                            icon={<UserOutlined />}
                            className="node-avatar border-2 border-slate-200 dark:border-slate-800 shadow-lg transition-all duration-300"
                            style={{
                                width: 'clamp(36px, 4vw, 52px)',
                                height: 'clamp(36px, 4vw, 52px)',
                                fontSize: 'clamp(14px, 2vw, 20px)'
                            }}
                        />

                        {/* Active Status Highlight - Adaptive Size */}
                        <div className="status-dot-wrapper absolute -bottom-1 -right-1 bg-white dark:bg-slate-950 rounded-full flex items-center justify-center shadow-lg">
                            <div className={`status-dot rounded-full ${employee.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        </div>
                    </div>
                </Tooltip>

                {/* Vertical Text Stack - Fluid Sizing */}
                <div className="mt-1.5 text-center pointer-events-none transition-all duration-300 flex flex-col items-center">
                    <div className="node-name font-black text-slate-800 dark:text-slate-100 leading-[1.1] tracking-tight uppercase truncate"
                        style={{ fontSize: 'clamp(9px, 1.1vw, 13px)' }}>
                        {employee.firstName} {employee.lastName}
                    </div>
                    <span className="node-label font-bold text-blue-600 bg-blue-50/80 border border-blue-100 rounded-full px-2 py-0.5 uppercase tracking-wide mt-1.5 truncate max-w-[130px] dark:bg-blue-950/40 dark:border-blue-900/40 dark:text-blue-400"
                        style={{ fontSize: 'clamp(7px, 0.7vw, 8.5px)' }}>
                        {employee.department || 'General'}
                    </span>
                </div>

                {/* Hover-Revealed Expansion Arrow - Strictly Scoped Toggle */}
                <div
                    className={`
                        absolute -bottom-5 left-1/2 -translate-x-1/2 transition-all duration-300 cursor-pointer z-10
                        ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
                        bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-md
                    `}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleNode(employee._id, roots);
                    }}
                >
                    {isExpanded ? <CaretUpOutlined style={{ fontSize: '8px' }} /> : <CaretDownOutlined style={{ fontSize: '10px' }} />}
                </div>

                {/* Adaptive Floating Panel - Smooth CSS Hover Bridge */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 w-8 h-20 -translate-x-1 bg-transparent z-[9998] pointer-events-auto" />

                <div className={`
                    absolute left-full ml-5 top-1/2 -translate-y-1/2 w-auto min-w-max bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 p-3 z-[9999] text-left
                    transition-all duration-300 origin-left ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[transform,opacity]
                    opacity-0 scale-95 translate-x-4 pointer-events-none
                    group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 group-hover:pointer-events-auto
                `}>
                    <div className="space-y-2.5">
                        <div className="org-panel-row">
                            <span className="org-label">ID</span>
                            <span className="org-separator">:</span>
                            <span className="org-value">{String(employee._id || '').slice(-8).toUpperCase()}</span>
                        </div>
                        <div className="org-panel-row">
                            <span className="org-label">Department</span>
                            <span className="org-separator">:</span>
                            <span className="org-value truncate" title={employee.department || 'General'}>
                                {employee.department || 'General'}
                            </span>
                        </div>
                        {/* <div className="org-panel-row">
                            <span className="org-label">Branch</span>
                            <span className="org-separator">:</span>
                            <span className="org-value truncate" title={employee.branch || 'Headquarters'}>
                                {employee.branch || 'Headquarters'}
                            </span>
                        </div> */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <Button 
                                size="small" 
                                type="primary"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold h-6 rounded-md px-2 flex items-center gap-1 shadow-sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenManagerModal(employee);
                                }}
                            >
                                Set Manager
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderRecursive = (nodes) => {
        return nodes.map((node, i) => (
            <TreeNode key={node._id || `org-node-${i}`} label={<EmployeeNode employee={node} siblingCount={nodes.length} />}>
                {node.isExpanded && node.children && node.children.length > 0 && renderRecursive(node.children)}
                {node.isExpanded && node.loaded && node.children.length === 0 && (
                    <TreeNode key={`end-${node._id || i}`} label={
                        <div className="flex justify-center mt-2">
                            <div className="py-1 px-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-[6px] font-bold text-slate-300 uppercase tracking-widest opacity-40">
                                End Authority
                            </div>
                        </div>
                    } />
                )}
            </TreeNode>
        ));
    };

    if (loading) return (
        <div className="space-y-6 pb-12">
            <div className="flex h-[70vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Spin size="large" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading Hierarchy...</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-12 org-structure-page select-none">
            {/* Zoom Control Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                        Zoom & Navigation
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        size="small"
                        onClick={handleZoomOut} 
                        disabled={zoom <= 0.4}
                        className="flex items-center justify-center border-slate-200 hover:border-blue-500 text-slate-600 hover:text-blue-600 rounded-lg text-xs"
                    >
                        Zoom -
                    </Button>
                    <input 
                        type="range" 
                        min="40" 
                        max="150" 
                        value={Math.round(zoom * 100)} 
                        onChange={(e) => setZoom(Number(e.target.value) / 100)}
                        className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-xs font-black text-blue-600 min-w-[45px] text-center">
                        {Math.round(zoom * 100)}%
                    </span>
                    <Button 
                        size="small"
                        onClick={handleZoomIn} 
                        disabled={zoom >= 1.5}
                        className="flex items-center justify-center border-slate-200 hover:border-blue-500 text-slate-600 hover:text-blue-600 rounded-lg text-xs"
                    >
                        Zoom +
                    </Button>
                    <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                    <Button 
                        size="small"
                        type="primary"
                        onClick={handleFitScreen}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs"
                    >
                        Fit to Screen
                    </Button>
                    <Button 
                        size="small"
                        onClick={handleZoomReset}
                        className="border-slate-200 hover:border-slate-400 text-slate-600 rounded-lg text-xs"
                    >
                        Reset (100%)
                    </Button>
                </div>
            </div>

            {/* Tree Canvas Container */}
            <div className="overflow-hidden flex flex-col min-h-[75vh] relative pt-2">
                {roots.length === 0 ? (
                    <div className="flex items-center justify-center flex-1">
                        <Empty description="No Records Found" />
                    </div>
                ) : (
                    <div 
                        ref={wrapperRef}
                        className="org-tree-wrapper w-full flex-1 flex flex-col items-center overflow-auto no-scrollbar pb-10"
                    >
                        <div 
                            ref={contentRef}
                            className="transition-transform duration-300 ease-out origin-top flex flex-col items-center"
                            style={{ 
                                transform: `scale(${zoom})`,
                                width: 'max-content',
                                minWidth: '100%',
                            }}
                        >
                            <Tree
                                lineWidth={'1.5px'}
                                lineColor={'#cbd5e1'}
                                lineHeight={'40px'}
                                lineBorderRadius={'12px'}
                                label={
                                    <div className="mb-8">
                                        <div className="inline-block px-5 py-2 bg-[#4F46E5] text-white rounded-lg text-sm font-bold shadow-md">
                                            Executive Root
                                        </div>
                                    </div>
                                }
                            >
                                {renderRecursive(roots)}
                            </Tree>
                        </div>
                    </div>
                )}
            </div>

            {/* Set Manager Modal */}
            <Modal
                title={
                    <div className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Set Reporting Manager
                    </div>
                }
                open={managerModalOpen}
                onCancel={() => {
                    setManagerModalOpen(false);
                    setSelectedEmp(null);
                }}
                onOk={handleSaveManager}
                confirmLoading={savingManager}
                okText="Save Assignment"
                cancelText="Cancel"
                okButtonProps={{ className: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs' }}
                cancelButtonProps={{ className: 'rounded-lg text-xs' }}
                centered
            >
                {selectedEmp && (
                    <div className="space-y-4 py-4">
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                            <Avatar src={selectedEmp.profilePic} icon={<UserOutlined />} size="large" />
                            <div>
                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none">
                                    {selectedEmp.firstName} {selectedEmp.lastName}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                                    {selectedEmp.department || 'General'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1">
                                Select Reporting Manager
                            </label>
                            <Select
                                showSearch
                                placeholder="Search & select employee..."
                                value={selectedManagerId || undefined}
                                onChange={(value) => setSelectedManagerId(value || '')}
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                className="w-full h-11"
                                popupClassName="dark:bg-slate-900"
                                options={[
                                    { value: '', label: '— No Manager (Executive Root) —' },
                                    ...employeesList
                                        .filter(e => String(e._id) !== String(selectedEmp._id))
                                        .map(e => ({
                                            value: e._id,
                                            label: `${e.firstName} ${e.lastName} (${e.department || 'General'} - ${e.role || 'Employee'})`
                                        }))
                                ]}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Drag & Drop Confirmation Modal */}
            <Modal
                title={
                    <div className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Confirm Manager Change
                    </div>
                }
                open={dragDropConfirmOpen}
                onCancel={() => {
                    setDragDropConfirmOpen(false);
                    setDraggedEmployeeData(null);
                    setTargetManagerData(null);
                }}
                onOk={handleConfirmDragDrop}
                confirmLoading={savingManager}
                okText="Yes, Move Employee"
                cancelText="Cancel"
                okButtonProps={{ className: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs' }}
                cancelButtonProps={{ className: 'rounded-lg text-xs' }}
                centered
            >
                {draggedEmployeeData && targetManagerData && (
                    <div className="space-y-4 py-4">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            Are you sure you want to move <strong>{draggedEmployeeData.firstName} {draggedEmployeeData.lastName}</strong> to report to <strong>{targetManagerData.firstName} {targetManagerData.lastName}</strong>?
                        </div>
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col items-center">
                                <Avatar src={draggedEmployeeData.profilePic} icon={<UserOutlined />} size="large" />
                                <span className="text-[10px] font-bold mt-1 text-slate-500 uppercase">{draggedEmployeeData.firstName}</span>
                            </div>
                            <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-700 relative">
                                <ArrowLeftOutlined className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 dark:bg-slate-900 px-2 text-indigo-500" />
                            </div>
                            <div className="flex flex-col items-center">
                                <Avatar src={targetManagerData.profilePic} icon={<UserOutlined />} size="large" />
                                <span className="text-[10px] font-bold mt-1 text-indigo-500 uppercase">{targetManagerData.firstName}</span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Viewport Adaptive Scoped Styles */}
            <style>{`
                .org-structure-page { padding: 10px; }
                /* FORCE 100% WIDTH & DISABLE SCROLLING */
                .org-structure-page .react-organizational-chart { 
                    width: 100% !important; 
                    margin: 0 !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: flex-start !important;
                }
                 .org-structure-page .react-organizational-chart table {
                     width: auto !important;
                     margin: 0 auto !important;
                     border-collapse: separate !important;
                     border-spacing: clamp(2px, 1.2vw, 12px) 0 !important;
                 }
                 .org-structure-page .react-organizational-chart .node-content { 
                     display: block !important; 
                     width: 100% !important;
                 }
                 .org-structure-page .react-organizational-chart .tree-node {
                     padding-top: 12px;
                 }

                /* Node Scaling Engine - Absolute Fluidity */
                .org-structure-page .org-node .node-avatar {
                    width: clamp(20px, 4vw, 32px);
                    height: clamp(20px, 4vw, 32px);
                }
                .org-structure-page .org-node .node-name {
                    font-size: clamp(6px, 1.2vw, 9px);
                    max-width: 90%;
                    margin: 0 auto;
                }
                .org-structure-page .org-node .node-label {
                    font-size: clamp(5px, 0.8vw, 7px);
                }

                /* Adaptive Density States - Hyper Aggressive Scaling */
                .org-structure-page .org-node { 
                    transform-origin: top center; 
                    transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
                    backface-visibility: hidden;
                    -webkit-font-smoothing: antialiased;
                    transform: translateZ(0);
                }
                .org-structure-page .org-node.density-xl { transform: scale(1.2) translateZ(0); }
                .org-structure-page .org-node.density-normal { transform: scale(1.05) translateZ(0); }
                .org-structure-page .org-node.density-compact { transform: scale(0.9) translateZ(0); }
                .org-structure-page .org-node.density-tight { transform: scale(0.8) translateZ(0); }
                .org-structure-page .org-node.density-nano { transform: scale(0.7) translateZ(0); }
                .org-structure-page .org-node.density-micro { transform: scale(0.55) translateZ(0); }

                /* Status Dot Scaling */
                .org-structure-page .status-dot-wrapper {
                    width: clamp(8px, 1.5vw, 10px);
                    height: clamp(8px, 1.5vw, 10px);
                }
                .org-structure-page .status-dot {
                    width: clamp(4px, 1vw, 6px);
                    height: clamp(4px, 1vw, 6px);
                }

                /* Scrollbar Removal */
                .org-structure-page *::-webkit-scrollbar { display: none !important; }
                .org-structure-page * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
                
                /* Line Color Refinement */
                .org-structure-page .react-organizational-chart .tree-node::before,
                .org-structure-page .react-organizational-chart .tree-node::after {
                    border-color: #cbd5e1 !important;
                }
                .dark .org-structure-page .react-organizational-chart .tree-node::before,
                .dark .org-structure-page .react-organizational-chart .tree-node::after {
                    border-color: #334155 !important;
                }

                /* Hover Panel Alignment Styles */
                .org-structure-page .org-panel-row {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    line-height: 1.2;
                    white-space: nowrap;
                }
                .org-structure-page .org-label {
                    width: 70px;
                    flex-shrink: 0;
                    font-size: 8px;
                    font-weight: 900;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .org-structure-page .org-separator {
                    color: #e2e8f0;
                    font-size: 9px;
                    font-weight: bold;
                }
                .org-structure-page .org-value {
                    font-size: 10px;
                    font-weight: 700;
                    color: #475569;
                }
                .dark .org-structure-page .org-value {
                    color: #cbd5e1;
                }

                /* Node highlight logic */
                .org-structure-page .node-avatar-box {
                    background: transparent;
                }
                .org-structure-page .group:hover .node-avatar {
                    transform: scale(1.1);
                    border-color: #6366f1;
                }
            `}</style>
        </div>
    );
}

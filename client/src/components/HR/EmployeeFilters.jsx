import React from 'react';
import { Search, Filter, LayoutGrid, LayoutList, Trash2, Users, SlidersHorizontal, Briefcase, Zap } from 'lucide-react';
import { Select } from 'antd';

const STATUS_OPTIONS = [
  { value: '', label: 'Status: All' },
  { value: 'Active', label: 'Status: Active' },
  { value: 'notice', label: 'Status: On Notice' },
  { value: 'resigned', label: 'Status: Resigned' },
];

/**
 * Modern HR SaaS Filter Bar (match Keka/Zoho/Darwinbox screenshot style).
 */
export default function EmployeeFilters({
  searchTerm,
  onSearchChange,
  showFilterDropdowns,
  onToggleFilters,
  selectedDepartment,
  onDepartmentChange,
  availableDepartments = [],
  selectedDesignations = [],
  onDesignationsChange,
  availableDesignations = [],
  selectedStatus,
  onStatusChange,
  selectedEmployeeTypes = [],
  onEmployeeTypesChange,
  employeeTypes = [],
  selectedWorkModes = [],
  onWorkModesChange,
  workModes = [],
  onClearFilters,
  viewMode,
  onViewModeChange,
}) {
  const hasActiveFilters =
    selectedDepartment ||
    (selectedDesignations && selectedDesignations.length > 0) ||
    selectedStatus ||
    (selectedEmployeeTypes && selectedEmployeeTypes.length > 0) ||
    (selectedWorkModes && selectedWorkModes.length > 0);

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative min-w-[260px] flex-grow md:flex-grow-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search"
            value={searchTerm || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[8px] text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
        </div>

        {/* Type Filter */}
        <div className="w-32">
          <Select
            placeholder={<div className="flex items-center gap-2 text-slate-500"><Zap size={14} /> Type</div>}
            value={selectedEmployeeTypes[0] || undefined}
            onChange={(val) => onEmployeeTypesChange && onEmployeeTypesChange(val ? [val] : [])}
            allowClear
            className="custom-filter-select w-full"
            variant="borderless"
            options={employeeTypes.map(t => ({ value: t, label: t }))}
          />
        </div>

        {/* Status Filter */}
        <div className="w-32">
          <Select
            placeholder={<div className="flex items-center gap-2 text-slate-500"><Users size={14} /> Status</div>}
            value={selectedStatus || undefined}
            onChange={onStatusChange}
            allowClear
            className="custom-filter-select w-full"
            variant="borderless"
            options={STATUS_OPTIONS}
          />
        </div>

        {/* Role Filter */}
        <div className="w-32">
          <Select
            placeholder={<div className="flex items-center gap-2 text-slate-500"><Briefcase size={14} /> Role</div>}
            value={selectedDesignations[0] || undefined}
            onChange={(val) => onDesignationsChange && onDesignationsChange(val ? [val] : [])}
            allowClear
            className="custom-filter-select w-full"
            variant="borderless"
            options={(availableDesignations || []).map(d => ({ value: d, label: d }))}
          />
        </div>

        {/* Advance Filter Toggle */}
        <button
          onClick={() => onToggleFilters && onToggleFilters()}
          className={`flex items-center gap-2 px-3 py-2 rounded-[8px] text-[13px] font-medium transition-colors border ${
            showFilterDropdowns 
              ? 'bg-blue-50 border-blue-200 text-blue-600' 
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <SlidersHorizontal size={14} />
          Advance Filter
        </button>

        <div className="flex-grow" />

        {/* View Mode & Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-[6px] transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded-[6px] transition-all ${viewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutList size={18} />
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-[6px] transition-colors"
              title="Clear All"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Pane */}
      {showFilterDropdowns && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 border border-slate-200 rounded-[12px] animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Department</label>
            <Select
              placeholder="Select Department"
              value={selectedDepartment || undefined}
              onChange={onDepartmentChange}
              allowClear
              className="w-full"
              options={(availableDepartments || []).map(d => ({ value: d.name, label: d.name }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Work Mode</label>
            <Select
              mode="multiple"
              placeholder="Select Work Mode"
              value={selectedWorkModes}
              onChange={onWorkModesChange}
              allowClear
              className="w-full"
              options={workModes.map(m => ({ value: m, label: m }))}
            />
          </div>
        </div>
      )}

      <style>{`
        .custom-filter-select .ant-select-selector {
          background-color: transparent !important;
          border: none !important;
          padding: 0 4px !important;
        }
        .custom-filter-select .ant-select-selection-item,
        .custom-filter-select .ant-select-selection-placeholder {
          font-size: 13px !important;
          font-weight: 500 !important;
        }
      `}</style>
    </div>
  );
}

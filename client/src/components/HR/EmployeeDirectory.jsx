import React from 'react';
import { Pagination } from 'antd';
import { API_ROOT } from '../../utils/api';
import EmployeeStats from './EmployeeStats';
import EmployeeFilters from './EmployeeFilters';
import EmployeeCard from './EmployeeCard';

const BACKEND_URL = API_ROOT || '';

/**
 * Employee Directory: stats + filters + responsive card grid.
 * Wraps existing employee data; no API or state changes.
 * Grid: 4 cols desktop, 2 tablet, 1 mobile.
 */
export default function EmployeeDirectory({
  employees = [],
  loading = false,
  stats = {},
  // Search & filters (controlled by parent)
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
  viewMode = 'grid',
  onViewModeChange,
  // Pagination
  currentPage = 1,
  pageSize = 12,
  onPageChange,
  // Card actions (existing handlers from parent)
  onViewProfile,
  onEdit,
  onApplyLeave,
  onSalaryStructure,
}) {
  const total = employees.length;
  const start = (currentPage - 1) * pageSize;
  const paginatedEmployees = employees.slice(start, start + pageSize);

  return (
    <div className="space-y-6 pb-12">
      <EmployeeStats stats={stats} />

      <EmployeeFilters
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        showFilterDropdowns={showFilterDropdowns}
        onToggleFilters={onToggleFilters}
        selectedDepartment={selectedDepartment}
        onDepartmentChange={onDepartmentChange}
        availableDepartments={availableDepartments}
        selectedDesignations={selectedDesignations}
        onDesignationsChange={onDesignationsChange}
        availableDesignations={availableDesignations}
        selectedStatus={selectedStatus}
        onStatusChange={onStatusChange}
        selectedEmployeeTypes={selectedEmployeeTypes}
        onEmployeeTypesChange={onEmployeeTypesChange}
        employeeTypes={employeeTypes}
        selectedWorkModes={selectedWorkModes}
        onWorkModesChange={onWorkModesChange}
        workModes={workModes}
        onClearFilters={onClearFilters}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading employees...</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          No employees found. Try adjusting filters or add a new employee.
        </div>
      ) : viewMode === 'list' ? (
        /* List view: compact rows (optional, same data as before) */
        <div className="space-y-2">
          {paginatedEmployees.map((emp) => (
            <div
              key={emp._id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md p-4 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0">
                {emp.profilePic ? (
                  <img
                    src={`${BACKEND_URL}${emp.profilePic}`}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                    {(emp.firstName?.[0] || '') + (emp.lastName?.[0] || '') || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white truncate">
                    {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {emp.designation || emp.role || '—'} · {emp.department || '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onViewProfile && onViewProfile(emp)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-500/30"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onEdit && onEdit(emp)}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Card grid: 4 / 2 / 1 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {paginatedEmployees.map((emp) => (
            <EmployeeCard
              key={emp._id}
              employee={emp}
              allEmployees={employees}
              onViewProfile={onViewProfile}
              onEdit={onEdit}
              onApplyLeave={onApplyLeave}
              onSalaryStructure={onSalaryStructure}
            />
          ))}
        </div>
      )}

      {!loading && employees.length > 0 && (
        <div className="flex justify-center pt-4 border-t border-slate-200 dark:border-slate-800">
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={total}
            onChange={onPageChange}
            showSizeChanger={false}
            size="small"
          />
        </div>
      )}
    </div>
  );
}

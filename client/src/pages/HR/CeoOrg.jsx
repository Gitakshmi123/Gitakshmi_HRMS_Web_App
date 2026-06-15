import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function CeoOrg() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState({});
  const [expandedManagers, setExpandedManagers] = useState({});

  useEffect(() => {
    loadHierarchy();
  }, []);

  async function loadHierarchy() {
    try {
      setLoading(true);
      const res = await api.get('/hr/employees');
      const employees = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];

      const organized = {};
      employees.forEach(emp => {
        const dept = emp.department || 'Unassigned';
        const managerId = emp.manager?._id || emp.manager || 'no-manager';
        const managerName = emp.manager ? `${emp.manager.firstName || ''} ${emp.manager.lastName || ''}`.trim() : 'No Manager';

        if (!organized[dept]) organized[dept] = {};
        if (!organized[dept][managerId]) {
          organized[dept][managerId] = {
            managerId,
            managerName,
            managerRole: emp.manager?.role || 'Manager',
            employees: []
          };
        }
        organized[dept][managerId].employees.push(emp);
      });

      setData(organized);
    } catch (err) {
      console.error('Failed to load hierarchy:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleDept(dept) {
    setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
  }

  function toggleManager(deptKey) {
    setExpandedManagers(prev => ({ ...prev, [deptKey]: !prev[deptKey] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading hierarchy...</p>
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Company Hierarchy</h1>
        <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-slate-500">
          <p>No employees found. Add employees to build your hierarchy.</p>
        </div>
      </div>
    );
  }

  const departments = Object.keys(data).sort();

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Company Hierarchy</h1>
      <p className="text-slate-600 mb-6">Company → Department → Manager → Employees</p>

      <div className="bg-white rounded-lg border-2 border-slate-300 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl">🏢</div>
          <div>
            <h2 className="text-2xl font-bold">Company</h2>
            <p className="text-purple-100">{departments.length} departments</p>
          </div>
        </div>

        <div className="divide-y">
          {departments.map((dept) => {
            const managers = Object.values(data[dept]);
            const totalEmployees = managers.reduce((sum, m) => sum + m.employees.length, 0);
            const isDeptExpanded = expandedDepts[dept] !== false;

            return (
              <div key={dept} className="border-l-4 border-l-purple-300">
                <button
                  onClick={() => toggleDept(dept)}
                  className="w-full p-6 hover:bg-purple-50 transition flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    {isDeptExpanded ? <span className="text-2xl">▼</span> : <span className="text-2xl">▶</span>}
                  </div>
                  <div className="w-14 h-14 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-xl font-bold flex-shrink-0">📁</div>
                  <div className="flex-grow text-left">
                    <h3 className="text-xl font-bold text-slate-900">{dept}</h3>
                    <p className="text-sm text-slate-600">{managers.length} managers • {totalEmployees} employees</p>
                  </div>
                </button>

                {isDeptExpanded && (
                  <div className="bg-purple-50 border-t divide-y">
                    {managers.map((manager) => {
                      const managerKey = `${dept}-${manager.managerId}`;
                      const isManagerExpanded = expandedManagers[managerKey] !== false;
                      const empCount = manager.employees.length;

                      return (
                        <div key={managerKey} className="border-l-4 border-l-blue-300">
                          <button
                            onClick={() => toggleManager(managerKey)}
                            className="w-full p-6 hover:bg-blue-50 transition flex items-center gap-4 ml-6"
                          >
                            <div className="flex-shrink-0">
                              {isManagerExpanded ? <span className="text-xl">▼</span> : <span className="text-xl">▶</span>}
                            </div>
                            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold flex-shrink-0">👔</div>
                            <div className="flex-grow text-left">
                              <h4 className="font-semibold text-slate-900">{manager.managerName || 'Unassigned Manager'}</h4>
                              <p className="text-sm text-slate-600">{manager.managerRole} • {empCount} {empCount === 1 ? 'employee' : 'employees'}</p>
                            </div>
                          </button>

                          {isManagerExpanded && (
                            <div className="bg-blue-50 border-t ml-6">
                              {empCount === 0 ? (
                                <div className="p-4 text-slate-500 text-sm italic">No employees assigned</div>
                              ) : (
                                <div className="divide-y">
                                  {manager.employees.map((emp) => (
                                    <div key={emp._id} className="p-5 hover:bg-white transition flex items-center gap-4 border-l-4 border-l-slate-300">
                                      <div className="w-10 h-10 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold flex-shrink-0">{`${(emp.firstName || '').slice(0, 1)}${(emp.lastName || '').slice(0, 1)}`.toUpperCase() || '?'}</div>
                                      <div className="flex-grow">
                                        <p className="font-semibold text-slate-900">{emp.firstName} {emp.lastName}</p>
                                        <p className="text-sm text-slate-600">{emp.employeeId} • {emp.role || 'Employee'}</p>
                                      </div>
                                      <div className="text-xs bg-white px-3 py-1 rounded-full text-slate-600">{emp.email}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-50 border-t p-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{departments.length}</div>
              <div className="text-sm text-slate-600">Departments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{Object.values(data).reduce((sum, dept) => sum + Object.keys(dept).length, 0)}</div>
              <div className="text-sm text-slate-600">Managers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{Object.values(data).reduce((sum, dept) => sum + Object.values(dept).reduce((s, m) => s + m.employees.length, 0), 0)}</div>
              <div className="text-sm text-slate-600">Employees</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{Object.values(data).reduce((sum, dept) => sum + Object.values(dept).reduce((s, m) => s + m.employees.length, 0), 0) + Object.values(data).reduce((sum, dept) => sum + Object.keys(dept).length, 0)}</div>
              <div className="text-sm text-slate-600">Total People</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

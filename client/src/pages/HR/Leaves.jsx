import React, { useState, useEffect } from 'react';
import { Pagination } from 'antd';
import api from '../../utils/api';
import {
  Search, FileText
} from '../../components/Icons';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';

export default function Leaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All'); // All, Pending, Approved, Rejected
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchLeaves();
  }, [currentPage]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/hr/leaves/requests?page=${currentPage}&limit=${pageSize}`);

      // Handle both paginated and non-paginated responses
      if (res.data.data) {
        // New format with pagination
        setLeaves(res.data.data);
      } else {
        // Fallback for array response
        setLeaves(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error("Failed to fetch leaves", err);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredLeaves = leaves.filter(l => {
    const matchesFilter = filter === 'All' || l.status === filter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      l.employee?.firstName?.toLowerCase().includes(searchLower) ||
      l.employee?.lastName?.toLowerCase().includes(searchLower) ||
      l.employee?.employeeId?.toLowerCase().includes(searchLower);

    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Rejected': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="p-2.5 w-full mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-emerald-600 p-10 rounded-xl shadow-sm relative overflow-hidden mb-8">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Leave Management</h1>
          <p className="text-emerald-100 font-medium text-lg">Review and manage employee leave requests.</p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-full bg-white/10 blur-3xl rounded-full pointer-events-none -mr-16 -mt-10"></div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {['All', 'Pending', 'Approved', 'Rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap border ${filter === s
                ? 'bg-emerald-600 text-white shadow-md border-emerald-600'
                : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100 hover:text-slate-700'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Loading requests...</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="bg-slate-50 p-6 rounded-full border-2 border-dashed border-slate-200 mb-4">
              <FileText className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-slate-800 font-bold text-lg mb-1">No Leave Requests</h3>
            <p className="text-slate-500 text-sm">No requests found matching your current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
            <table className="w-full text-sm text-left min-w-[850px]">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left w-[25%]">Employee</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-[15%]">Type</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-[20%]">Duration</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-[25%]">Reason</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-[15%]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLeaves.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((leave) => {
                  const start = formatDateDDMMYYYY(leave.startDate);
                  const end = formatDateDDMMYYYY(leave.endDate);

                  return (
                    <tr key={leave._id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm ${leave.employee?.firstName?.[0] ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {leave.employee?.firstName?.[0] || '?'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                              {leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : 'Unknown'}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {leave.employee?.employeeId || 'ID: --'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-bold border border-slate-100 uppercase tracking-wide">
                          {leave.leaveType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs space-y-0.5">
                          <span className="font-bold text-slate-700">{start}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-300">to</span>
                          <span className="font-bold text-slate-700">{end}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-600 truncate max-w-[200px] text-xs font-medium" title={leave.reason}>
                          {leave.reason || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(leave.status)}`}>
                          {leave.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filteredLeaves.length > pageSize && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-center bg-slate-50/30">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredLeaves.length}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
              size="small"
            />
          </div>
        )}
      </div>
    </div>
  );
}

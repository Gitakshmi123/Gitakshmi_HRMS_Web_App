import React, { useState } from 'react';
import { Plane, MessageSquare, ChevronRight, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_ROOT } from '../../../../utils/api';

const BACKEND_URL = API_ROOT || '';

const WorkforceStatus = ({ leaves = [] }) => {
  const [activeTab, setActiveTab] = useState('onLeave');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter for employees on leave today
  const onLeaveToday = leaves.filter(l => {
    if (String(l.status || '').toLowerCase() !== 'approved') return false;
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return today >= start && today <= end;
  });

  // Filter for pending leave requests
  const pendingRequests = leaves.filter(l =>
    String(l?.status || '').toLowerCase() === 'pending'
  );

  const displayList = activeTab === 'onLeave' ? onLeaveToday : pendingRequests;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[340px] overflow-hidden">
      {/* Header Tabs */}
      <div className="flex border-b border-gray-50">
        <button
          onClick={() => setActiveTab('onLeave')}
          className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'onLeave' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Plane size={14} />
            On Leave Today ({onLeaveToday.length})
          </div>
          {activeTab === 'onLeave' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'pending' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare size={14} />
            Pending ({pendingRequests.length})
          </div>
          {activeTab === 'pending' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
        </button>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {displayList.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-10 scale-90">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              {activeTab === 'onLeave' ? <Plane size={32} /> : <MessageSquare size={32} />}
            </div>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">No Records Found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayList.map((leave, idx) => {
              const emp = leave.employee || {};
              const name = typeof emp === 'object' ? `${emp.firstName} ${emp.lastName}` : (emp || 'Unknown');
              const type = leave.leaveType || 'General';

              return (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {emp.profilePic || emp.profilePicture ? (
                        <img
                          src={String(emp.profilePic || emp.profilePicture).startsWith('http') ? (emp.profilePic || emp.profilePicture) : `${BACKEND_URL}${String(emp.profilePic || emp.profilePicture).startsWith('/') ? '' : '/'}${emp.profilePic || emp.profilePicture}`}
                          alt={name}
                          className="w-10 h-10 rounded-xl object-cover ring-2 ring-white shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-sm font-black shadow-sm ring-2 ring-white">
                          {name.charAt(0)}
                        </div>
                      )}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${activeTab === 'onLeave' ? 'bg-amber-400' : 'bg-blue-500'}`}>
                        {activeTab === 'onLeave' ? <Plane size={8} className="text-white" /> : <MessageSquare size={8} className="text-white" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">{name}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{type} • {activeTab === 'onLeave' ? 'Away' : 'Requested'}</p>
                    </div>
                  </div>
                  <Link
                    to="/hr/leave-approvals"
                    className="opacity-0 group-hover:opacity-100 transition-all w-8 h-8 rounded-lg bg-white border border-gray-100 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white shadow-sm"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Link */}
      <Link to="/hr/leave-approvals" className="p-3 text-center border-t border-gray-50 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-all">
        Manage All Leaves
      </Link>
    </div>
  );
};

export default WorkforceStatus;

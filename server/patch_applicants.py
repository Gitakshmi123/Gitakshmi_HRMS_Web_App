import sys

path = 'D:/Project/GT_HRMS/client/src/pages/HR/Applicants.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix 'Applied' tab logic
old_filter = '''        if (selectedReqId === 'all') {
            // Global Pipeline: Cumulative show in 'Applied'
            if (activeTab === 'Finalized') {
                return filtered.filter(a => isFinalizedStatus(a.status));
            }
            if (activeTab === 'Rejected') {
                return filtered.filter(a => a?.status === 'Rejected');
            }

            // Show all positive applications in 'Applied' tab
            return filtered.filter(a => a?.status !== 'Rejected');
        }

        // Specific Job Workflow: CUMULATIVE Visibility
        return filtered.filter(a => {
            // Exclude Rejected candidates from all rounds except Rejected tab
            if (a.status === 'Rejected' && activeTab !== 'Rejected') {
                return false;
            }
            if (activeTab === 'Rejected') {
                return a.status === 'Rejected';
            }'''

new_filter = '''        if (selectedReqId === 'all') {
            // Global Pipeline: Cumulative show in 'Applied'
            if (activeTab === 'Finalized') {
                return filtered.filter(a => isFinalizedStatus(a.status));
            }
            if (activeTab === 'Rejected') {
                return filtered.filter(a => a?.status === 'Rejected');
            }

            // Show all positive applications in 'Applied' tab
            return filtered.filter(a => a?.status !== 'Rejected' && !isFinalizedStatus(a.status));
        }

        // Specific Job Workflow: CUMULATIVE Visibility
        return filtered.filter(a => {
            // Exclude Rejected candidates from all rounds except Rejected tab
            if (a.status === 'Rejected' && activeTab !== 'Rejected') {
                return false;
            }
            if (activeTab === 'Rejected') {
                return a.status === 'Rejected';
            }
            // Exclude Finalized candidates from all earlier rounds
            if (isFinalizedStatus(a.status) && activeTab !== 'Finalized') {
                return false;
            }'''

content = content.replace(old_filter, new_filter)

# 2. Add 'Activity' tab logic to candidate modal
old_tabs = '''                                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                    {selectedApplicant.employeeId && (
                                        <div className="flex bg-slate-200/50 p-1 rounded-xl mr-4">
                                            <button
                                                onClick={() => setModalActiveTab('Resume')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${modalActiveTab === 'Resume' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Resume
                                            </button>
                                            <button
                                                onClick={() => setModalActiveTab('Onboarding')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${modalActiveTab === 'Onboarding' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Onboarding Profile
                                            </button>
                                        </div>
                                    )}
                                    <button'''

new_tabs = '''                                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                    <div className="flex bg-slate-200/50 p-1 rounded-xl mr-4">
                                        <button
                                            onClick={() => setModalActiveTab('Resume')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${modalActiveTab === 'Resume' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Resume
                                        </button>
                                        <button
                                            onClick={() => setModalActiveTab('Activity')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${modalActiveTab === 'Activity' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Activity Log
                                        </button>
                                        {selectedApplicant.employeeId && (
                                            <button
                                                onClick={() => setModalActiveTab('Onboarding')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${modalActiveTab === 'Onboarding' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Onboarding Profile
                                            </button>
                                        )}
                                    </div>
                                    <button'''

content = content.replace(old_tabs, new_tabs)


old_tab_content = '''                                    {modalActiveTab === 'Resume' ? (
                                        <div className="h-full rounded-2xl overflow-hidden border-2 border-slate-200/50 bg-slate-100 flex flex-col shadow-inner">'''

new_tab_content = '''                                    {modalActiveTab === 'Activity' ? (
                                        <div className="h-full overflow-y-auto p-6 lg:p-8 bg-slate-50 rounded-2xl border-2 border-slate-200/50 shadow-inner">
                                            <div className="max-w-2xl mx-auto">
                                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-8">
                                                    <List size={22} className="text-blue-500" /> Activity Log
                                                </h3>
                                                <div className="relative border-l-2 border-blue-100 ml-4 space-y-8">
                                                    {selectedApplicant.statusHistory && selectedApplicant.statusHistory.length > 0 ? (
                                                        [...selectedApplicant.statusHistory].reverse().map((log, index) => (
                                                            <div key={index} className="relative pl-6">
                                                                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-sm"></div>
                                                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                                                            Moved to <span className="text-blue-600">{log.to}</span>
                                                                        </h4>
                                                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded">
                                                                            {new Date(log.timestamp).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    {log.from && (
                                                                        <p className="text-xs text-slate-500 font-medium mb-1">
                                                                            Previous Phase: <span className="line-through opacity-70">{log.from}</span>
                                                                        </p>
                                                                    )}
                                                                    {log.reason && (
                                                                        <div className="mt-2 text-sm text-slate-700 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 italic">
                                                                            "{log.reason}"
                                                                        </div>
                                                                    )}
                                                                    {log.changedBy && (
                                                                        <p className="text-xs font-semibold text-slate-400 mt-3 text-right">
                                                                            — By {log.changedBy}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-sm text-slate-500 font-medium italic pl-4">No activity log found for this candidate.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : modalActiveTab === 'Resume' ? (
                                        <div className="h-full rounded-2xl overflow-hidden border-2 border-slate-200/50 bg-slate-100 flex flex-col shadow-inner">'''

content = content.replace(old_tab_content, new_tab_content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched Applicants.jsx successfully")

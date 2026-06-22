const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'client', 'src', 'pages', 'HR', 'LeavePolicies.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Target the entire broken section
const brokenStartStr = "    const totalPolicies = policies.length;\r\n    const activePolicies = policies.filter(p => p.isActive).length;\r\n    const totalRules = policies.reduce((acc, p) => acc + (p.rules?.length || 0), 0);\r\n\r\n    return (\r\n                            >";
const targetStartIdx = content.indexOf(brokenStartStr);

if (targetStartIdx === -1) {
    // Try with unix newlines
    const brokenStartStrUnix = "    const totalPolicies = policies.length;\n    const activePolicies = policies.filter(p => p.isActive).length;\n    const totalRules = policies.reduce((acc, p) => acc + (p.rules?.length || 0), 0);\n\n    return (\n                            >";
    const targetIdxUnix = content.indexOf(brokenStartStrUnix);
    if (targetIdxUnix !== -1) {
        console.log("Found broken start index (Unix)!");
    } else {
        console.log("Could not find broken start string in LeavePolicies.jsx");
        process.exit(1);
    }
} else {
    console.log("Found broken start index (Windows)!");
}

// Let's replace the broken block by matching from 'totalRules = ...' to the map call.
// Let's find:
// 'return ('
// and replace up to:
// '}).map(tab => ('
const mapIndex = content.indexOf("}).map(tab => (", targetStartIdx !== -1 ? targetStartIdx : content.indexOf("const totalPolicies = policies.length;"));
console.log("Map index:", mapIndex);

if (mapIndex === -1) {
    console.error("Could not find map function call after broken block");
    process.exit(1);
}

const beforePart = content.slice(0, content.indexOf("return (", targetStartIdx !== -1 ? targetStartIdx : content.indexOf("const totalPolicies = policies.length;")));
const afterPart = content.slice(mapIndex);

const correctHeaderAndTabs = `return (
        <div className={\`\${showModal ? 'h-full' : 'p-2.5 space-y-3'} animate-in fade-in duration-500\`}>
            {/* ── Top Header Section (Hidden when form is shown) ─────────────────────────── */}
            {!showModal && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            {mode === 'config' ? 'Leave Configuration' : 'Leave Master'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {view === 'policies' && (
                            <button
                                onClick={fetchPolicies}
                                className="flex items-center justify-center w-10 h-10 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl transition-all hover:shadow-md"
                                title="Refresh Policies"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        )}
                        
                        {view === 'policies' && mode === 'config' && (
                            <Can module="leave.policies" action="create">
                                <button
                                    onClick={handleCreateNew}
                                    className="flex items-center gap-2 h-12 px-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-200"
                                >
                                    <Plus size={16} strokeWidth={3} />
                                    New Policy
                                </button>
                            </Can>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab Navigation ────────────────────────────────────────── */}
            {!showModal && (
                <div className="flex border-b border-slate-200 mb-6 bg-white p-1 rounded-xl shadow-sm gap-2 max-w-fit flex-wrap">
                    {[
                        { id: 'leavetypes', label: '1. Leave Types' },
                        { id: 'leaveformulas', label: '2. Leave Formulas' },
                        { id: 'leavegroups', label: '3. Group Assignment' },
                        { id: 'policies', label: 'Leave Policies', count: totalPolicies },
                        { id: 'custom', label: 'Policy Mapping', count: mappings.length },
                        { id: 'holiday', label: 'Holiday Master' },
                        { id: 'opening', label: 'Opening Balance' },
                        { id: 'requests', label: 'Leave Requests' },
                        { id: 'ledger', label: 'Leave Ledger' },
                        { id: 'compoff', label: 'Comp Off' },
                        { id: 'encashment', label: 'Encashment' },
                        { id: 'analytics', label: 'Analytics & Reports' },
                        { id: 'settings', label: 'Settings' }
                    ].filter(tab => {
                        if (mode === 'config') {
                            return ['leavetypes', 'leaveformulas', 'leavegroups', 'holiday', 'opening', 'requests', 'ledger', 'compoff', 'encashment', 'analytics', 'settings'].includes(tab.id);
                        } else {
                            return ['policies', 'custom'].includes(tab.id);
                        }
                    }).`;

const newContent = beforePart + correctHeaderAndTabs + afterPart;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Successfully patched LeavePolicies.jsx header and tabs navigation!");

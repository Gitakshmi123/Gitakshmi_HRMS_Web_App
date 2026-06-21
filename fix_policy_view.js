const fs = require('fs');
const path = 'c:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/HR/LeavePolicies.jsx';
let content = fs.readFileSync(path, 'utf8');

// ── 1. Replace broken PolicyCard (lines 105 onwards) up to CustomMappingsPanel ──
// Find the start marker
const cardStart = content.indexOf('function PolicyCard(');
// Find end: where CustomMappingsPanel begins
const mappingsStart = content.indexOf('// ─── Custom Mappings Panel');

if (cardStart === -1 || mappingsStart === -1) {
    console.error('Could not locate PolicyCard or CustomMappingsPanel markers');
    process.exit(1);
}

const before = content.slice(0, cardStart);
const after = content.slice(mappingsStart);

const newPolicyCard = `function PolicyCard({ p, onView, onEdit, onSync, onDelete, onToggle }) {
    const activeRules = p.rules?.length || 0;
    
    return (
        <div 
            onClick={() => onView(p)}
            className={clsx(
                "bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all duration-300 flex flex-col group overflow-hidden",
                !p.isActive && "opacity-80 grayscale-[0.3]"
            )}
        >
            <div className="pt-3 pb-2 px-4 flex-1">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <div className={clsx(
                            "w-7 h-7 rounded-lg flex items-center justify-center border shadow-sm shrink-0 transition-all group-hover:scale-110",
                            p.isActive ? "bg-slate-100 border-slate-200 text-slate-900" : "bg-slate-50 border-slate-100 text-slate-400"
                        )}>
                            {p.applicableTo === 'All' ? <Users size={14} /> : <ShieldCheck size={14} />}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[10px] font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate leading-tight">
                                {p.name}
                            </h3>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Scope:</span>
                                <span className="text-[6px] font-black text-slate-900 uppercase tracking-widest bg-slate-100/50 px-1.5 py-0.2 rounded-full border border-slate-200/50">
                                    {p.applicableTo === 'Specific' ? 'Personal' : (p.applicableTo === 'Intern' ? 'Interns' : (p.applicableTo === 'Band' ? \`Bands: \${p.applicableBands?.length || 0}\` : (p.applicableTo === 'JobType' ? 'Job Type' : (p.applicableTo === 'Grade' ? \`Grades: \${(p.gradeCodes?.length || 0) + (p.gradeIds?.length || 0)}\` : p.applicableTo))))}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={clsx(
                        "w-1 h-1 rounded-full border border-white shadow-sm",
                        p.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                    )} />
                </div>

                {/* Rules List */}
                <div className="space-y-1">
                    {activeRules === 0 ? (
                        <div className="text-center py-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Baseline Only</p>
                        </div>
                    ) : (
                        (p.rules || []).map((r, i) => (
                            <div key={i} className="space-y-0.5 group/rule">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <div className="w-0.5 h-2 rounded-full" style={{ backgroundColor: r.color || '#3b82f6' }} />
                                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-tight">{r.leaveType}</span>
                                    </div>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-[10px] font-black text-slate-900">{r.totalPerYear}</span>
                                        <span className="text-[6px] text-slate-400 font-bold uppercase tracking-tighter">D</span>
                                    </div>
                                </div>
                                
                                <div className="h-0.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/30">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000" 
                                        style={{ 
                                            width: '100%',
                                            backgroundColor: r.color || '#3b82f6',
                                            opacity: 0.8
                                        }} 
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div 
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-1.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between"
            >
                <div className="flex gap-1">
                    <Can module="leave.policies" action="update">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(p); }} className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-90" title="Edit Policy">
                            <Edit2 size={10} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onSync(p._id || p.id); }} className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm active:scale-90" title="Sync to employees">
                            <RefreshCw size={10} />
                        </button>
                    </Can>
                    <Can module="leave.policies" action="delete">
                        <button onClick={(e) => { e.stopPropagation(); onDelete(p._id || p.id); }} className="w-6 h-6 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all shadow-sm active:scale-90">
                            <Trash2 size={10} />
                        </button>
                    </Can>
                </div>

                <Can module="leave.policies" action="update">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggle(p, p.isActive); }}
                        className={clsx(
                            "flex items-center gap-1 h-6 px-2 rounded-md text-[7px] font-black uppercase tracking-widest transition-all active:scale-95",
                            p.isActive ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        {p.isActive ? (
                            <>
                                <Check size={8} strokeWidth={4} />
                                Active
                            </>
                        ) : (
                            <>
                                <Plus size={8} strokeWidth={4} />
                                Enable
                            </>
                        )}
                    </button>
                </Can>
            </div>
        </div>
    );
}


// ─── Policy Detail View (Read-Only) ────────────────────────────────────────────
function PolicyDetailView({ policy, onClose, onEdit }) {
    if (!policy) return null;

    const scopeLabel = () => {
        switch (policy.applicableTo) {
            case 'Specific': return 'Specific Employee';
            case 'Intern': return 'Interns Only';
            case 'Band': return \`Bands (\${policy.applicableBands?.join(', ') || 'None'})\`;
            case 'JobType': return 'Job Type Based';
            case 'Grade': return \`Grades (\${[...(policy.gradeCodes || []), ...(policy.gradeIds?.map(g => g?.code || g) || [])].join(', ') || 'None'})\`;
            default: return 'All Employees';
        }
    };

    const InfoRow = ({ label, value, highlight }) => (
        <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex-none w-36">{label}</span>
            <span className={\`text-[11px] font-bold text-right \${highlight ? 'text-blue-700' : 'text-slate-800'}\`}>{value || '—'}</span>
        </div>
    );

    const Badge = ({ children, color = 'slate' }) => {
        const colors = {
            slate: 'bg-slate-100 text-slate-700 border-slate-200',
            blue: 'bg-blue-50 text-blue-700 border-blue-100',
            emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            amber: 'bg-amber-50 text-amber-700 border-amber-100',
            rose: 'bg-rose-50 text-rose-700 border-rose-100',
            violet: 'bg-violet-50 text-violet-700 border-violet-100',
        };
        return (
            <span className={\`inline-flex items-center text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border \${colors[color] || colors.slate}\`}>
                {children}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-screen max-h-[calc(100vh-62px)] bg-slate-50 animate-in fade-in duration-300 overflow-hidden">
            {/* Header */}
            <div className="flex-none h-14 px-8 border-b border-slate-100 flex items-center justify-between bg-white shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white shadow-sm">
                        <FileText size={15} />
                    </div>
                    <div>
                        <h2 className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-none">{policy.name}</h2>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{policy.policyId || 'No Policy ID'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Can module="leave.policies" action="update">
                        <button
                            onClick={() => { onClose(); onEdit(policy); }}
                            className="flex items-center gap-1.5 h-8 px-4 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm"
                        >
                            <Edit2 size={11} />
                            Edit Policy
                        </button>
                    </Can>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all group"
                    >
                        <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-8 space-y-6">

                    {/* Status Banner */}
                    <div className={\`flex items-center gap-3 px-5 py-3 rounded-2xl border \${policy.isActive ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-100 border-slate-200'}\`}>
                        <div className={\`w-2.5 h-2.5 rounded-full \${policy.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}\`} />
                        <span className={\`text-[10px] font-black uppercase tracking-widest \${policy.isActive ? 'text-emerald-700' : 'text-slate-600'}\`}>
                            {policy.isActive ? 'Policy is Active & Enforced' : 'Policy is Currently Inactive'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: Policy Info */}
                        <div className="space-y-4">
                            {/* Basic Details */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Policy Details</h3>
                                <div className="space-y-0">
                                    <InfoRow label="Policy Name" value={policy.name} highlight />
                                    <InfoRow label="Policy ID / Code" value={policy.policyId} />
                                    <InfoRow label="Scope / Audience" value={scopeLabel()} />
                                    <InfoRow label="Template Type" value={policy.templateType || 'Custom Policy'} />
                                    {policy.effectiveFrom && (
                                        <InfoRow label="Effective From" value={new Date(policy.effectiveFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                                    )}
                                    {policy.expiryDate && (
                                        <InfoRow label="Expiry Date" value={new Date(policy.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                                    )}
                                </div>
                            </div>

                            {/* Applicability */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Applicability</h3>
                                <div className="space-y-3">
                                    {policy.departmentIds?.length > 0 && (
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Departments</p>
                                            <div className="flex flex-wrap gap-1">
                                                {policy.departmentIds.map((d, i) => (
                                                    <Badge key={i} color="blue">{d?.name || d?.code || d}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {policy.branchIds?.length > 0 && (
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Branches</p>
                                            <div className="flex flex-wrap gap-1">
                                                {policy.branchIds.map((b, i) => (
                                                    <Badge key={i} color="violet">{b?.name || b?.code || b}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {policy.designations?.length > 0 && (
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Designations</p>
                                            <div className="flex flex-wrap gap-1">
                                                {policy.designations.map((d, i) => (
                                                    <Badge key={i} color="amber">{d}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {policy.gradeCodes?.length > 0 && (
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grades</p>
                                            <div className="flex flex-wrap gap-1">
                                                {policy.gradeCodes.map((g, i) => (
                                                    <Badge key={i} color="slate">{g}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {!policy.departmentIds?.length && !policy.branchIds?.length && !policy.designations?.length && !policy.gradeCodes?.length && (
                                        <p className="text-[10px] text-slate-400 italic">Applies to all — no specific filters set</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Leave Rules */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                Leave Rules ({policy.rules?.length || 0})
                            </h3>
                            {!policy.rules?.length ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 border border-slate-100">
                                        <List size={20} className="text-slate-300" />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400">No leave rules configured</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {policy.rules.map((rule, i) => (
                                        <div key={i} className="rounded-xl border border-slate-100 overflow-hidden hover:shadow-sm transition-all">
                                            <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: \`\${rule.color || '#4f46e5'}12\`, borderBottom: \`1px solid \${rule.color || '#4f46e5'}20\` }}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rule.color || '#4f46e5' }} />
                                                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{rule.leaveType}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[16px] font-black text-slate-900">{rule.totalPerYear}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Days/yr</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 px-4 py-2.5 bg-white">
                                                {rule.monthlyAccrual && <Badge color="blue">Accrual ({rule.monthlyAccrualRate || '?'}/mo)</Badge>}
                                                {rule.carryForwardAllowed && <Badge color="emerald">CF (Max: {rule.maxCarryForward})</Badge>}
                                                {!rule.allowDuringProbation && <Badge color="amber">No Probation</Badge>}
                                                {rule.halfDayAllowed && <Badge color="violet">Half-Day</Badge>}
                                                {rule.encashmentAllowed && <Badge color="amber">Encashable</Badge>}
                                                {rule.requiresApproval && <Badge color="slate">Approval Required</Badge>}
                                                {rule.postFactoAllowed && <Badge color="rose">Post-Facto</Badge>}
                                                {rule.applicableGender && rule.applicableGender !== 'All' && <Badge color="rose">{rule.applicableGender} Only</Badge>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


`;

const newContent = before + newPolicyCard + after;
fs.writeFileSync(path, newContent, 'utf8');
console.log('PolicyCard + PolicyDetailView written. Lines:', newContent.split('\n').length);

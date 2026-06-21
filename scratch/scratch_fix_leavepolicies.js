const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/HR/LeavePolicies.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// We search for:
// ) : (
// <button type="button" onClick={() => removeRule(i)} ...>
// <Trash2 ... />
// </button>
// </div>
// </div>
// <div className="flex flex-wrap gap-1.5 mt-3 border-t border-slate-50 pt-2">
// {r.accrualType === 'monthly' || r.monthlyAccrual ? (

const regex = /\)\s*:\s*\(\s*<button\s+type="button"\s+onClick=\{\(\)\s*=>\s*removeRule\(i\)\}\s+className="w-8\s+h-8\s+flex\s+items-center\s+justify-center\s+rounded-lg\s+hover:bg-rose-50\s+text-slate-400\s+hover:text-rose-600\s+transition-all"\s+title="Delete\s+Rule">\s*<Trash2\s+size=\{15\}\s*\/>\s*<\/button>\s*<\/div>\s*<\/div>\s*<div\s+className="flex\s+flex-wrap\s+gap-1\.5\s+mt-3\s+border-t\s+border-slate-50\s+pt-2">\s*\{r\.accrualType\s*===\s*'monthly'\s*\|\|\s*r\.monthlyAccrual\s*\?\s*\(/;

if (regex.test(content)) {
    console.log("Match found!");
    const replacement = `) : (
                                                 (form.rules || []).map((r, i) => (
                                                     <div key={i} className="group border border-slate-100 rounded-xl p-3.5 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition-all shadow-sm hover:shadow-md">
                                                         <div className="flex items-center justify-between">
                                                             <div className="flex items-center gap-2">
                                                                 <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color || '#3b82f6' }} />
                                                                 <span className="text-xs font-black uppercase tracking-wider text-slate-700">{r.leaveType}</span>
                                                                 <span className="text-[10px] font-bold text-slate-400">Total: {r.totalPerYear} Days</span>
                                                             </div>
                                                             <div className="flex items-center gap-1">
                                                                 <button type="button" onClick={() => removeRule(i)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all" title="Delete Rule">
                                                                     <Trash2 size={15} />
                                                                 </button>
                                                             </div>
                                                         </div>
                                                         <div className="flex flex-wrap gap-1.5 mt-3 border-t border-slate-50 pt-2">
                                                             {r.accrualDependsOnAttendance && (
                                                                 <span className="text-[8px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                                     Attendance-Based ({(r.accrualSlabs || []).length > 0 ? r.accrualSlabs.map(s => \`>=\${s.minAttendanceDays}d → \${s.creditDays}\`).join(', ') : \`>=\${r.minAttendanceDays || 20}d → \${r.monthlyAccrualRate || 1.75}\`})
                                                                 </span>
                                                             )}
                                                             {r.accrualType === 'monthly' || r.monthlyAccrual ? (`;
    
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Replacement successful!");
} else {
    console.error("Match NOT found in LeavePolicies.jsx!");
}

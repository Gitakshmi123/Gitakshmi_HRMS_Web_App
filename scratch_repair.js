const fs = require('fs');
const filePath = 'c:/Users/user/Documents/GitHub/Gitakshmi_HRMS_Web_App/client/src/pages/HR/LeavePolicies.jsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const statCardStart = lines.findIndex(l => l.includes('function StatCard({ label, value, icon, iconColor, iconBg }) {'));
const policyCardStart = lines.findIndex(l => l.includes('function PolicyCard({ p, onEdit, onSync, onDelete, onToggle }) {'));

const pristineStatCard = `function StatCard({ label, value, icon, iconColor, iconBg }) {
    return (
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="flex items-center gap-3 relative z-10">
                <div className={\`w-10 h-10 \${iconBg} \${iconColor} rounded-xl flex items-center justify-center border border-current opacity-20 group-hover:opacity-100 group-hover:bg-current group-hover:text-white transition-all duration-300\`}>
                    {icon && React.isValidElement(icon)
                        ? React.cloneElement(icon, { size: 18 })
                        : null}
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                    <h3 className="text-xl font-black text-slate-900 leading-none">{value}</h3>
                </div>
            </div>
        </div>
    );
}

// ─── Policy Card ────────────────────────────────────────────────────────────────`;

lines.splice(statCardStart, policyCardStart - statCardStart, pristineStatCard);

fs.writeFileSync(filePath, lines.join('\n'));

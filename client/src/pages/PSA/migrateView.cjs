const fs = require('fs');
const path = require('path');

const file_path = path.join('d:', 'new hrms', 'Gitakshmi_HRMS_Web_App', 'client', 'src', 'pages', 'PSA', 'ViewCompany.jsx');
let content = fs.readFileSync(file_path, 'utf8');

// 1. Change grid to multi-column
content = content.replace('<div className="grid grid-cols-1 gap-2.5">', '<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">');

const newFields = `
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Phone</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Zap size={14} className="text-emerald-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.phone || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Website</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Package size={14} className="text-indigo-500" />
                                                <span className="text-[11px] font-bold text-slate-700 truncate">{company.meta?.website || company.domain || company.website || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Company Type</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Users size={14} className="text-blue-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.type || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Reg No</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Fingerprint size={14} className="text-indigo-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.regNo || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">TAN / CIN</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Fingerprint size={14} className="text-blue-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.tan || '-'} / {company.meta?.cin || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">MSME / Udyam</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Shield size={14} className="text-emerald-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.msme || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">EPF / ESIC</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Shield size={14} className="text-emerald-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.epf || '-'} / {company.meta?.esic || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">PT / LWF</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Shield size={14} className="text-emerald-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.pt || '-'} / {company.meta?.lwf || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Date of Incorporation</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Calendar size={14} className="text-rose-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.dateOfIncorporation || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Sub-Company Limit</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Users size={14} className="text-indigo-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.subCompanyLimit || '0'} Max</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Timezone / Currency</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <MapPin size={14} className="text-indigo-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.timezone || '-'} | {company.meta?.currency || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">FY Start Month</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Calendar size={14} className="text-rose-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.fyStartMonth || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Industry</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Package size={14} className="text-indigo-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.industry || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Signatory Name</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Users size={14} className="text-emerald-500" />
                                                <span className="text-[11px] font-bold text-slate-700 truncate">{company.meta?.signatoryName || '-'} ({company.meta?.signatoryDesignation || '-'})</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Coordinates</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <MapPin size={14} className="text-blue-500" />
                                                <span className="text-[11px] font-bold text-slate-700 truncate">{company.meta?.latitude || '-'}, {company.meta?.longitude || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Geofence Radius</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <MapPin size={14} className="text-blue-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.geofenceRadius || '50'} meters</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Office Floor</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <MapPin size={14} className="text-blue-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.officeFloor || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Holographic Profile Card Condensed */}`;

content = content.replace('                                    </div>\n                                    \n                                    {/* Holographic Profile Card Condensed */}', newFields);

fs.writeFileSync(file_path, content);
console.log('ViewCompany.jsx updated successfully.');

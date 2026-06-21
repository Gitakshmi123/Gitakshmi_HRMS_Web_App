import React from 'react';
import { Plus, Trash2, IndianRupee, Upload, Check, CheckCircle, Briefcase, AlertCircle } from 'lucide-react';
import { TabularContainer, TabularRow, TabularField } from './TabularForm';

const EmploymentHistoryTab = ({ experience, setExperience, errors }) => {
  const addEntry = () => {
    setExperience([
      ...experience,
      {
        companyName: '',
        employmentType: 'Full Time',
        from: '',
        to: '',
        lastDrawnSalary: '',
        reasonForLeaving: '',
        reportingPersonName: '',
        reportingPersonEmail: '',
        reportingPersonContact: '',
        payslips: [],
        experienceCertificateUrl: null
      }
    ]);
  };

  const removeEntry = (idx) => {
    setExperience(experience.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx, field, value) => {
    const copy = [...experience];
    copy[idx][field] = value;
    setExperience(copy);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div className="flex items-center gap-3 border-l-[3px] border-[#1e293b] pl-3">
          <div className="w-9 h-9 rounded-lg bg-[#1e293b]/10 flex items-center justify-center text-[#1e293b]">
            <Briefcase size={18} />
          </div>
          <div className="flex items-center">
            <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">Employment History</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={addEntry}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#0D9488] shadow-md active:scale-95 transition-all"
          >
            <Plus size={20} />
            Add Entry
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {experience.map((exp, idx) => (
          <TabularContainer key={idx} className="relative">
            <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="uppercase">Entry #{idx + 1}</span>
              <button
                type="button"
                onClick={() => removeEntry(idx)}
                className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded transition-colors flex items-center gap-1"
                title="Remove Entry"
              >
                <Trash2 size={14} />
                <span className="text-[10px]">REMOVE</span>
              </button>
            </div>

            <TabularRow columns={2}>
              <TabularField label="ORGANIZATION NAME" required>
                <input value={exp.companyName || ''} onChange={e => updateEntry(idx, 'companyName', e.target.value)} className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400" placeholder="Former employer" />
              </TabularField>
              <TabularField label="EMPLOYMENT TYPE">
                <select value={exp.employmentType || 'Full Time'} onChange={e => updateEntry(idx, 'employmentType', e.target.value)} className="w-full h-[38px] px-3 bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-0">
                  <option value="Full Time">Full Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </TabularField>
            </TabularRow>

            <TabularRow columns={4}>
              <TabularField label="SERVICE START">
                <input type="date" value={exp.from ? new Date(exp.from).toISOString().split('T')[0] : ''} onChange={e => updateEntry(idx, 'from', e.target.value)} className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 text-slate-700 dark:text-slate-200" />
              </TabularField>
              <TabularField label="SERVICE END">
                <input type="date" value={exp.to ? new Date(exp.to).toISOString().split('T')[0] : ''} onChange={e => updateEntry(idx, 'to', e.target.value)} className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 text-slate-700 dark:text-slate-200" />
              </TabularField>
              <TabularField label="LAST ANNUAL COMPENSATION">
                <div className="relative flex items-center h-[38px]">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <IndianRupee size={14} />
                  </div>
                  <input type="number" value={exp.lastDrawnSalary || ''} onChange={e => updateEntry(idx, 'lastDrawnSalary', e.target.value)} className="w-full h-[38px] pl-8 pr-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400" placeholder="0.00" />
                </div>
              </TabularField>
              <TabularField label="REASON FOR LEAVING">
                <input value={exp.reasonForLeaving || ''} onChange={e => updateEntry(idx, 'reasonForLeaving', e.target.value)} className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400" placeholder="e.g. Career growth" />
              </TabularField>
            </TabularRow>

            <TabularRow columns={3}>
              <TabularField label="REPORTING MANAGER NAME">
                <input value={exp.reportingPersonName || ''} onChange={e => updateEntry(idx, 'reportingPersonName', e.target.value)} className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400" placeholder="Manager Name" />
              </TabularField>
              <TabularField label="REPORTING MANAGER EMAIL">
                <input value={exp.reportingPersonEmail || ''} onChange={e => updateEntry(idx, 'reportingPersonEmail', e.target.value)} className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400" placeholder="Manager Email" />
              </TabularField>
              <TabularField label="REPORTING MANAGER PHONE">
                <input value={exp.reportingPersonContact || ''} onChange={e => updateEntry(idx, 'reportingPersonContact', e.target.value)} className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400" placeholder="Manager Phone" />
              </TabularField>
            </TabularRow>

            <TabularRow columns={2}>
              <TabularField label="HISTORICAL PAYSLIPS (LAST 3)">
                <div className="flex gap-2 h-[38px] items-center px-2">
                  {[0, 1, 2].map(i => (
                    <label key={i} className={`flex-1 flex items-center justify-center h-[30px] rounded cursor-pointer transition-all border ${exp.payslips && exp.payslips[i] ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/20 dark:border-indigo-500/30' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}>
                      {exp.payslips && exp.payslips[i] ? <Check size={14} /> : <Upload size={14} />}
                      <input type="file" className="hidden" onChange={e => { const copy = [...experience]; if (!copy[idx].payslips) copy[idx].payslips = []; copy[idx].payslips[i] = e.target.files[0]; setExperience(copy); }} />
                    </label>
                  ))}
                </div>
              </TabularField>
              <TabularField label="EXPERIENCE CERTIFICATE">
                <div className="h-[38px] flex items-center px-2">
                  <label className={`w-full flex items-center justify-center h-[30px] rounded cursor-pointer transition-all border ${exp.experienceCertificateUrl ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/20 dark:border-indigo-500/30' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'}`}>
                    <div className="flex items-center gap-1.5">
                      {exp.experienceCertificateUrl ? <CheckCircle size={14} /> : <Upload size={14} />}
                      <span className="text-[10px] font-bold">{exp.experienceCertificateUrl ? 'Uploaded' : 'Upload PDF'}</span>
                    </div>
                    <input type="file" className="hidden" onChange={e => updateEntry(idx, 'experienceCertificateUrl', e.target.files[0])} />
                  </label>
                </div>
              </TabularField>
            </TabularRow>

            {errors[`exp_${idx}`] && (
              <div className="p-3 bg-rose-50 border-t border-rose-100 text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                <AlertCircle size={14} /> {errors[`exp_${idx}`]}
              </div>
            )}
          </TabularContainer>
        ))}
      </div>
    </div>
  );
};

export default EmploymentHistoryTab;

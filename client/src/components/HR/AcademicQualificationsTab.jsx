import React, { useRef } from 'react';
import { Plus, Trash2, FileCheck, Upload, Award } from 'lucide-react';
import { TabularContainer, TabularRow, TabularField } from './TabularForm';

const QUALIFICATION_OPTIONS = [
  '10th Standard',
  '12th Standard',
  'Diploma',
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'Ph.D.',
  'Other'
];

const MODE_OPTIONS = [
  'Regular',
  'Distance',
  'Online',
  'Correspondence'
];

export default function AcademicQualificationsTab({
  academicQualifications = [],
  setAcademicQualifications,
  highestQualification,
  setHighestQualification,
  errors = {}
}) {
  const fileInputRefs = useRef([]);

  const addRow = () => {
    setAcademicQualifications([
      ...academicQualifications,
      {
        id: Date.now().toString(),
        qualification: '',
        universityBoard: '',
        yearOfPassing: '',
        percentageCgpa: '',
        mode: 'Regular',
        document: null,
        documentUrl: ''
      }
    ]);
  };

  const removeRow = (index) => {
    const updated = [...academicQualifications];
    const removedRow = updated[index];
    updated.splice(index, 1);
    setAcademicQualifications(updated);

    // If we remove the highest qualification, reset highestQualification state
    if (highestQualification === removedRow.id) {
      setHighestQualification('');
    }
  };

  const updateRow = (index, field, value) => {
    const updated = [...academicQualifications];
    updated[index][field] = value;
    setAcademicQualifications(updated);
  };

  const handleFileChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      updateRow(index, 'document', file);
      // clear doc URL since we have a new file
      updateRow(index, 'documentUrl', '');
    }
  };

  const triggerFileInput = (index) => {
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index].click();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Award size={18} />
          </div>
          <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">
            Academic Qualifications
          </h3>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={14} /> Add Qualification
        </button>
      </div>

      {academicQualifications.length === 0 ? (
        <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500 text-sm font-medium">No academic qualifications added. Click "Add Qualification" to begin.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {academicQualifications.map((row, index) => {
            const rowId = row.id || index.toString();
            return (
              <TabularContainer key={rowId} className="relative">
                <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="uppercase">Qualification #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded transition-colors flex items-center gap-1"
                    title="Remove Qualification"
                  >
                    <Trash2 size={14} />
                    <span className="text-[10px]">REMOVE</span>
                  </button>
                </div>
                
                <TabularRow columns={4}>
                  <TabularField label="IS HIGHEST QUALIFICATION">
                    <label className="flex items-center gap-2 cursor-pointer h-[38px] px-3">
                      <input
                        type="radio"
                        name="highestQualification"
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600 dark:bg-slate-800 dark:border-slate-600 dark:checked:bg-indigo-600"
                        checked={highestQualification === rowId}
                        onChange={() => setHighestQualification(rowId)}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Yes, mark as highest</span>
                    </label>
                  </TabularField>
                  <TabularField label="QUALIFICATION" required>
                    <select
                      value={row.qualification}
                      onChange={(e) => updateRow(index, 'qualification', e.target.value)}
                      className="w-full h-[38px] px-3 bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-0"
                    >
                      <option value="">Select...</option>
                      {QUALIFICATION_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </TabularField>
                </TabularRow>

                <TabularRow columns={4}>
                  <TabularField label="UNIVERSITY/BOARD" required>
                    <input
                      type="text"
                      value={row.universityBoard}
                      onChange={(e) => updateRow(index, 'universityBoard', e.target.value)}
                      placeholder="Ex. CBSE, Mumbai Univ."
                      className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
                    />
                  </TabularField>
                  <TabularField label="YEAR OF PASSING" required>
                    <input
                      type="number"
                      value={row.yearOfPassing}
                      onChange={(e) => updateRow(index, 'yearOfPassing', e.target.value)}
                      placeholder="YYYY"
                      min="1950"
                      max={new Date().getFullYear()}
                      className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
                    />
                  </TabularField>
                </TabularRow>

                <TabularRow columns={4}>
                  <TabularField label="% / CGPA">
                    <input
                      type="text"
                      value={row.percentageCgpa}
                      onChange={(e) => updateRow(index, 'percentageCgpa', e.target.value)}
                      placeholder="%"
                      className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
                    />
                  </TabularField>
                  <TabularField label="MODE">
                    <select
                      value={row.mode}
                      onChange={(e) => updateRow(index, 'mode', e.target.value)}
                      className="w-full h-[38px] px-3 bg-transparent border-none outline-none text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-0"
                    >
                      {MODE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </TabularField>
                </TabularRow>

                <TabularRow columns={4}>
                  <TabularField label="DOCUMENT">
                    <div className="flex items-center gap-2 h-[38px] px-2">
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf"
                        ref={(el) => (fileInputRefs.current[index] = el)}
                        onChange={(e) => handleFileChange(index, e)}
                      />
                      <button
                        type="button"
                        onClick={() => triggerFileInput(index)}
                        className="px-2 py-1 h-7 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-xs font-bold flex items-center transition-colors border border-slate-200 dark:border-slate-700"
                      >
                        <Upload size={12} className="mr-1" /> Upload
                      </button>
                      {(row.document || row.documentUrl) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (row.documentUrl) window.open(row.documentUrl, '_blank');
                          }}
                          className={`px-2 py-1 h-7 rounded text-xs font-bold flex items-center transition-colors border ${row.documentUrl ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'}`}
                          title={row.document ? "File selected (not uploaded)" : "View Uploaded File"}
                        >
                          <FileCheck size={12} className="mr-1" /> {row.document ? 'Selected' : 'View'}
                        </button>
                      )}
                      {(row.document) && <div className="text-[10px] text-emerald-500 font-bold truncate max-w-[80px]" title={row.document.name}>{row.document.name}</div>}
                    </div>
                  </TabularField>
                  <TabularField label=""></TabularField>
                </TabularRow>
              </TabularContainer>
            );
          })}
        </div>
      )}
    </div>
  );
}

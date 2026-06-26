import React, { useState } from 'react';
import * as XLSX from '@sheetjs/xlsx';
import { X, Upload, Check, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import api from '../../utils/api';
import { showToast } from '../../utils/uiNotifications';

const CATEGORIES = [
  { value: 'EARNING', label: 'Earning' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'BENEFIT', label: 'Benefit' },
  { value: 'CORRECTION', label: 'Correction' }
];

const FIELD_MAPPINGS = {
  EARNING: {
    name: ['name', 'component name', 'earning name', 'component', 'salary component', 'particulars', 'salary head', 'head', 'description'],
    payslipName: ['payslip name', 'display name', 'short name', 'print name'],
    earningType: ['type', 'earning type', 'category'],
    payType: ['pay type', 'fixed/variable'],
    calculationType: ['calculation type', 'calc type', 'calculation', 'basis'],
    amount: ['amount', 'value', 'flat amount', 'monthly', 'monthly amount', 'rupees', 'rs'],
    percentage: ['percentage', '%', 'percent', 'pct']
  },
  DEDUCTION: {
    name: ['name', 'deduction name', 'component name'],
    category: ['category', 'type', 'pre/post tax'],
    amountType: ['amount type', 'value type', 'fixed/percentage'],
    amountValue: ['amount', 'value', 'deduction value'],
    calculationBase: ['calculation base', 'base', 'basic/gross'],
    recurring: ['recurring', 'is recurring', 'monthly']
  },
  BENEFIT: {
    name: ['name', 'benefit name', 'component name'],
    benefitType: ['benefit type', 'type'],
    payType: ['pay type', 'fixed/variable'],
    calculationType: ['calculation type', 'calc type'],
    value: ['value', 'amount', 'benefit value'],
    code: ['code', 'short code']
  }
};

export default function BulkUploadComponentsModal({ onRefresh, defaultCategory = 'EARNING' }) {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [category, setCategory] = useState(defaultCategory);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        
        let headerRowIndex = 0;
        let foundHeaders = false;
        
        for (let i = 0; i < rawData.length; i++) {
          const rowStr = rawData[i].map(c => String(c).toLowerCase()).join(' ');
          if (rowStr.includes('salary head') || rowStr.includes('component') || rowStr.includes('particulars') || rowStr.includes('earning name')) {
            headerRowIndex = i;
            foundHeaders = true;
            break;
          }
        }
        
        let sheetRows = [];
        let sheetHeaders = [];
        
        if (foundHeaders) {
          const rawHeaders = rawData[headerRowIndex];
          sheetHeaders = rawHeaders.map((h, i) => String(h).trim() || `__EMPTY_${i}`);
          
          for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (row.every(cell => !cell || String(cell).trim() === '')) continue;
            
            const obj = {};
            sheetHeaders.forEach((h, idx) => {
              if (!h.startsWith('__EMPTY_')) {
                obj[h] = row[idx];
              }
            });
            sheetRows.push(obj);
          }
          sheetHeaders = sheetHeaders.filter(h => !h.startsWith('__EMPTY_'));
          
          setHeaders(sheetHeaders);
          setData(sheetRows);
        } else {
          sheetRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (sheetRows.length > 0) {
            const headerSet = new Set();
            sheetRows.forEach(row => {
              Object.keys(row).forEach(k => headerSet.add(k));
            });
            sheetHeaders = Array.from(headerSet).filter(h => !h.startsWith('__EMPTY'));
            setHeaders(sheetHeaders);
            setData(sheetRows);
          } else {
            setHeaders([]);
            setData([]);
          }
        }
      } catch (err) {
        showToast('error', 'Error', 'Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.');
      } finally {
        setParsing(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleFileChange = (e) => {
    processFile(e.target.files[0]);
    e.target.value = ''; // Reset input to allow selecting the same file again
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const mapData = () => {
    const mapping = FIELD_MAPPINGS[category] || FIELD_MAPPINGS.EARNING;
    
    // First pass: extract raw values
    const initialMapped = data.map(row => {
      const mapped = { category };
      Object.keys(mapping).forEach(targetField => {
        const sourceHeader = headers.find(h =>
          mapping[targetField].includes(String(h || '').toLowerCase().trim())
        );
        if (sourceHeader) {
          mapped[targetField] = row[sourceHeader];
        }
      });
      
      // Smart Fallbacks
      if (!mapped.name && headers.length > 0) {
        mapped.name = row[headers[0]];
      }
      if (!mapped.payslipName && mapped.name) {
        mapped.payslipName = mapped.name;
      }

      // Auto-categorize based on intelligent keyword heuristics
      if (mapped.name) {
        const lowerName = mapped.name.toLowerCase();
        let autoCategory = category; // Default to active tab
        
        if (lowerName.includes('pf') || lowerName.includes('provident fund') || lowerName.includes('esic') || lowerName.match(/\besi\b/)) {
           if (lowerName.includes('employer') || lowerName.includes('firm')) {
               autoCategory = 'BENEFIT';
           } else {
               autoCategory = 'DEDUCTION';
           }
        } else if (lowerName.includes('tax') || lowerName.includes('tds') || lowerName.includes('premium')) {
           autoCategory = 'DEDUCTION';
        } else if (lowerName.includes('gratuity') || lowerName.includes('insurance')) {
           if (lowerName.includes('employee') || lowerName.includes('deduct')) {
               autoCategory = 'DEDUCTION';
           } else {
               autoCategory = 'BENEFIT';
           }
        } else if (lowerName.includes('allowance') || lowerName.includes('wage') || lowerName.includes('basic') || lowerName.includes('hra') || lowerName.includes('bonus') || lowerName.includes('encashment')) {
           autoCategory = 'EARNING';
        }
        mapped.category = autoCategory;
      }

      if (!mapped.earningType && mapped.category === 'EARNING') {
        mapped.earningType = 'Fixed';
      }
      if (mapped.amount) {
        // Handle cases where amount might be text like "CTC" or "10,000"
        const amtStr = String(mapped.amount).replace(/,/g, '');
        mapped.amount = parseFloat(amtStr) || amtStr;
      }
      if (mapped.percentage) {
        mapped.percentage = parseFloat(String(mapped.percentage).replace(/,/g, '').replace(/%/g, '')) || 0;
      }
      
      // Temporarily store original row for fallback processing
      mapped._originalRow = row;
      
      return mapped;
    });

    // Determine baseline amounts to infer percentages
    let ctcAmount = 0;
    let basicAmount = 0;

    initialMapped.forEach(mapped => {
      const nameLower = String(mapped.name || '').toLowerCase();
      const payslipLower = String(mapped.payslipName || '').toLowerCase();
      const amt = typeof mapped.amount === 'number' ? mapped.amount : 0;
      
      // Some excel sheets might put "CTC" in the amount column for the total row
      if (typeof mapped.amount === 'string' && mapped.amount.toLowerCase() === 'ctc' && headers.length > 2 && mapped._originalRow[headers[2]]) {
        ctcAmount = parseFloat(String(mapped._originalRow[headers[2]]).replace(/,/g, '')) || 0;
      } else if ((nameLower === 'ctc' || nameLower.includes('total ctc') || payslipLower === 'ctc') && amt > 0) {
        ctcAmount = amt;
      }
      if ((nameLower === 'basic' || nameLower.includes('basic salary') || payslipLower.includes('basic')) && amt > 0) {
        basicAmount = amt;
      }
    });

    // Second pass: Infer calculations
    return initialMapped.map(mapped => {
      const nameLower = String(mapped.name || '').toLowerCase();
      
      // Ensure amount is a number for the final payload
      if (typeof mapped.amount === 'string') {
          mapped.amount = 0;
      }
      
      // Try extracting percentage from name (e.g., "HRA @ 50%" or "Conveyance (15%)")
      const nameMatch = (mapped.name || '').match(/(\d+(?:\.\d+)?)\s*%/);
      if (nameMatch && !mapped.percentage) {
        mapped.percentage = parseFloat(nameMatch[1]);
      }
      
      if (!mapped.calculationType) {
        if (mapped.percentage) {
          // If percentage is explicitly specified, assume it's % of Basic
          mapped.calculationType = 'PERCENTAGE_OF_BASIC';
        } else if (mapped.amount > 0) {
          // Attempt to auto-infer from Basic or CTC
          if (nameLower.includes('basic') && ctcAmount > 0) {
            const inferredPct = (mapped.amount / ctcAmount) * 100;
            if (Math.abs(inferredPct - Math.round(inferredPct)) < 0.05) {
              mapped.percentage = Math.round(inferredPct);
              mapped.calculationType = 'PERCENTAGE_OF_CTC';
            }
          } else if (basicAmount > 0 && !nameLower.includes('basic') && !nameLower.includes('ctc')) {
            const inferredPct = (mapped.amount / basicAmount) * 100;
            if (Math.abs(inferredPct - Math.round(inferredPct)) < 0.05) {
              mapped.percentage = Math.round(inferredPct);
              mapped.calculationType = 'PERCENTAGE_OF_BASIC';
            } else if (ctcAmount > 0) {
              const inferredCtcPct = (mapped.amount / ctcAmount) * 100;
              if (Math.abs(inferredCtcPct - Math.round(inferredCtcPct)) < 0.05) {
                mapped.percentage = Math.round(inferredCtcPct);
                mapped.calculationType = 'PERCENTAGE_OF_CTC';
              }
            }
          }
        }

        // Final fallback
        if (!mapped.calculationType) {
          mapped.calculationType = 'FLAT_AMOUNT';
        }
      }

      Object.keys(mapped).forEach(k => {
        if (typeof mapped[k] === 'string') mapped[k] = mapped[k].trim();
      });
      
      // Clean up temporary property
      delete mapped._originalRow;

      return mapped;
    }).filter(mapped => {
      if (!mapped.name) return false;
      const ln = mapped.name.toLowerCase();
      // Filter out subtotal rows, section headers, and empty components from CTC Annexures
      if (ln === 'ctc' || ln === 'total ctc' || ln.includes('gross') || ln.includes('total') || ln.includes('take home') || ln.match(/^[a-z]\s*-/)) return false;
      return true;
    });
  };

  const handleUpload = async () => {
    if (data.length === 0) return;
    setLoading(true);
    try {
      const items = mapData();
      const res = await api.post('/payroll/bulk-create', { items });
      if (res.data.success) {
        const { created, skipped, errors } = res.data.results;
        showToast('success', 'Upload Complete', `Created: ${created}, Skipped: ${skipped}`);
        if (errors.length > 0) {
          console.warn('Bulk Upload Errors:', errors);
        }
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      showToast('error', 'Error', err.response?.data?.error || 'Bulk upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Bulk Upload Components</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Upload Excel to add multiple components at once</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Configuration */}
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Component Category</span>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${category === cat.value
                          ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </label>

              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/50">
                <div className="flex gap-3">
                  <AlertCircle size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">Expected Headers:</p>
                      <button
                        onClick={() => {
                          const mapping = FIELD_MAPPINGS[category];
                          const ws = XLSX.utils.aoa_to_sheet([Object.keys(mapping)]);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Template");
                          XLSX.writeFile(wb, `${category.toLowerCase()}_template.xlsx`);
                        }}
                        className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                      >
                        Download Template
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(FIELD_MAPPINGS[category] || {}).map(f => (
                        <span key={f} className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 text-[9px] font-black text-slate-500 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: File Upload */}
            <div className="flex flex-col justify-center">
              {!file ? (
                <label 
                  className="relative group cursor-pointer"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
                  <div className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-4 transition-all ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 group-hover:border-slate-400 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50'
                  }`}>
                    <div className={`w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center transition-transform ${
                      isDragging ? 'bg-indigo-100 text-indigo-600 scale-110' : 'bg-white dark:bg-slate-800 text-slate-400 group-hover:scale-110'
                    }`}>
                      <Upload size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {isDragging ? 'Drop File Here' : 'Select or Drop Excel File'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">.xlsx, .xls, .csv files only</p>
                    </div>
                  </div>
                </label>
              ) : (
                <div className="border border-slate-100 dark:border-slate-800 rounded-3xl p-6 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600">
                    <FileSpreadsheet size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-[200px]">{file.name}</p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">{data.length} Rows Detected</p>
                  </div>
                  <button onClick={() => { setFile(null); setData([]); }} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline">Remove File</button>
                </div>
              )}
            </div>
          </div>

          {/* Preview Table */}
          {data.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Preview (First 5 rows)</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500">Auto-mapping detected</span>
              </div>
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      {headers.slice(0, 6).map((h, i) => (
                        <th key={i} className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 5).map((row, i) => (
                      <tr key={i} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        {headers.slice(0, 6).map((h, j) => (
                          <td key={j} className="px-4 py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 border-b border-slate-50 dark:border-slate-800/50">{String(row[h] || '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-end gap-4">
          <button
            onClick={handleUpload}
            disabled={loading || data.length === 0 || parsing}
            className="flex items-center justify-center gap-2 px-10 py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
            {loading ? 'Processing...' : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

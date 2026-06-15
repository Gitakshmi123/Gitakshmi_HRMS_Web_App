import React, { useEffect, useState } from 'react';
import api from '../../../utils/api';
import { formatCalculationLabel } from '../../../utils/payrollFormat';
import { useNavigate } from 'react-router-dom';

export default function BenefitsList(){
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(()=>{ fetchList(); }, []);
  const fetchList = async ()=>{
    try{ setLoading(true); const res = await api.get('/payroll/benefits'); setList(res.data.data || []); }catch(e){}finally{setLoading(false)}
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Benefits</h2>
        <button onClick={() => navigate('/hr/payroll/benefits/new')} className="px-4 py-2 bg-blue-600 text-white rounded">Add Benefit</button>
      </div>
      <div className="bg-white border rounded shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Value</th>
              <th className="p-3">Part of CTC</th>
              <th className="p-3">Payslip Visible</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && !loading && (
              <tr><td colSpan={7} className="p-4 text-center text-slate-400">No benefits configured</td></tr>
            )}
            {list.map(b => (
              <tr key={b._id} className="border-t">
                <td className="p-3">{b.name}</td>
                <td className="p-3">{formatCalculationLabel(b)}</td>
                <td className="p-3">{b.partOfSalaryStructure ? 'Yes' : 'No'}</td>
                <td className="p-3">{b.showInPayslip ? 'Yes' : 'No'}</td>
                <td className="p-3">{b.isActive ? 'Active' : 'Disabled'}</td>
                <td className="p-3">
                  <button onClick={()=>navigate(`/hr/payroll/benefits/edit/${b._id}`)} className="text-blue-600">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

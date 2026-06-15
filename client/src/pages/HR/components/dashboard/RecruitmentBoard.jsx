import React from 'react';

const RecruitmentBoard = ({ data }) => {
  const stages = [
    { label: 'Applied', color: 'bg-blue-500' },
    { label: 'Screening', color: 'bg-purple-500' },
    { label: 'Interview', color: 'bg-orange-500' },
    { label: 'Offer', color: 'bg-green-500' },
    { label: 'Joined', color: 'bg-indigo-500' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 font-poppins">Recruitment Pipeline</h3>
      <div className="grid grid-cols-5 gap-3">
        {stages.map((stage, index) => (
          <div key={index} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${stage.color}`}></div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stage.label}</span>
            </div>
            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 min-h-[100px] flex flex-col items-center justify-center group hover:bg-white hover:shadow-sm transition-all">
              <span className="text-2xl font-black text-gray-800 tracking-tighter transition-transform group-hover:scale-110">
                {data[stage.label.toLowerCase()] || 0}
              </span>
              <span className="text-[10px] text-gray-400 font-medium">Candidates</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecruitmentBoard;

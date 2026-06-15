import React from 'react';

const ActivityTimeline = ({ activities }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activities</h3>
      <div className="relative space-y-6">
        {/* Vertical Line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100"></div>

        {activities.map((activity, index) => (
          <div key={index} className="relative flex gap-4 pl-1">
            <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${activity.iconBg || 'bg-blue-50 text-blue-600'}`}>
              <activity.icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                {activity.time}
              </p>
            </div>
          </div>
        ))}

        {activities.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm italic">
            No recent activities found
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;

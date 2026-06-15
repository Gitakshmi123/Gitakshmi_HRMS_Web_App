import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarWidget = ({ events = [] }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const now = new Date();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Workforce Calendar</h3>
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
          <button className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-500"><ChevronLeft size={16} /></button>
          <span className="text-xs font-bold px-2 text-gray-700">{monthNames[now.getMonth()]} {now.getFullYear()}</span>
          <button className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-gray-500"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {days.map(day => (
          <span key={day} className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest">{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1">
        {/* Simplified grid for visual placeholder */}
        {Array.from({ length: 35 }).map((_, i) => {
          const dayNum = (i - 2); // Mocking start day
          const isToday = dayNum === now.getDate();
          const hasEvent = events.some(e => e.date === dayNum);

          return (
            <div
              key={i}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer
                ${dayNum > 0 && dayNum <= 31 ? 'hover:bg-blue-50/50' : 'opacity-0 pointer-events-none'}
                ${isToday ? 'bg-blue-600 !text-white shadow-lg shadow-blue-200 scale-110 z-10' : 'text-gray-600'}
              `}
            >
              <span className={`text-xs font-bold ${isToday ? 'text-white' : 'text-gray-700'}`}>{dayNum > 0 && dayNum <= 31 ? dayNum : ''}</span>
              {hasEvent && !isToday && <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5 animate-pulse"></div>}
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Upcoming Events</p>
        {events.slice(0, 3).map((event, i) => (
          <div key={i} className="flex items-center gap-3 group cursor-pointer">
            <div className={`w-1 h-8 rounded-full ${event.color || 'bg-blue-500'} group-hover:scale-y-110 transition-transform`}></div>
            <div>
              <p className="text-xs font-semibold text-gray-800 leading-none mb-1">{event.title}</p>
              <p className="text-[10px] text-gray-500">{event.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarWidget;

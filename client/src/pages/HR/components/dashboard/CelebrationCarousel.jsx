import React, { useState, useEffect } from 'react';
import { Cake, Star, Gift, PartyPopper, ChevronLeft, ChevronRight } from 'lucide-react';

const CelebrationCarousel = ({ employees = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter birthdays and anniversaries for the current month
  const currentMonth = new Date().getMonth();

  const celebrations = employees.map(emp => {
    const events = [];

    // Birthday
    if (emp.dob) {
      const dobDate = new Date(emp.dob);
      if (dobDate.getMonth() === currentMonth) {
        events.push({
          type: 'Birthday',
          name: `${emp.firstName} ${emp.lastName}`,
          date: dobDate.getDate(),
          icon: Cake,
          color: 'from-pink-500 to-rose-500',
          bgLight: 'bg-rose-50',
          textColor: 'text-rose-600',
          label: 'Wishing you a fantastic birthday!'
        });
      }
    }

    // Work Anniversary
    if (emp.createdAt) {
      const joinDate = new Date(emp.createdAt);
      const today = new Date();
      const years = today.getFullYear() - joinDate.getFullYear();

      if (joinDate.getMonth() === currentMonth && years > 0) {
        events.push({
          type: 'Work Anniversary',
          name: `${emp.firstName} ${emp.lastName}`,
          date: joinDate.getDate(),
          years: years,
          icon: Star,
          color: 'from-blue-500 to-indigo-500',
          bgLight: 'bg-indigo-50',
          textColor: 'text-indigo-600',
          label: `Celebrating ${years} ${years === 1 ? 'Year' : 'Years'} of Excellence!`
        });
      }
    }

    return events;
  }).flat().sort((a, b) => a.date - b.date);

  useEffect(() => {
    if (celebrations.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % celebrations.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [celebrations.length]);

  if (celebrations.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center h-[340px]">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
          <PartyPopper size={32} />
        </div>
        <p className="text-gray-400 font-medium tracking-tight">No celebrations this month</p>
      </div>
    );
  }

  const currentEvent = celebrations[currentIndex];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative group h-[340px]">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

      <div className="p-8 h-full flex flex-col items-center text-center justify-center space-y-6">
        {/* Animated Icon Container */}
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br ${currentEvent.color} text-white shadow-lg shadow-indigo-100 animate-bounce transition-all duration-700`}>
          <currentEvent.icon size={36} />
        </div>

        <div>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${currentEvent.bgLight} ${currentEvent.textColor} text-[10px] font-black uppercase tracking-widest mb-3`}>
            <Gift size={12} />
            {currentEvent.type}
          </div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">{currentEvent.name}</h3>
          <p className="text-gray-500 font-medium text-sm mt-1">{currentEvent.label}</p>
        </div>

        <div className="pt-4 flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team is celebrating today!</p>
        </div>
      </div>

      {/* Navigation Dots */}
      {celebrations.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 focus:outline-none">
          {celebrations.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${currentIndex === idx ? 'w-6 bg-indigo-600' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
        </div>
      )}

      {/* Side Nav Buttons (Visible on Hover) */}
      {celebrations.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + celebrations.length) % celebrations.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-gray-100 text-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:text-indigo-600"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % celebrations.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border border-gray-100 text-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:text-indigo-600"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </div>
  );
};

export default CelebrationCarousel;

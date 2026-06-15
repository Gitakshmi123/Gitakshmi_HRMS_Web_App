import React from 'react';
import { Calendar, Clock, MapPin, User, Video } from 'lucide-react';
import dayjs from 'dayjs';

const InterviewInfoBlock = ({ interview, showStatus = null }) => {
    if (!interview || !interview.date) return null;

    return (
        <div className="mt-3 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-800">
                    Interview Scheduled
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-indigo-400 bg-white px-2 py-0.5 rounded border border-indigo-50 shadow-sm">
                        {interview.stage || 'General Round'}
                    </span>
                    {showStatus && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 shadow-sm">
                            {showStatus}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-400" />
                    <span className="text-[10px] font-bold text-slate-600">
                        {dayjs(interview.date).format('MMM D, YYYY')}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock size={12} className="text-indigo-400" />
                    <span className="text-[10px] font-bold text-slate-600">
                        {interview.time}
                    </span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                    {interview.mode === 'Online' ? <Video size={12} className="text-indigo-400" /> : <MapPin size={12} className="text-indigo-400" />}
                    <span className="text-[10px] font-bold text-slate-600 truncate">
                        {interview.location || 'Remote Label'}
                    </span>
                </div>
                {interview.interviewerName && (
                    <div className="flex items-center gap-2 col-span-2">
                        <User size={12} className="text-indigo-400" />
                        <span className="text-[10px] font-bold text-slate-600 truncate">
                            Interviewer: {interview.interviewerName}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InterviewInfoBlock;

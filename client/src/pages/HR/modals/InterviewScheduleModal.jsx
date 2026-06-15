import React, { useEffect, useState } from 'react';
import { DatePicker, TimePicker, Modal } from 'antd';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export default function InterviewScheduleModal({
    visible,
    onCancel,
    onSubmit,
    initialData,
    isReschedule,
    loading,
    companyHolidays = [],
    pipelineStages = []
}) {
    // Local state for the form so we don't depend on parent state directly
    const [interviewData, setInterviewData] = useState({
        date: null,
        time: null,
        mode: 'Online',
        location: '',
        meetingLink: '',
        isExternalInterviewer: false,
        interviewerName: '',
        interviewerEmail: '',
        notes: '',
        stage: ''
    });

    // Populate state from props when visible or initialData changes
    useEffect(() => {
        if (visible && initialData) {
            setInterviewData({
                ...initialData,
                // Ensure date/time are strings if they come as objects or properly formatted
                date: initialData.date || null,
                time: initialData.time || null,
                stage: initialData.stage || '', // Ensure stage is set
                location: initialData.location || '',
                meetingLink: initialData.meetingLink || '',
                isExternalInterviewer: initialData.isExternalInterviewer || false,
                interviewerEmail: initialData.interviewerEmail || '',
            });
        }
    }, [visible, initialData]);

    const handleChange = (field, value) => {
        setInterviewData(prev => ({ ...prev, [field]: value }));
    };

    const handleConfirm = () => {
        // Pass the local state back to parent
        onSubmit(interviewData);
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-slate-800 mb-4">
                    {isReschedule ? 'Reschedule Interview' : 'Schedule Interview'}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Date</label>
                        <DatePicker
                            className="w-full mt-1 h-[42px]"
                            format="YYYY-MM-DD"
                            value={interviewData.date ? dayjs(interviewData.date) : null}
                            disabledDate={(current) => {
                                if (!current) return false;
                                const isSunday = current.day() === 0;
                                const dateStr = current.format('YYYY-MM-DD');
                                const isHoliday = companyHolidays.includes(dateStr);
                                return isSunday || isHoliday || current < dayjs().startOf('day');
                            }}
                            onChange={(date, dateString) => handleChange('date', dateString)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Time</label>
                            <TimePicker
                                className="w-full mt-1 h-[42px]"
                                use12Hours
                                format="h:mm a"
                                value={interviewData.time ? dayjs(interviewData.time, 'h:mm a') : null}
                                onChange={(time, timeString) => handleChange('time', timeString)}
                                minuteStep={5}
                                disabledTime={() => ({
                                    disabledHours: () => {
                                        const hours = [];
                                        const isToday = interviewData.date && dayjs(interviewData.date).isSame(dayjs(), 'day');
                                        if (isToday) {
                                            const currentHour = dayjs().hour();
                                            for (let i = 0; i < currentHour; i++) {
                                                hours.push(i);
                                            }
                                        }
                                        return hours;
                                    },
                                    disabledMinutes: (selectedHour) => {
                                        const minutes = [];
                                        const isToday = interviewData.date && dayjs(interviewData.date).isSame(dayjs(), 'day');
                                        if (isToday && selectedHour === dayjs().hour()) {
                                            const currentMinute = dayjs().minute();
                                            for (let i = 0; i < currentMinute; i++) {
                                                minutes.push(i);
                                            }
                                        }
                                        return minutes;
                                    }
                                })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Mode</label>
                            <select
                                value={interviewData.mode}
                                onChange={(e) => handleChange('mode', e.target.value)}
                                className="w-full mt-1 p-2 border rounded h-[42px]"
                            >
                                <option value="Online">Online</option>
                                <option value="Offline">Offline</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Interview Stage / Round Name</label>
                        {pipelineStages && pipelineStages.length > 0 ? (
                            <select
                                value={interviewData.stage}
                                onChange={(e) => handleChange('stage', e.target.value)}
                                className="w-full mt-1 p-2 border rounded h-[42px]"
                            >
                                <option value="" disabled>Select Interview Stage</option>
                                {pipelineStages.map((stage, idx) => (
                                    <option key={idx} value={stage.stageName}>
                                        {stage.stageName} {stage.stageType ? `(${stage.stageType})` : ''}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={interviewData.stage}
                                onChange={(e) => handleChange('stage', e.target.value)}
                                placeholder="e.g. Technical Round, HR Round..."
                                className="w-full mt-1 p-2 border rounded"
                            />
                        )}
                    </div>
                    {interviewData.mode === 'Online' ? (
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Meeting Link</label>
                            <input
                                type="text"
                                value={interviewData.meetingLink}
                                onChange={(e) => handleChange('meetingLink', e.target.value)}
                                placeholder="Zoom/Teams/Meet Link"
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Office/Location Address</label>
                            <input
                                type="text"
                                value={interviewData.location}
                                onChange={(e) => handleChange('location', e.target.value)}
                                placeholder="Enter work location address"
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>
                    )}
                    {/* Interviewer Details */}
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            type="checkbox"
                            id="isExternalInterviewerModal"
                            checked={interviewData.isExternalInterviewer}
                            onChange={(e) => handleChange('isExternalInterviewer', e.target.checked)}
                        />
                        <label htmlFor="isExternalInterviewerModal" className="text-sm font-medium text-slate-700">
                            External Interviewer
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Interviewer Name</label>
                            <input
                                type="text"
                                value={interviewData.interviewerName}
                                onChange={(e) => handleChange('interviewerName', e.target.value)}
                                className="w-full mt-1 p-2 border rounded"
                            />
                        </div>
                        {interviewData.isExternalInterviewer && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Interviewer Email *</label>
                                <input
                                    type="email"
                                    value={interviewData.interviewerEmail}
                                    onChange={(e) => handleChange('interviewerEmail', e.target.value)}
                                    className="w-full mt-1 p-2 border rounded"
                                />
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Notes (Optional)</label>
                        <textarea
                            value={interviewData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            className="w-full mt-1 p-2 border rounded"
                            rows="2"
                        />
                    </div>

                    <div className="flex gap-2 justify-end mt-4">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading ? 'Sending...' : (isReschedule ? 'Reschedule & Notify' : 'Schedule & Notify')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

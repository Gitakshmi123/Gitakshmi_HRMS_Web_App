import React, { useState } from 'react';
import { Modal, DatePicker, TimePicker, Input } from 'antd';
import { Calendar } from 'lucide-react';
import dayjs from 'dayjs';

/**
 * InterviewScheduleModal Component
 * Schedule interview for candidate and move to next round
 */
const InterviewScheduleModal = ({
  visible,
  applicant,
  onSchedule,
  onCancel,
  loading = false
}) => {
  const [interviewDate, setInterviewDate] = useState(null);
  const [interviewTime, setInterviewTime] = useState(null);
  const [mode, setMode] = useState('Online');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [isExternalInterviewer, setIsExternalInterviewer] = useState(false);
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const [notes, setNotes] = useState('');

  const handleSchedule = () => {
    if (!interviewDate || !interviewTime) {
      alert('Please fill in date and time');
      return;
    }
    if (mode === 'Online' && !meetingLink) {
      alert('Please enter a meeting link');
      return;
    }
    if (mode === 'Offline' && !location) {
      alert('Please enter a location/address');
      return;
    }

    const interviewDetails = {
      date: interviewDate.format('YYYY-MM-DD'),
      time: interviewTime.format('HH:mm'),
      mode,
      location: mode === 'Offline' ? location : '',
      meetingLink: mode === 'Online' ? meetingLink : '',
      isExternalInterviewer,
      interviewerName,
      interviewerEmail: isExternalInterviewer ? interviewerEmail : '',
      notes,
      status: 'Scheduled'
    };

    onSchedule(applicant, interviewDetails);
    
    // Reset form
    setInterviewDate(null);
    setInterviewTime(null);
    setMode('Online');
    setLocation('');
    setMeetingLink('');
    setInterviewerName('');
    setIsExternalInterviewer(false);
    setInterviewerEmail('');
    setNotes('');
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-slate-800 font-black">
          <Calendar size={20} className="text-blue-600" />
          <span>Schedule Interview for {applicant?.name}</span>
        </div>
      }
      open={visible}
      onOk={handleSchedule}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="Schedule Interview"
      okButtonProps={{ className: 'bg-blue-600' }}
      width={500}
    >
      <div className="space-y-4 py-4">
        {/* Interview Date */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-2">
            Interview Date *
          </label>
          <DatePicker
            value={interviewDate}
            onChange={setInterviewDate}
            format="DD-MM-YYYY"
            className="w-full"
            disabledDate={(current) => current && current < dayjs().startOf('day')}
          />
        </div>

        {/* Interview Time & Mode */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">
              Interview Time *
            </label>
            <TimePicker
              value={interviewTime}
              onChange={setInterviewTime}
              format="HH:mm"
              className="w-full"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">
              Interview Mode *
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-[38px]"
            >
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
        </div>

        {/* Location or Meeting Link */}
        {mode === 'Online' ? (
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">
              Meeting Link *
            </label>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="e.g., Zoom/Teams/Meet Link"
              className="rounded-lg"
            />
          </div>
        ) : (
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">
              Office/Location Address *
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Office Address"
              className="rounded-lg"
            />
          </div>
        )}

        {/* Interviewer Details */}
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="isExternalInterviewer"
            checked={isExternalInterviewer}
            onChange={(e) => setIsExternalInterviewer(e.target.checked)}
          />
          <label htmlFor="isExternalInterviewer" className="text-sm font-bold text-slate-700">
            External Interviewer
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold text-slate-700 block mb-2">
              Interviewer Name
            </label>
            <Input
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="Name"
              className="rounded-lg"
            />
          </div>
          {isExternalInterviewer && (
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">
                Interviewer Email *
              </label>
              <Input
                type="email"
                value={interviewerEmail}
                onChange={(e) => setInterviewerEmail(e.target.value)}
                placeholder="Email address"
                className="rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={3}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Info Message */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            ℹ️ Once scheduled, the candidate will automatically move to the Interview round.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default InterviewScheduleModal;

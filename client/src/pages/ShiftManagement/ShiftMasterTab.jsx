import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, TimePicker,
  Switch, message, Space, Popconfirm, Tag, Upload, Descriptions, Tooltip, Badge
} from 'antd';
import {
  Plus, Edit2, Trash2, Download, Upload as UploadIcon, Eye,
  Clock, Moon, Sun, Zap, Users, Activity, LayoutGrid, List,
  CheckCircle, XCircle, Coffee, Globe, Briefcase, BookOpen,
  Star, Shield, AlarmClock, Timer, CalendarCheck
} from 'lucide-react';
import dayjs from 'dayjs';
import shiftMasterService from '../../services/shiftMasterService';
import * as XLSX from '@sheetjs/xlsx';

const { Option } = Select;

/* ─── Predefined shift templates ─────────────────────────────── */
const predefinedShifts = [
  { id: 'S001', name: 'General Shift',           type: 'Regular',        start: '09:30', end: '18:30', hours: 8,  isNight: false },
  { id: 'S002', name: 'Extended General Shift',  type: 'Regular',        start: '09:00', end: '18:00', hours: 8,  isNight: false },
  { id: 'S003', name: 'Early Morning Shift',     type: 'Support',        start: '06:00', end: '15:00', hours: 8,  isNight: false },
  { id: 'S004', name: 'Morning Shift',           type: 'Support',        start: '07:00', end: '16:00', hours: 8,  isNight: false },
  { id: 'S005', name: 'Mid Shift',               type: 'Support',        start: '11:00', end: '20:00', hours: 8,  isNight: false },
  { id: 'S006', name: 'Afternoon Shift',         type: 'Support',        start: '13:00', end: '22:00', hours: 8,  isNight: false },
  { id: 'S007', name: 'Evening Shift',           type: 'Support',        start: '14:00', end: '23:00', hours: 8,  isNight: false },
  { id: 'S008', name: 'Late Evening Shift',      type: 'Support',        start: '16:00', end: '01:00', hours: 8,  isNight: true  },
  { id: 'S009', name: 'Night Shift',             type: '24x7 Support',   start: '22:00', end: '07:00', hours: 8,  isNight: true  },
  { id: 'S010', name: 'Overnight Shift',         type: '24x7 Support',   start: '23:00', end: '08:00', hours: 8,  isNight: true  },
  { id: 'S011', name: 'US Time Zone Shift',      type: 'Client Based',   start: '18:30', end: '03:30', hours: 8,  isNight: true  },
  { id: 'S012', name: 'Europe Time Zone Shift',  type: 'Client Based',   start: '13:30', end: '22:30', hours: 8,  isNight: false },
  { id: 'S013', name: 'Australia TZ Shift',      type: 'Client Based',   start: '05:00', end: '14:00', hours: 8,  isNight: false },
  { id: 'S014', name: 'Flexible Shift',          type: 'Flexible',       start: '08:00', end: '17:00', hours: 8,  isNight: false },
  { id: 'S015', name: 'Developer Shift',         type: 'Project Based',  start: '10:00', end: '19:00', hours: 8,  isNight: false },
  { id: 'S016', name: 'Consultant Shift',        type: 'Project Based',  start: '09:30', end: '18:30', hours: 8,  isNight: false },
  { id: 'S017', name: 'Hybrid Shift',            type: 'Hybrid Work',    start: '09:30', end: '18:30', hours: 8,  isNight: false },
  { id: 'S018', name: 'Half Day Shift',          type: 'Short Shift',    start: '09:30', end: '13:30', hours: 4,  isNight: false },
  { id: 'S019', name: 'Training Shift',          type: 'Learning',       start: '10:00', end: '17:00', hours: 6,  isNight: false },
  { id: 'S020', name: 'Weekend Support Shift',   type: 'Special Shift',  start: '09:30', end: '18:30', hours: 8,  isNight: false },
];

/* ─── Shift type → visual config ─────────────────────────────── */
const TYPE_CONFIG = {
  'Regular':       { color: '#4f46e5', bg: '#eef2ff', icon: <Briefcase size={13}/>,  label: 'Regular'       },
  'Support':       { color: '#0891b2', bg: '#e0f2fe', icon: <Shield size={13}/>,     label: 'Support'       },
  '24x7 Support':  { color: '#7c3aed', bg: '#f5f3ff', icon: <Activity size={13}/>,   label: '24×7 Support'  },
  'Client Based':  { color: '#0d9488', bg: '#ccfbf1', icon: <Globe size={13}/>,      label: 'Client Based'  },
  'Flexible':      { color: '#d97706', bg: '#fef3c7', icon: <Zap size={13}/>,        label: 'Flexible'      },
  'Project Based': { color: '#059669', bg: '#d1fae5', icon: <Star size={13}/>,       label: 'Project Based' },
  'Hybrid Work':   { color: '#7c3aed', bg: '#ede9fe', icon: <Users size={13}/>,      label: 'Hybrid Work'   },
  'Short Shift':   { color: '#f59e0b', bg: '#fef9c3', icon: <Timer size={13}/>,      label: 'Short Shift'   },
  'Learning':      { color: '#be185d', bg: '#fce7f3', icon: <BookOpen size={13}/>,   label: 'Learning'      },
  'Special Shift': { color: '#ea580c', bg: '#ffedd5', icon: <Coffee size={13}/>,     label: 'Special Shift' },
  'General':       { color: '#4f46e5', bg: '#eef2ff', icon: <Briefcase size={13}/>,  label: 'General'       },
  'Morning':       { color: '#f59e0b', bg: '#fef9c3', icon: <Sun size={13}/>,        label: 'Morning'       },
  'Evening':       { color: '#7c3aed', bg: '#ede9fe', icon: <Moon size={13}/>,       label: 'Evening'       },
  'Night':         { color: '#1e3a5f', bg: '#dbeafe', icon: <Moon size={13}/>,       label: 'Night'         },
};
const getTypeConfig = (t) => TYPE_CONFIG[t] || { color: '#64748b', bg: '#f1f5f9', icon: <AlarmClock size={13}/>, label: t };

/* ─── Convert HH:mm → 0-24 fraction for timeline bar ────────── */
const timeFraction = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m) / (24 * 60);
};

/* ─── Shift Card ─────────────────────────────────────────────── */
function ShiftCard({ record, onView, onEdit, onDelete, onToggle }) {
  const cfg = getTypeConfig(record.type);
  const start = record.coreTiming?.startTime || '--:--';
  const end   = record.coreTiming?.endTime   || '--:--';
  const isNight = record.coreTiming?.isNightShiftAcrossMidnight;
  const active = record.status === 'Active';

  /* timeline math */
  const startFrac = timeFraction(start);
  let endFrac = timeFraction(end);
  const overnight = isNight && endFrac <= startFrac;

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      {/* Top accent bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)` }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.icon}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm leading-tight">{record.name}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{record.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isNight && (
              <Tooltip title="Night Shift — Crosses Midnight">
                <span className="text-indigo-400"><Moon size={14}/></span>
              </Tooltip>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}
            >
              {active ? '● Active' : '○ Inactive'}
            </span>
          </div>
        </div>

        {/* Type badge */}
        <span
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium mb-3"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.icon} {cfg.label}
        </span>

        {/* Timing display */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-2 flex-1">
            <Clock size={13} className="text-slate-400"/>
            <span className="font-mono text-sm font-semibold text-slate-700">{start}</span>
            <span className="text-slate-300 mx-1">→</span>
            <span className="font-mono text-sm font-semibold text-slate-700">{end}</span>
            {overnight && <span className="text-xs text-indigo-500 ml-1">+1</span>}
          </div>
        </div>

        {/* Mini timeline bar */}
        <div className="relative h-2 bg-slate-100 rounded-full mb-3 overflow-hidden">
          {overnight ? (
            <>
              <div
                className="absolute top-0 h-full rounded-full"
                style={{ left: `${startFrac * 100}%`, right: 0, background: cfg.color, opacity: 0.7 }}
              />
              <div
                className="absolute top-0 h-full rounded-full"
                style={{ left: 0, width: `${endFrac * 100}%`, background: cfg.color, opacity: 0.7 }}
              />
            </>
          ) : (
            <div
              className="absolute top-0 h-full rounded-full"
              style={{ left: `${startFrac * 100}%`, width: `${Math.max((endFrac - startFrac) * 100, 4)}%`, background: cfg.color }}
            />
          )}
        </div>

        {/* Working hours */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
          <span>
            Full Day: <b className="text-slate-700">{Math.floor((record.workingHours?.minimumHoursForFullDay || 0) / 60)}h {(record.workingHours?.minimumHoursForFullDay || 0) % 60}m</b>
          </span>
          <span>
            Half Day: <b className="text-slate-700">{Math.floor((record.workingHours?.minimumHoursForHalfDay || 0) / 60)}h {(record.workingHours?.minimumHoursForHalfDay || 0) % 60}m</b>
          </span>
        </div>

        {/* Action footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Switch
            size="small"
            checked={active}
            onChange={() => onToggle(record)}
            className={active ? 'bg-emerald-500' : 'bg-slate-300'}
          />
          <div className="flex items-center gap-1">
            <Tooltip title="View Details">
              <Button type="text" size="small" icon={<Eye size={14} className="text-slate-400"/>} onClick={() => onView(record)} />
            </Tooltip>
            <Tooltip title="Edit Shift">
              <Button type="text" size="small" icon={<Edit2 size={14} className="text-blue-500"/>} onClick={() => onEdit(record)} />
            </Tooltip>
            <Tooltip title="Delete Shift">
              <Popconfirm title="Delete this shift?" onConfirm={() => onDelete(record._id)} okText="Yes, Delete" okButtonProps={{ danger: true }}>
                <Button type="text" size="small" icon={<Trash2 size={14} className="text-red-400"/>} />
              </Popconfirm>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function ShiftMasterTab() {
  const [shifts, setShifts]               = useState([]);
  const [loading, setLoading]             = useState(false);
  const [isModalVisible, setIsModalVisible]       = useState(false);
  const [editingId, setEditingId]                 = useState(null);
  const [isCustomShift, setIsCustomShift]         = useState(false);
  const [viewMode, setViewMode]                   = useState('card'); // 'card' | 'table'
  const [searchText, setSearchText]               = useState('');
  const [filterType, setFilterType]               = useState('All');
  const [filterStatus, setFilterStatus]           = useState('All');

  // Preview upload states
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewData, setPreviewData]                 = useState([]);
  const [isUploading, setIsUploading]                 = useState(false);

  // Detail view states
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState(null);

  const [form] = Form.useForm();

  /* ── fetch ── */
  const fetchShifts = async () => {
    try {
      setLoading(true);
      const res = await shiftMasterService.getAllShifts();
      if (res.success) setShifts(res.data);
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to fetch shifts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShifts(); }, []);

  /* ── stats ── */
  const stats = {
    total:    shifts.length,
    active:   shifts.filter(s => s.status === 'Active').length,
    inactive: shifts.filter(s => s.status === 'Inactive').length,
    night:    shifts.filter(s => s.coreTiming?.isNightShiftAcrossMidnight).length,
  };

  /* ── filtered shifts ── */
  const filteredShifts = shifts.filter(s => {
    const matchSearch = !searchText ||
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.code.toLowerCase().includes(searchText.toLowerCase());
    const matchType   = filterType   === 'All' || s.type   === filterType;
    const matchStatus = filterStatus === 'All' || s.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  /* ── modal open ── */
  const handleOpenModal = (record = null) => {
    setIsCustomShift(false);
    if (record) {
      setEditingId(record._id);
      form.setFieldsValue({
        ...record,
        shiftSelect: record.name,
        customName:  record.name,
        startTime:   dayjs(record.coreTiming.startTime, 'HH:mm'),
        endTime:     dayjs(record.coreTiming.endTime,   'HH:mm'),
        isNightShiftAcrossMidnight: record.coreTiming.isNightShiftAcrossMidnight,
        fullDayHours:   record.workingHours?.minimumHoursForFullDay  ? Math.floor(record.workingHours.minimumHoursForFullDay  / 60) : 0,
        fullDayMinutes: record.workingHours?.minimumHoursForFullDay  ? record.workingHours.minimumHoursForFullDay  % 60 : 0,
        halfDayHours:   record.workingHours?.minimumHoursForHalfDay  ? Math.floor(record.workingHours.minimumHoursForHalfDay / 60) : 0,
        halfDayMinutes: record.workingHours?.minimumHoursForHalfDay  ? record.workingHours.minimumHoursForHalfDay  % 60 : 0,
        validFrom: dayjs(record.validFrom),
      });
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({
        shiftSelect: undefined, status: 'Active', type: 'Regular',
        validFrom: dayjs(), fullDayHours: 8, fullDayMinutes: 0,
        halfDayHours: 4, halfDayMinutes: 0,
      });
    }
    setIsModalVisible(true);
  };

  /* ── preset select ── */
  const handleShiftSelectChange = (value) => {
    if (value === 'Custom') {
      setIsCustomShift(true);
      form.setFieldsValue({ customName: '' });
    } else {
      setIsCustomShift(false);
      const s = predefinedShifts.find(x => x.name === value);
      if (s) {
        form.setFieldsValue({
          shiftSelect: s.name, code: s.id, type: s.type,
          startTime: dayjs(s.start, 'HH:mm'), endTime: dayjs(s.end, 'HH:mm'),
          isNightShiftAcrossMidnight: s.isNight,
          fullDayHours:   s.hours, fullDayMinutes:  0,
          halfDayHours:   s.hours === 8 ? 4 : Math.floor(s.hours / 2), halfDayMinutes: 0,
        });
      }
    }
  };

  /* ── save ── */
  const handleSave = async (values) => {
    try {
      setLoading(true);
      const shiftName = isCustomShift ? values.customName : values.shiftSelect;
      if (!shiftName) { message.error('Please provide a shift name'); return; }

      const payload = {
        name: shiftName, code: values.code, type: values.type, status: values.status,
        validFrom: values.validFrom ? values.validFrom.toDate() : new Date(),
        coreTiming: {
          startTime: values.startTime.format('HH:mm'),
          endTime:   values.endTime.format('HH:mm'),
          isNightShiftAcrossMidnight: values.isNightShiftAcrossMidnight || false,
        },
        workingHours: {
          minimumHoursForFullDay:  (parseInt(values.fullDayHours  || 0) * 60) + parseInt(values.fullDayMinutes  || 0),
          minimumHoursForHalfDay:  (parseInt(values.halfDayHours  || 0) * 60) + parseInt(values.halfDayMinutes  || 0),
        },
      };

      if (editingId) {
        await shiftMasterService.updateShift(editingId, payload);
        message.success('Shift updated successfully');
      } else {
        await shiftMasterService.createShift(payload, null);
        message.success('Shift created successfully');
      }
      setIsModalVisible(false);
      fetchShifts();
    } catch (error) {
      message.error(error.response?.data?.error || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await shiftMasterService.deleteShift(id);
      if (res.success) { message.success('Shift deleted'); fetchShifts(); }
    } catch { message.error('Failed to delete shift'); }
  };

  const handleToggleStatus = async (record) => {
    try {
      const newStatus = record.status === 'Active' ? 'Inactive' : 'Active';
      const res = await shiftMasterService.updateShift(record._id, { status: newStatus });
      if (res.success) { message.success(`Status changed to ${newStatus}`); fetchShifts(); }
    } catch { message.error('Failed to update status'); }
  };

  /* ── download template ── */
  const handleDownloadTemplate = () => {
    const templateData = predefinedShifts.map(s => ({
      'Shift Name':                  s.name,
      'Shift Code':                  s.id,
      'Shift Type':                  s.type,
      'Start Time (HH:mm)':          s.start,
      'End Time (HH:mm)':            s.end,
      'Is Night Shift? (Yes/No)':    s.isNight ? 'Yes' : 'No',
      'Min Full Day (Hours)':        s.hours,
      'Min Half Day (Hours)':        s.hours === 8 ? 4 : Math.floor(s.hours / 2),
      'Max Advance Punch In (Min)':  120,
      'Max Late Punch Out (Min)':    120,
      'OT Enabled (Yes/No)':         (s.type === 'Support' || s.type === '24x7 Support') ? 'Yes' : 'No',
      'Max Permissions Per Month':   2,
    }));
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shift Master Template');
    XLSX.writeFile(wb, 'Shift_Master_Upload_Template.xlsx');
    message.success('Template downloaded!');
  };

  /* ── upload excel ── */
  const handleUploadExcel = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const ws       = workbook.Sheets[workbook.SheetNames[0]];
        const json     = XLSX.utils.sheet_to_json(ws);
        if (!json.length) { message.error('File is empty.'); return; }

        const parsedData = json.map((row, idx) => {
          const errors = [];
          const shiftName = row['Shift Name'];
          const shiftCode = row['Shift Code'];
          if (!shiftName) errors.push('Missing Name');
          if (!shiftCode) errors.push('Missing Code');
          if (json.some((r, i) => i !== idx && r['Shift Code'] === shiftCode)) errors.push('Duplicate Code in file');
          if (shifts.some(s => s.code === shiftCode)) errors.push('Code exists in system');
          return {
            key: idx, name: shiftName, code: shiftCode,
            type: row['Shift Type'] || 'Regular', status: 'Active',
            validFrom: new Date(),
            coreTiming: {
              startTime: String(row['Start Time (HH:mm)'] || '09:30'),
              endTime:   String(row['End Time (HH:mm)']   || '18:30'),
              isNightShiftAcrossMidnight: String(row['Is Night Shift? (Yes/No)'] || 'No').toLowerCase() === 'yes',
            },
            workingHours: {
              minimumHoursForFullDay:  (parseInt(row['Min Full Day (Hours)'])  || 8) * 60,
              minimumHoursForHalfDay:  (parseInt(row['Min Half Day (Hours)'])  || 4) * 60,
            },
            errors: errors.join(', '),
          };
        });
        setPreviewData(parsedData);
        setPreviewModalVisible(true);
      } catch {
        message.error('Failed to process Excel file. Check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleConfirmUpload = async () => {
    const validData = previewData.filter(d => !d.errors);
    if (!validData.length) { message.error('No valid shifts to upload.'); return; }
    try {
      setIsUploading(true);
      const payload = validData.map(({ key, errors, ...rest }) => rest);
      const res = await shiftMasterService.bulkCreateShifts(payload);
      if (res.success) {
        message.success(`Successfully uploaded ${res.count} shifts!`);
        setPreviewModalVisible(false);
        fetchShifts();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to save. Check for duplicates.');
    } finally {
      setIsUploading(false);
    }
  };

  /* ── table columns (list view) ── */
  const tableColumns = [
    {
      title: 'Shift', key: 'shift',
      render: (_, r) => {
        const cfg = getTypeConfig(r.type);
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.icon}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
              <p className="text-xs font-mono text-slate-400">{r.code}</p>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (t) => {
        const cfg = getTypeConfig(t);
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.icon} {cfg.label}
          </span>
        );
      },
    },
    {
      title: 'Timing', key: 'timing',
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-slate-400"/>
          <span className="font-mono text-sm font-medium text-slate-700">
            {r.coreTiming?.startTime} → {r.coreTiming?.endTime}
            {r.coreTiming?.isNightShiftAcrossMidnight && <span className="ml-1 text-indigo-500 text-xs">+1</span>}
          </span>
        </div>
      ),
    },
    {
      title: 'Working Hours', key: 'hours',
      render: (_, r) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <div>Full: <b>{Math.floor((r.workingHours?.minimumHoursForFullDay || 0) / 60)}h {(r.workingHours?.minimumHoursForFullDay || 0) % 60}m</b></div>
          <div>Half: <b>{Math.floor((r.workingHours?.minimumHoursForHalfDay || 0) / 60)}h {(r.workingHours?.minimumHoursForHalfDay || 0) % 60}m</b></div>
        </div>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status, record) => (
        <Switch
          size="small"
          checkedChildren="Active"
          unCheckedChildren="Off"
          checked={status === 'Active'}
          onChange={() => handleToggleStatus(record)}
          className={status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}
        />
      ),
    },
    {
      title: 'Actions', key: 'action',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button type="text" size="small" icon={<Eye size={14} className="text-slate-400"/>} onClick={() => { setSelectedShiftDetails(record); setDetailsModalVisible(true); }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<Edit2 size={14} className="text-blue-500"/>} onClick={() => handleOpenModal(record)} />
          </Tooltip>
          <Popconfirm title="Delete this shift?" onConfirm={() => handleDelete(record._id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Tooltip title="Delete">
              <Button type="text" size="small" icon={<Trash2 size={14} className="text-red-400"/>} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ── unique types for filter ── */
  const allTypes = ['All', ...new Set(shifts.map(s => s.type))];

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div className="p-5 space-y-5">

      {/* ── Stats Row ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Shifts',   value: stats.total,    color: '#4f46e5', bg: '#eef2ff', icon: <CalendarCheck size={18}/> },
          { label: 'Active',         value: stats.active,   color: '#059669', bg: '#d1fae5', icon: <CheckCircle    size={18}/> },
          { label: 'Inactive',       value: stats.inactive, color: '#dc2626', bg: '#fee2e2', icon: <XCircle        size={18}/> },
          { label: 'Night Shifts',   value: stats.night,    color: '#7c3aed', bg: '#f5f3ff', icon: <Moon           size={18}/> },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap items-center gap-3"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

        {/* Search */}
        <Input
          prefix={<svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>}
          placeholder="Search by name or code…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="rounded-xl border-slate-200"
          style={{ width: 220 }}
          allowClear
        />

        {/* Type filter */}
        <Select value={filterType} onChange={setFilterType} style={{ width: 160 }} className="rounded-xl">
          {allTypes.map(t => <Option key={t} value={t}>{t === 'All' ? '🔹 All Types' : t}</Option>)}
        </Select>

        {/* Status filter */}
        <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 130 }} className="rounded-xl">
          <Option value="All">All Status</Option>
          <Option value="Active">✅ Active</Option>
          <Option value="Inactive">❌ Inactive</Option>
        </Select>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid size={13}/> Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List size={13}/> Table
          </button>
        </div>

        {/* Action buttons */}
        <Tooltip title="Download Template">
          <Button icon={<Download size={14}/>} onClick={handleDownloadTemplate} className="rounded-xl border-slate-200">
            Template
          </Button>
        </Tooltip>

        <Upload beforeUpload={handleUploadExcel} showUploadList={false} accept=".xlsx,.xls">
          <Tooltip title="Bulk Upload via Excel">
            <Button icon={<UploadIcon size={14}/>} className="rounded-xl border-slate-200">
              Import
            </Button>
          </Tooltip>
        </Upload>

        <Button
          type="primary"
          icon={<Plus size={14}/>}
          onClick={() => handleOpenModal()}
          className="rounded-xl"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}
        >
          Add Shift
        </Button>
      </div>

      {/* ── Content Area ──────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
            <p className="text-sm text-slate-500">Loading shifts…</p>
          </div>
        </div>
      ) : filteredShifts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-16"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <Clock size={28} className="text-indigo-400"/>
          </div>
          <p className="text-slate-700 font-semibold">No shifts found</p>
          <p className="text-slate-400 text-sm mt-1">Create your first shift or adjust filters</p>
          <Button type="primary" icon={<Plus size={14}/>} onClick={() => handleOpenModal()} className="mt-4 rounded-xl"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}>
            Add First Shift
          </Button>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredShifts.map(s => (
            <ShiftCard
              key={s._id} record={s}
              onView={(r) => { setSelectedShiftDetails(r); setDetailsModalVisible(true); }}
              onEdit={handleOpenModal}
              onDelete={handleDelete}
              onToggle={handleToggleStatus}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <Table
            columns={tableColumns}
            dataSource={filteredShifts}
            rowKey="_id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} shifts` }}
            size="middle"
            className="shift-table"
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CREATE / EDIT MODAL                                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Modal
        title={
          <div className="flex items-center gap-3 pb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50">
              <AlarmClock size={16} className="text-indigo-600"/>
            </div>
            <div>
              <p className="font-bold text-slate-800 text-base">{editingId ? 'Edit Shift' : 'Shift Information'}</p>
            </div>
          </div>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={640}
        className="shift-modal"
        styles={{ header: { borderBottom: '1px solid #f1f5f9', paddingBottom: 12 } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">

          {/* ── Section 1: Basic Info ── */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Briefcase size={12}/> Basic Information
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item label="Shift Name" required className="mb-3">
                <Input.Group compact>
                  <Form.Item name="shiftSelect" noStyle rules={[{ required: !isCustomShift, message: 'Select a shift' }]}>
                    <Select
                      placeholder="Select preset or custom…"
                      onChange={handleShiftSelectChange}
                      showSearch optionFilterProp="children"
                      style={{ width: isCustomShift ? '35%' : '100%' }}
                    >
                      {predefinedShifts.map(s => (
                        <Option key={s.name} value={s.name}>{s.name}</Option>
                      ))}
                      <Option value="Custom" style={{ color: '#4f46e5', fontWeight: 600 }}>+ Custom Shift</Option>
                    </Select>
                  </Form.Item>
                  {isCustomShift && (
                    <Form.Item name="customName" noStyle rules={[{ required: true, message: 'Enter name' }]}>
                      <Input style={{ width: '65%' }} placeholder="Custom shift name" />
                    </Form.Item>
                  )}
                </Input.Group>
              </Form.Item>

              <Form.Item name="code" label="Shift Code" rules={[{ required: true, message: 'Code required' }]} className="mb-3">
                <Input placeholder="e.g. MORN_01" className="font-mono uppercase" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="type" label="Shift Type" rules={[{ required: true }]} className="mb-0">
                <Select>
                  {['Regular','Support','24x7 Support','Client Based','Flexible','Project Based','Hybrid Work','Short Shift','Learning','Special Shift','General','Morning','Evening','Night'].map(t => (
                    <Option key={t} value={t}>
                      <span className="flex items-center gap-1.5">{getTypeConfig(t).icon} {t}</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="status" label="Status" rules={[{ required: true }]} className="mb-0">
                <Select>
                  <Option value="Active"><span className="text-emerald-600 font-medium">✅ Active</span></Option>
                  <Option value="Inactive"><span className="text-red-500 font-medium">❌ Inactive</span></Option>
                </Select>
              </Form.Item>
            </div>
          </div>

          {/* ── Section 2: Core Timing ── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock size={12}/> Shift Timing Configuration
            </p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Form.Item name="startTime" label="Planned Start Time" rules={[{ required: true, message: 'Start time required' }]} className="mb-0">
                <TimePicker format="HH:mm" className="w-full" placeholder="09:00" minuteStep={15} />
              </Form.Item>
              <Form.Item name="endTime" label="Planned End Time" rules={[{ required: true, message: 'End time required' }]} className="mb-0">
                <TimePicker format="HH:mm" className="w-full" placeholder="18:00" minuteStep={15} />
              </Form.Item>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Form.Item name="breakStartTime" label="Break Start Time" className="mb-0">
                <TimePicker format="HH:mm" className="w-full" placeholder="13:00" minuteStep={15} />
              </Form.Item>
              <Form.Item name="breakEndTime" label="Break End Time" className="mb-0">
                <TimePicker format="HH:mm" className="w-full" placeholder="14:00" minuteStep={15} />
              </Form.Item>
            </div>
            <Form.Item name="isNightShiftAcrossMidnight" valuePropName="checked" className="mb-0"
              help="Enable if shift spans midnight (e.g., 22:00 → 07:00)">
              <div className="flex items-center gap-3">
                <Switch />
                <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.isNightShiftAcrossMidnight !== currentValues.isNightShiftAcrossMidnight}>
                  {({ getFieldValue }) => (
                    <span className="text-sm font-semibold text-slate-700">
                      {getFieldValue('isNightShiftAcrossMidnight') ? '🌙 Night Shift — Crosses Midnight' : '☀️ Day Shift'}
                    </span>
                  )}
                </Form.Item>
              </div>
            </Form.Item>
          </div>

          {/* ── Section 3: Working Hours ── */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Timer size={12}/> Minimum Working Hours
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Day Rule <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <Form.Item name="fullDayHours" className="mb-0 flex-1" rules={[{ required: true, message: 'Required' }]}>
                    <Select placeholder="Hours">
                      {[...Array(25).keys()].map(h => <Option key={h} value={h}>{h} Hrs</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="fullDayMinutes" className="mb-0 flex-1" rules={[{ required: true, message: 'Required' }]}>
                    <Select placeholder="Mins">
                      {[0, 15, 30, 45].map(m => <Option key={m} value={m}>{m} Min</Option>)}
                    </Select>
                  </Form.Item>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Half Day Rule <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <Form.Item name="halfDayHours" className="mb-0 flex-1" rules={[{ required: true, message: 'Required' }]}>
                    <Select placeholder="Hours">
                      {[...Array(25).keys()].map(h => <Option key={h} value={h}>{h} Hrs</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="halfDayMinutes" className="mb-0 flex-1" rules={[{ required: true, message: 'Required' }]}>
                    <Select placeholder="Mins">
                      {[0, 15, 30, 45].map(m => <Option key={m} value={m}>{m} Min</Option>)}
                    </Select>
                  </Form.Item>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button onClick={() => setIsModalVisible(false)} className="rounded-xl">Cancel</Button>
            <Button
              type="primary" htmlType="submit" loading={loading}
              className="rounded-xl px-6"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}
            >
              {editingId ? 'Update Shift' : 'Create Shift'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EXCEL PREVIEW MODAL                                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <UploadIcon size={16} className="text-indigo-500"/>
            <span>Preview Import — Excel Upload</span>
          </div>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setPreviewModalVisible(false)}>Cancel</Button>,
          <Button
            key="submit" type="primary" loading={isUploading}
            onClick={handleConfirmUpload}
            disabled={!previewData.length || previewData.every(d => d.errors)}
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}
          >
            Confirm & Import Valid Shifts
          </Button>,
        ]}
      >
        <div className="mb-3 flex items-center gap-2">
          <Badge count={previewData.filter(d => !d.errors).length} color="#059669" /><span className="text-sm text-slate-600">valid</span>
          <Badge count={previewData.filter(d => d.errors).length} color="#dc2626" className="ml-2"/><span className="text-sm text-slate-600">with errors</span>
        </div>
        <Table
          columns={[
            { title: 'Code', dataIndex: 'code', key: 'code', width: 90, render: t => <span className="font-mono text-xs">{t}</span> },
            { title: 'Name', dataIndex: 'name', key: 'name', width: 160 },
            { title: 'Type', dataIndex: 'type', key: 'type', width: 120,
              render: t => { const c = getTypeConfig(t); return <span style={{ color: c.color, fontWeight: 500 }}>{t}</span>; } },
            { title: 'Timing', key: 'timing', width: 130,
              render: (_, r) => <span className="font-mono text-xs">{r.coreTiming?.startTime} → {r.coreTiming?.endTime}</span> },
            { title: 'Validation', dataIndex: 'errors', key: 'errors',
              render: (text) => text
                ? <Tag color="error" className="text-xs">{text}</Tag>
                : <Tag color="success" className="text-xs">✓ Valid</Tag> },
          ]}
          dataSource={previewData}
          rowKey="key"
          pagination={false}
          scroll={{ y: 380 }}
          size="small"
          rowClassName={(r) => r.errors ? 'bg-red-50' : ''}
        />
      </Modal>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SHIFT DETAIL MODAL                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50">
              <Eye size={16} className="text-indigo-600"/>
            </div>
            <div>
              <p className="font-bold text-slate-800">Shift Details</p>
              <p className="text-xs text-slate-400 font-normal">{selectedShiftDetails?.name}</p>
            </div>
          </div>
        }
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={[
          <Button key="edit" type="primary" icon={<Edit2 size={13}/>}
            onClick={() => { setDetailsModalVisible(false); handleOpenModal(selectedShiftDetails); }}
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}>
            Edit Shift
          </Button>,
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>Close</Button>,
        ]}
        width={640}
      >
        {selectedShiftDetails && (() => {
          const cfg = getTypeConfig(selectedShiftDetails.type);
          const start = selectedShiftDetails.coreTiming?.startTime;
          const end   = selectedShiftDetails.coreTiming?.endTime;
          return (
            <div className="space-y-4 mt-2">
              {/* Header card */}
              <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: cfg.bg }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white shadow-sm" style={{ color: cfg.color }}>
                  <span style={{ fontSize: 28 }}>{cfg.icon}</span>
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: cfg.color }}>{selectedShiftDetails.name}</p>
                  <p className="font-mono text-sm" style={{ color: cfg.color, opacity: 0.7 }}>{selectedShiftDetails.code}</p>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-1" style={{ background: 'white', color: cfg.color }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                <div className="ml-auto text-right">
                  <span className={`text-sm px-3 py-1 rounded-full font-semibold ${selectedShiftDetails.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {selectedShiftDetails.status === 'Active' ? '● Active' : '○ Inactive'}
                  </span>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '🕐 Start Time',        value: start },
                  { label: '🕕 End Time',          value: end   },
                  { label: '🌙 Night Shift',       value: selectedShiftDetails.coreTiming?.isNightShiftAcrossMidnight ? 'Yes — Crosses Midnight' : 'No' },
                  { label: '📅 Valid From',        value: dayjs(selectedShiftDetails.validFrom).format('DD MMM YYYY') },
                  { label: '⏱ Min Full Day',      value: `${Math.floor((selectedShiftDetails.workingHours?.minimumHoursForFullDay || 0) / 60)}h ${(selectedShiftDetails.workingHours?.minimumHoursForFullDay || 0) % 60}m` },
                  { label: '⏳ Min Half Day',      value: `${Math.floor((selectedShiftDetails.workingHours?.minimumHoursForHalfDay || 0) / 60)}h ${(selectedShiftDetails.workingHours?.minimumHoursForHalfDay || 0) % 60}m` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className="font-semibold text-slate-800 text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {/* Timeline visual */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-3 font-medium">24-Hour Timeline</p>
                <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                  {(() => {
                    const sf = timeFraction(start);
                    const ef = timeFraction(end);
                    const overnight = selectedShiftDetails.coreTiming?.isNightShiftAcrossMidnight && ef <= sf;
                    return overnight ? (
                      <>
                        <div className="absolute top-0 h-full rounded-full" style={{ left: `${sf * 100}%`, right: 0, background: cfg.color }} />
                        <div className="absolute top-0 h-full rounded-full" style={{ left: 0, width: `${ef * 100}%`, background: cfg.color }} />
                      </>
                    ) : (
                      <div className="absolute top-0 h-full rounded-full" style={{ left: `${sf * 100}%`, width: `${Math.max((ef - sf) * 100, 4)}%`, background: cfg.color }} />
                    );
                  })()}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                  <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

    </div>
  );
}

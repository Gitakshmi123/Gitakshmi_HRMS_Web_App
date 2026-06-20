import React, { useState, useEffect } from 'react';
import { Card, Button, Table, DatePicker, message, Spin, Tag, Tooltip, Select, Modal, Form, Input, Space, Alert, Drawer, Badge } from 'antd';
import { CalendarDays, Settings2, RefreshCw, Plus, ShieldAlert, Sparkles, CheckCircle2, Save, FileText, Layers, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../utils/api';
import shiftMasterService from '../../services/shiftMasterService';

const { Option } = Select;

export default function RosterManagementTab() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  
  // Master lists
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [rosters, setRosters] = useState([]);
  
  // Current active roster & assignments
  const [activeRoster, setActiveRoster] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [warnings, setWarnings] = useState([]);

  // Modals state
  const [isNewRosterOpen, setIsNewRosterOpen] = useState(false);
  const [isRotationOpen, setIsRotationOpen] = useState(false);
  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [isPatternManagerOpen, setIsPatternManagerOpen] = useState(false);

  const [newRosterForm] = Form.useForm();
  const [newPatternForm] = Form.useForm();

  // Load shifts, employees, rotations, and rosters on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Update weeks structure and filter rosters when selected month changes
  useEffect(() => {
    if (rosters.length > 0) {
      const match = rosters.find(r => 
        r.month === (selectedMonth.month() + 1) && 
        r.year === selectedMonth.year()
      );
      if (match) {
        fetchRosterDetails(match._id);
      } else {
        setActiveRoster(null);
        setAssignments([]);
        setWeeks([]);
        setConflicts([]);
        setWarnings([]);
      }
    }
  }, [selectedMonth, rosters]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [shiftRes, empRes, rotationRes, rosterRes] = await Promise.all([
        shiftMasterService.getAllShifts('Active'),
        api.get('/hr/employees?limit=1000').then(res => res.data?.data || res.data).catch(() => []),
        api.get('/enterprise-roster/rotations').then(res => res.data?.data || res.data).catch(() => []),
        api.get('/enterprise-roster').then(res => res.data?.data || res.data).catch(() => [])
      ]);

      if (shiftRes.success) setShifts(shiftRes.data);
      setEmployees(Array.isArray(empRes) ? empRes : []);
      setRotations(Array.isArray(rotationRes) ? rotationRes : []);
      setRosters(Array.isArray(rosterRes) ? rosterRes : []);
    } catch (err) {
      message.error("Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  const fetchRosterDetails = async (rosterId) => {
    try {
      setLoading(true);
      const res = await api.get(`/enterprise-roster/${rosterId}`);
      if (res.data.success) {
        const data = res.data.data;
        setActiveRoster(data);
        setAssignments(data.assignments || []);
        
        // Calculate weeks for the selected month
        const calculatedWeeks = calculateMonthWeeks(data.year, data.month);
        setWeeks(calculatedWeeks);

        // Run validation on load if there are assignments
        if (data.assignments && data.assignments.length > 0) {
          validateRoster(rosterId);
        }
      }
    } catch (err) {
      message.error("Failed to fetch roster details");
    } finally {
      setLoading(false);
    }
  };

  // Helper: Calculate weeks of a month
  const calculateMonthWeeks = (year, month) => {
    const startOfMonth = dayjs(new Date(year, month - 1, 1));
    const endOfMonth = startOfMonth.endOf('month');
    const calculated = [];
    
    let currentStart = startOfMonth;
    let weekNo = 1;

    while (currentStart.isBefore(endOfMonth) || currentStart.isSame(endOfMonth, 'day')) {
      let currentEnd = currentStart.endOf('week');
      if (currentEnd.isAfter(endOfMonth)) {
        currentEnd = endOfMonth;
      }
      calculated.push({
        weekNo,
        startDate: currentStart.format('YYYY-MM-DD'),
        endDate: currentEnd.format('YYYY-MM-DD')
      });
      currentStart = currentEnd.add(1, 'day').startOf('day');
      weekNo++;
    }
    return calculated;
  };

  const handleCreateRoster = async (values) => {
    try {
      setLoading(true);
      const date = dayjs(values.month);
      const payload = {
        rosterName: values.rosterName,
        month: date.month() + 1,
        year: date.year(),
        rosterType: values.rosterType,
        employees: values.employees
      };

      const res = await api.post('/enterprise-roster', payload);
      if (res.data.success) {
        message.success("Roster master initialized successfully!");
        setIsNewRosterOpen(false);
        newRosterForm.resetFields();
        // Refresh rosters
        const rosterRes = await api.get('/enterprise-roster');
        const updatedRosters = rosterRes.data?.data || [];
        setRosters(updatedRosters);
        
        // Set selected month to newly created roster
        setSelectedMonth(date);
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to initialize roster");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePattern = async (values) => {
    try {
      setLoading(true);
      const payload = {
        patternName: values.patternName,
        description: values.description,
        rotationType: 'Weekly',
        sequence: values.sequence
      };

      const res = await api.post('/enterprise-roster/rotations', payload);
      if (res.data.success) {
        message.success("Rotation Pattern created successfully!");
        newPatternForm.resetFields();
        // Refresh rotations
        const rotationRes = await api.get('/enterprise-roster/rotations');
        setRotations(rotationRes.data?.data || []);
      }
    } catch (err) {
      message.error("Failed to create pattern");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async (rotationId) => {
    if (!activeRoster) return;
    try {
      setGenerating(true);
      const res = await api.post('/enterprise-roster/generate', {
        rosterId: activeRoster._id,
        rotationId
      });
      if (res.data.success) {
        message.success(res.data.message);
        setIsRotationOpen(false);
        fetchRosterDetails(activeRoster._id);
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to generate assignments");
    } finally {
      setGenerating(false);
    }
  };

  const handleCellChange = (employeeId, weekNo, shiftId) => {
    const updated = [...assignments];
    const matchIndex = updated.findIndex(a => a.employeeId._id === employeeId && a.weekNo === weekNo);
    const targetWeek = weeks.find(w => w.weekNo === weekNo);

    if (matchIndex > -1) {
      updated[matchIndex] = {
        ...updated[matchIndex],
        shiftId: shifts.find(s => s._id === shiftId)
      };
    } else {
      updated.push({
        employeeId: { _id: employeeId },
        weekNo,
        shiftId: shifts.find(s => s._id === shiftId),
        startDate: targetWeek.startDate,
        endDate: targetWeek.endDate
      });
    }
    setAssignments(updated);
  };

  const handleSaveAssignments = async () => {
    if (!activeRoster) return;
    try {
      setSaving(true);
      const payload = {
        rosterId: activeRoster._id,
        assignments: assignments.map(a => ({
          employeeId: a.employeeId._id || a.employeeId,
          shiftId: a.shiftId?._id || a.shiftId,
          weekNo: a.weekNo,
          startDate: a.startDate,
          endDate: a.endDate
        }))
      };

      const res = await api.post('/enterprise-roster/assignments', payload);
      if (res.data.success) {
        message.success("Roster assignments saved successfully!");
        validateRoster(activeRoster._id);
      }
    } catch (err) {
      message.error("Failed to save assignments");
    } finally {
      setSaving(false);
    }
  };

  const validateRoster = async (rosterId) => {
    try {
      setValidating(true);
      const res = await api.post('/enterprise-roster/validate-conflicts', { rosterId });
      if (res.data.success) {
        setConflicts(res.data.conflicts || []);
        setWarnings(res.data.warnings || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!activeRoster) return;
    try {
      setLoading(true);
      const res = await api.post('/enterprise-roster/publish', { rosterId: activeRoster._id });
      if (res.data.success) {
        message.success("Roster published and synchronized to Attendance system successfully!");
        fetchRosterDetails(activeRoster._id);
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to publish roster");
    } finally {
      setLoading(false);
    }
  };

  // Build Columns for grid (Employee, Week 1, Week 2, Week 3, Week 4, Week 5)
  const buildGridColumns = () => {
    const cols = [
      {
        title: 'Employee',
        dataIndex: 'employee',
        key: 'employee',
        fixed: 'left',
        width: 220,
        render: (emp) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-700">{emp.firstName} {emp.lastName}</span>
            <span className="text-xs text-slate-400">{emp.employeeId}</span>
          </div>
        )
      }
    ];

    weeks.forEach(w => {
      cols.push({
        title: (
          <div className="text-center font-medium text-slate-600">
            <div>Week {w.weekNo}</div>
            <div className="text-[10px] text-slate-400 font-normal">
              {dayjs(w.startDate).format('DD MMM')} - {dayjs(w.endDate).format('DD MMM')}
            </div>
          </div>
        ),
        key: `week-${w.weekNo}`,
        width: 180,
        align: 'center',
        render: (_, record) => {
          const empId = record.employee._id;
          const assign = assignments.find(a => 
            (a.employeeId._id === empId || a.employeeId === empId) && a.weekNo === w.weekNo
          );
          const currentShiftId = assign?.shiftId?._id || assign?.shiftId;

          return (
            <Select
              className="w-full text-xs font-medium"
              placeholder="Select Shift"
              value={currentShiftId}
              onChange={(val) => handleCellChange(empId, w.weekNo, val)}
              disabled={activeRoster?.status === 'Published'}
              bordered={false}
              style={{
                backgroundColor: assign?.shiftId?.colorCode ? `${assign.shiftId.colorCode}15` : 'transparent',
                borderRadius: '6px'
              }}
            >
              {shifts.map(s => (
                <Option key={s._id} value={s._id}>
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full inline-block" 
                      style={{ backgroundColor: s.colorCode || '#1890ff' }}
                    />
                    <span>{s.code} ({s.name})</span>
                  </div>
                </Option>
              ))}
            </Select>
          );
        }
      });
    });

    return cols;
  };

  // Process rows from roster employees
  const getGridData = () => {
    if (!activeRoster || !activeRoster.employees) return [];
    return activeRoster.employees.map(emp => ({
      key: emp._id,
      employee: emp
    }));
  };

  const gridData = getGridData();
  const gridColumns = buildGridColumns();

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Upper control header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <CalendarDays className="text-indigo-600" size={24} />
            Enterprise Duty Roster Management
          </h2>
          <p className="text-sm text-slate-500">
            Manage advanced Weekly Rotation, Team rotations, Fair Balancing, and check validation conflicts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={(d) => d && setSelectedMonth(d)}
            allowClear={false}
            className="shadow-sm border-slate-200"
          />
          <Button 
            icon={<Layers size={16} />}
            onClick={() => setIsPatternManagerOpen(true)}
            className="flex items-center gap-1.5 border-slate-200 shadow-sm"
          >
            Rotation Patterns
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsNewRosterOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5"
          >
            Create Roster
          </Button>
        </div>
      </div>

      {activeRoster ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Roster Grid */}
          <div className="xl:col-span-3 space-y-4">
            <Card 
              className="shadow-sm border-slate-200 rounded-xl overflow-hidden"
              title={
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-700">{activeRoster.rosterName}</span>
                    <Tag color={activeRoster.status === 'Published' ? 'success' : 'warning'}>
                      {activeRoster.status}
                    </Tag>
                  </div>
                  {activeRoster.status !== 'Published' && (
                    <div className="flex gap-2">
                      <Button
                        icon={<Settings2 size={15} />}
                        onClick={() => setIsRotationOpen(true)}
                        className="flex items-center gap-1"
                      >
                        Auto-Rotate Shifts
                      </Button>
                      <Button
                        type="primary"
                        icon={<Save size={15} />}
                        onClick={handleSaveAssignments}
                        loading={saving}
                        className="flex items-center gap-1"
                      >
                        Save Assignments
                      </Button>
                      <Button
                        type="primary"
                        danger
                        icon={<CheckCircle2 size={15} />}
                        onClick={handlePublish}
                        disabled={assignments.length === 0}
                        className="flex items-center gap-1"
                      >
                        Publish & Sync
                      </Button>
                    </div>
                  )}
                </div>
              }
              bodyStyle={{ padding: 0 }}
            >
              {loading ? (
                <div className="py-20 text-center"><Spin size="large" /></div>
              ) : (
                <Table
                  columns={gridColumns}
                  dataSource={gridData}
                  scroll={{ x: 'max-content' }}
                  pagination={false}
                  bordered
                  size="middle"
                  className="custom-table"
                />
              )}
            </Card>
          </div>

          {/* Validation & conflicts panel */}
          <div className="xl:col-span-1 space-y-4">
            <Card 
              title={
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 flex items-center gap-2">
                    <ShieldAlert size={18} className="text-amber-500" />
                    Conflict Validation
                  </span>
                  <Badge count={conflicts.length + warnings.length} className="site-badge-count-4" />
                </div>
              }
              className="shadow-sm border-slate-200 rounded-xl"
              extra={
                <Button 
                  type="text" 
                  size="small" 
                  icon={<RefreshCw size={14} />} 
                  onClick={() => validateRoster(activeRoster._id)}
                  loading={validating}
                />
              }
            >
              {conflicts.length === 0 && warnings.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
                  No conflicts detected. Roster is fully balanced and ready.
                </div>
              ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {conflicts.map((c, idx) => {
                    const emp = activeRoster.employees.find(e => e._id === c.employeeId);
                    return (
                      <Alert
                        key={`conf-${idx}`}
                        message={`${emp ? emp.firstName + ' ' + emp.lastName : 'Employee'}`}
                        description={c.message}
                        type="error"
                        showIcon
                        className="text-xs rounded-lg"
                      />
                    );
                  })}
                  {warnings.map((w, idx) => {
                    const emp = activeRoster.employees.find(e => e._id === w.employeeId);
                    return (
                      <Alert
                        key={`warn-${idx}`}
                        message={`${emp ? emp.firstName + ' ' + emp.lastName : 'Employee'}`}
                        description={w.message}
                        type="warning"
                        showIcon
                        className="text-xs rounded-lg"
                      />
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <Card className="shadow-sm border-slate-200 text-center py-20 rounded-xl">
          <CalendarDays size={64} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Roster Configured</h3>
          <p className="text-slate-400 max-w-md mx-auto mb-6 text-sm">
            There is no roster initialized for {selectedMonth.format('MMMM YYYY')}. Initialize a new roster or select a different month.
          </p>
          <Button 
            type="primary" 
            onClick={() => setIsNewRosterOpen(true)}
            icon={<Plus size={16} />}
            className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 mx-auto"
          >
            Create Roster Master
          </Button>
        </Card>
      )}

      {/* MODAL: Create New Roster */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles size={18} className="text-indigo-600" />
            <span>Initialize Roster Master</span>
          </div>
        }
        open={isNewRosterOpen}
        onCancel={() => setIsNewRosterOpen(false)}
        footer={null}
        width={550}
        destroyOnClose
      >
        <Form form={newRosterForm} layout="vertical" onFinish={handleCreateRoster}>
          <Form.Item name="rosterName" label="Roster Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="e.g. HR Dept June 2026 Roster" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="month" label="Select Month/Year" rules={[{ required: true, message: 'Select month' }]}>
              <DatePicker picker="month" className="w-full" />
            </Form.Item>

            <Form.Item name="rosterType" label="Roster Mode" initialValue="Weekly Rotation" rules={[{ required: true }]}>
              <Select>
                <Option value="Manual">Manual Entry</Option>
                <Option value="Weekly Rotation">Weekly Shift Rotation</Option>
                <Option value="Team Rotation">Team Shift Rotation</Option>
                <Option value="Fair Rotation">Fair Balancing Rotation</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="employees" label="Select Employees for Roster" rules={[{ required: true, message: 'Select at least one employee' }]}>
            <Select mode="multiple" showSearch placeholder="Search and select employees" optionFilterProp="children">
              {employees.map(e => (
                <Option key={e._id} value={e._id}>{e.firstName} {e.lastName} ({e.employeeId})</Option>
              ))}
            </Select>
          </Form.Item>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button onClick={() => setIsNewRosterOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading} className="bg-indigo-600">
              Initialize Roster
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL: Auto-Rotate Shift Select */}
      <Modal
        title="Apply Weekly Rotation Pattern"
        open={isRotationOpen}
        onCancel={() => setIsRotationOpen(false)}
        footer={null}
        width={450}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Choose a rotation pattern. We will cycle this sequence of shifts across the weeks of the month for all selected employees.
          </p>
          <div className="space-y-2">
            {rotations.map(rot => (
              <div 
                key={rot._id} 
                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-all"
                onClick={() => handleAutoGenerate(rot._id)}
              >
                <div>
                  <h4 className="font-semibold text-slate-700 text-sm">{rot.patternName}</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rot.sequence.map((s, idx) => (
                      <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        W{idx + 1}: {s.code}
                      </span>
                    ))}
                  </div>
                </div>
                <Button type="link" size="small" icon={<RefreshCw size={14} />}>Apply</Button>
              </div>
            ))}
            {rotations.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">
                No patterns defined. Click "Rotation Patterns" in the top bar to create a weekly sequence first.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* DRAWER: Rotation Patterns Manager */}
      <Drawer
        title="Roster Rotation Patterns"
        placement="right"
        width={500}
        onClose={() => setIsPatternManagerOpen(false)}
        open={isPatternManagerOpen}
      >
        <div className="space-y-6">
          <Form form={newPatternForm} layout="vertical" onFinish={handleCreatePattern}>
            <h3 className="font-semibold text-slate-700 mb-3 text-sm">Create New Pattern</h3>
            <Form.Item name="patternName" label="Pattern Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. 3-Shift Weekly Cycle" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={2} placeholder="e.g. Cycles Morning, Evening, and Night shifts weekly" />
            </Form.Item>
            <Form.Item name="sequence" label="Shift Sequence Cycle" rules={[{ required: true, message: 'Select shift sequence' }]}>
              <Select mode="multiple" placeholder="Select shifts in cycle order">
                {shifts.map(s => (
                  <Option key={s._id} value={s._id}>{s.name} ({s.code})</Option>
                ))}
              </Select>
            </Form.Item>
            <Button type="primary" htmlType="submit" className="w-full bg-indigo-600">
              Save Pattern
            </Button>
          </Form>

          <hr className="border-slate-100" />

          <div>
            <h3 className="font-semibold text-slate-700 mb-3 text-sm">Existing Patterns</h3>
            <div className="space-y-3">
              {rotations.map(rot => (
                <div key={rot._id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-slate-800 text-sm">{rot.patternName}</h4>
                      <p className="text-xs text-slate-500 mt-1">{rot.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {rot.sequence.map((s, idx) => (
                      <Tag key={idx} color={s.colorCode || 'blue'} className="text-[10px] m-0 border-0">
                        Week {idx + 1}: {s.code}
                      </Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

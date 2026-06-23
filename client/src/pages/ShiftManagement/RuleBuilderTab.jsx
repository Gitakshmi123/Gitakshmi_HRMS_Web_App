import React, { useState, useEffect } from 'react';
import { 
  Form, Input, Button, Select, Space, Switch, InputNumber, 
  message, Spin, Tag, Divider, Tooltip 
} from 'antd';
import { 
  PlusOutlined, MinusCircleOutlined, SaveOutlined 
} from '@ant-design/icons';
import { 
  Settings2, Clock, AlertTriangle, Fingerprint, CalendarOff, 
  CheckCircle2, ArrowRight, Zap, Calculator, ShieldCheck, AlarmClock
} from 'lucide-react';
import shiftMasterService from '../../services/shiftMasterService';
import dayjs from 'dayjs';

const { Option } = Select;

export default function RuleBuilderTab({ activeShiftId }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(activeShiftId || null);
  const [currentPolicy, setCurrentPolicy] = useState(null);

  useEffect(() => {
    fetchShifts();
  }, []);

  useEffect(() => {
    if (selectedShift) {
      loadShiftPolicy(selectedShift);
    }
  }, [selectedShift]);

  const fetchShifts = async () => {
    try {
      const res = await shiftMasterService.getAllShifts('Active');
      if (res.success) {
        setShifts(res.data);
        if (!selectedShift && res.data.length > 0) {
          setSelectedShift(res.data[0]._id);
        }
      }
    } catch (error) {
      message.error("Failed to load shifts");
    }
  };

  const loadShiftPolicy = async (shiftId) => {
    try {
      setLoading(true);
      const res = await shiftMasterService.getShiftById(shiftId);
      if (res.success) {
        const shiftData = res.data;
        if (shiftData.currentPolicy) {
          setCurrentPolicy(shiftData.currentPolicy);
          const p = shiftData.currentPolicy;
          form.setFieldsValue({
            attendanceRules: {
              ...(p.attendanceRules || {}),
              lateMarks: p.attendanceRules?.lateMarks || [],
              earlyExit: p.attendanceRules?.earlyExit || [],
              absentThresholdMinutes: p.attendanceRules?.absentThresholdMinutes || 240,
              monthlyLateToHalfDayConversion: p.attendanceRules?.monthlyLateToHalfDayConversion || 0,
              monthlyLateAction: p.attendanceRules?.monthlyLateAction || 'HALF_DAY',
              absentCfg: p.attendanceRules?.absentCfg || { autoMarkAbsentOnNoPunch: true, sandwichLeaveEnabled: false, sandwichWeekendFill: false, sandwichHolidayFill: false }
            },
            permissionEngine: p.permissionEngine || { allowedDurations: [15, 30], monthlyLimitCount: 2, monthlyLimitMinutes: 120, yearlyLimitCount: 24, requiresApproval: true },
            overtimeEngine: p.overtimeEngine || { isEligible: false, minimumMinutesToQualify: 60, maximumMinutesPerDay: 240, normalMultiplier: 1.0, holidayMultiplier: 2.0, weeklyOffMultiplier: 2.0, nightShiftMultiplier: 1.5, requiresApproval: true }
          });
        } else {
          setCurrentPolicy(null);
          const shiftType = shiftData.type;
          
          let defaultLateMarks = [{ conditionType: 'GREATER_THAN', minutes: 15, action: 'LATE_MARK' }];
          let absentThreshold = 240; 
          let isOtEligible = false;

          if (shiftType === 'Support' || shiftType === '24x7 Support') {
            defaultLateMarks = [{ conditionType: 'GREATER_THAN', minutes: 5, action: 'HALF_DAY' }];
            isOtEligible = true;
          } else if (shiftType === 'Short Shift') {
            absentThreshold = 120;
          } else if (shiftType === 'Flexible' || shiftType === 'Project Based') {
            defaultLateMarks = []; 
          }

          form.setFieldsValue({
            attendanceRules: {
              lateMarks: defaultLateMarks,
              earlyExit: [{ conditionType: 'GREATER_THAN', minutes: 10, action: 'LATE_MARK' }],
              absentThresholdMinutes: absentThreshold,
              punchWindow: { maxAdvancePunchInMinutes: 120, maxLatePunchOutMinutes: 120 },
              absentCfg: {
                autoMarkAbsentOnNoPunch: true,
                sandwichLeaveEnabled: false,
                sandwichWeekendFill: false,
                sandwichHolidayFill: false
              },
              monthlyLateToHalfDayConversion: 0,
              monthlyLateAction: 'HALF_DAY'
            },
            permissionEngine: { allowedDurations: [15, 30, 60], monthlyLimitCount: 2, monthlyLimitMinutes: 120, yearlyLimitCount: 24, requiresApproval: true },
            overtimeEngine: { 
              isEligible: isOtEligible, 
              minimumMinutesToQualify: 60, 
              maximumMinutesPerDay: 240, 
              normalMultiplier: 1.0, 
              holidayMultiplier: 2.0, 
              weeklyOffMultiplier: 2.0, 
              nightShiftMultiplier: 1.5, 
              requiresApproval: true 
            }
          });
        }
      }
    } catch (error) {
      message.error("Failed to load policy rules");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    if (!selectedShift) return message.warning("Please select a shift first");

    try {
      setLoading(true);
      const newPolicyPayload = {
        shiftMasterId: selectedShift,
        effectiveFrom: dayjs().toDate(), 
        attendanceRules: values.attendanceRules,
        permissionEngine: values.permissionEngine,
        overtimeEngine: values.overtimeEngine,
        isNewVersion: true 
      };

      const res = await shiftMasterService.savePolicy(selectedShift, newPolicyPayload);
      
      if(res.success) {
        message.success("New Policy Version created successfully!");
        loadShiftPolicy(selectedShift);
      }
    } catch (error) {
      message.error(error.response?.data?.error || "Failed to save policy rules");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-2 md:p-6 space-y-6 max-w-[1200px] mx-auto">
      
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl flex items-center justify-center border border-indigo-100 flex-shrink-0">
            <Settings2 size={24} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Attendance Calculation Rules</h2>
          </div>
        </div>
        
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Target Shift</label>
          <Select 
            value={selectedShift} 
            onChange={setSelectedShift} 
            className="w-full md:w-[280px]"
            size="large"
            placeholder="Select a Shift..."
            showSearch
            optionFilterProp="children"
          >
            {shifts.map(s => (
              <Option key={s._id} value={s._id}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <Tag color="blue" className="mr-0 font-mono text-[10px]">{s.code}</Tag>
                </div>
              </Option>
            ))}
          </Select>
        </div>
      </div>

      <Spin spinning={loading}>
        {selectedShift ? (
          <Form form={form} layout="vertical" onFinish={handleSave} className="space-y-6">
            
            {/* 1. ATTENDANCE RULES ENGINE */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              
              <div className="p-6 space-y-8">
                {/* Late / Early Rules Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Late Rules */}
                  <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500"/>
                        <h4 className="font-semibold text-slate-700">Late in Allowed</h4>
                      </div>
                    </div>
                    
                    <Form.List name={['attendanceRules', 'lateMarks']}>
                      {(fields, { add, remove }) => (
                        <div className="space-y-3">
                          {fields.map(({ key, name, ...restField }) => (
                            <div key={key} className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">


                              <Form.Item {...restField} name={[name, 'minutes']} rules={[{ required: true }]} className="mb-0 w-24">
                                <InputNumber min={0} placeholder="Mins" className="w-full" />
                              </Form.Item>
                              <span className="font-semibold text-slate-500 text-xs uppercase px-1"><ArrowRight size={14}/></span>
                              <Form.Item {...restField} name={[name, 'action']} rules={[{ required: true }]} className="mb-0 flex-1 min-w-[120px]">
                                <Select placeholder="Action">
                                  <Option value="LATE_MARK">Late Mark</Option>
                                  <Option value="HALF_DAY">Half Day</Option>
                                  <Option value="FULL_DAY">Full Day</Option>
                                  <Option value="ABSENT">Absent</Option>
                                  <Option value="DEDUCT_LEAVE">Deduct Leave</Option>
                                </Select>
                              </Form.Item>
                              <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                            </div>
                          ))}
                          <Button type="dashed" onClick={() => add({ conditionType: 'GREATER_THAN', action: 'LATE_MARK' })} block icon={<PlusOutlined />} className="bg-white">
                            Add Late Rule
                          </Button>
                        </div>
                      )}
                    </Form.List>

                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <div className="flex flex-col mb-3">
                        <span className="text-sm font-semibold text-slate-700">Monthly Late Penalty</span>
                        <span className="text-xs text-slate-500">Apply action after a specific number of late marks in a month. (e.g., enter 4 to cut half day on 4th late mark)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Form.Item name={['attendanceRules', 'monthlyLateToHalfDayConversion']} label={<span className="text-xs font-medium">Late Marks to Trigger</span>} initialValue={0} tooltip="0 means disabled.">
                          <InputNumber min={0} className="w-full" placeholder="e.g. 4" />
                        </Form.Item>
                        <Form.Item name={['attendanceRules', 'monthlyLateAction']} label={<span className="text-xs font-medium">Penalty Action</span>} initialValue="HALF_DAY">
                          <Select>
                            <Option value="HALF_DAY">Half Day</Option>
                            <Option value="FULL_DAY">Full Day</Option>
                            <Option value="LWP">Leave Without Pay (LWP)</Option>
                          </Select>
                        </Form.Item>
                      </div>
                    </div>
                  </div>

                  {/* Early Exit Rules */}
                  <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <AlarmClock size={16} className="text-orange-500"/>
                        <h4 className="font-semibold text-slate-700">Early out Allowed</h4>
                      </div>
                    </div>
                    
                    <Form.List name={['attendanceRules', 'earlyExit']}>
                      {(fields, { add, remove }) => (
                        <div className="space-y-3">
                          {fields.map(({ key, name, ...restField }) => (
                            <div key={key} className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">


                              <Form.Item {...restField} name={[name, 'minutes']} rules={[{ required: true }]} className="mb-0 w-24">
                                <InputNumber min={0} placeholder="Mins" className="w-full" />
                              </Form.Item>
                              <span className="font-semibold text-slate-500 text-xs uppercase px-1"><ArrowRight size={14}/></span>
                              <Form.Item {...restField} name={[name, 'action']} rules={[{ required: true }]} className="mb-0 flex-1 min-w-[120px]">
                                <Select placeholder="Action">
                                  <Option value="LATE_MARK">Late Mark</Option>
                                  <Option value="HALF_DAY">Half Day</Option>
                                  <Option value="FULL_DAY">Full Day</Option>
                                  <Option value="ABSENT">Absent</Option>
                                  <Option value="DEDUCT_LEAVE">Deduct Leave</Option>
                                </Select>
                              </Form.Item>
                              <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                            </div>
                          ))}
                          <Button type="dashed" onClick={() => add({ conditionType: 'GREATER_THAN', action: 'HALF_DAY' })} block icon={<PlusOutlined />} className="bg-white">
                            Add Early Exit Rule
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  </div>
                </div>

                {/* Absent & Sandwich Leave Rules */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarOff size={16} className="text-rose-500"/>
                    <h4 className="font-semibold text-slate-700">Absence & Sandwich Policies</h4>
                  </div>
                  
                  <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">

                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-white p-4 rounded-lg border border-rose-50">
                      <Form.Item name={['attendanceRules', 'absentCfg', 'autoMarkAbsentOnNoPunch']} valuePropName="checked" className="mb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">Auto Mark Absent (No Punch)</span>
                          <Switch />
                        </div>
                      </Form.Item>

                      <Form.Item name={['attendanceRules', 'absentCfg', 'sandwichLeaveEnabled']} valuePropName="checked" className="mb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">Enable Sandwich Rule</span>
                          <Switch />
                        </div>
                      </Form.Item>

                      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.attendanceRules?.absentCfg?.sandwichLeaveEnabled !== cur.attendanceRules?.absentCfg?.sandwichLeaveEnabled}>
                        {({ getFieldValue }) =>
                          getFieldValue(['attendanceRules', 'absentCfg', 'sandwichLeaveEnabled']) ? (
                            <>
                              <Form.Item name={['attendanceRules', 'absentCfg', 'sandwichWeekendFill']} valuePropName="checked" className="mb-0">
                                <div className="flex items-center justify-between pl-4 border-l-2 border-rose-200">
                                  <span className="text-sm text-slate-600">Apply to Weekends</span>
                                  <Switch size="small" />
                                </div>
                              </Form.Item>
                              <Form.Item name={['attendanceRules', 'absentCfg', 'sandwichHolidayFill']} valuePropName="checked" className="mb-0">
                                <div className="flex items-center justify-between pl-4 border-l-2 border-rose-200">
                                  <span className="text-sm text-slate-600">Apply to Holidays</span>
                                  <Switch size="small" />
                                </div>
                              </Form.Item>
                            </>
                          ) : null
                        }
                      </Form.Item>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. PERMISSION ENGINE & OVERTIME (Side by side on Desktop) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Permissions */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-emerald-50/50 border-b border-emerald-100 px-6 py-4 flex items-center gap-3">
                  <ShieldCheck size={20} className="text-emerald-600"/>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Short Leave Configuration</h3>
                  </div>
                </div>
                <div className="p-6 flex-1 space-y-6">
                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue }) => {
                      const count = getFieldValue(['permissionEngine', 'monthlyLimitCount']);
                      const hrs = getFieldValue(['permissionEngine', 'monthlyLimitMinutes']);
                      const perLeave = (count && hrs && count > 0) ? (hrs / count) : null;
                      const perLeaveDisplay = perLeave !== null
                        ? (perLeave % 1 === 0 ? perLeave : perLeave.toFixed(1))
                        : null;
                      return (
                        <div>
                          <div className="grid grid-cols-2 gap-4">
                            <Form.Item name={['permissionEngine', 'monthlyLimitCount']} label="Max Permissions/Month" className="mb-0">
                              <InputNumber min={0} className="w-full" size="large" />
                            </Form.Item>
                            <Form.Item name={['permissionEngine', 'monthlyLimitMinutes']} label="Total Hours/Month" className="mb-0">
                              <InputNumber min={0} step={0.5} className="w-full" size="large" addonAfter="hrs" />
                            </Form.Item>
                          </div>

                        </div>
                      );
                    }}
                  </Form.Item>
                  <Form.Item hidden name={['permissionEngine', 'yearlyLimitCount']}>
                    <InputNumber />
                  </Form.Item>

                  <div className="pt-4 border-t border-slate-100">
                    <Form.Item name={['permissionEngine', 'requiresApproval']} valuePropName="checked" className="mb-0">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-sm font-bold text-slate-700 block">Require Manager Approval</span>
                          <span className="text-xs text-slate-500">If off, permissions within limits are auto-approved.</span>
                        </div>
                        <Switch />
                      </div>
                    </Form.Item>
                  </div>
                </div>
              </div>

              {/* Overtime */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-blue-50/50 border-b border-blue-100 px-6 py-4 flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-3">
                    <Calculator size={20} className="text-blue-600"/>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">Overtime Configuration</h3>
                    </div>
                  </div>
                  <Form.Item name={['overtimeEngine', 'isEligible']} valuePropName="checked" className="mb-0">
                    <Switch />
                  </Form.Item>
                </div>
                
                <Form.Item noStyle shouldUpdate>
                  {({ getFieldValue }) =>
                    getFieldValue(['overtimeEngine', 'isEligible']) ? (
                      <div className="p-6 flex-1 space-y-6">

                        {/* Row 1: OT Applicable + OT Start After */}
                        <div className="grid grid-cols-2 gap-4">
                          <Form.Item
                            name={['overtimeEngine', 'otApplicable']}
                            label="OT Applicable"
                            tooltip="Which days OT is applicable">
                            <Select placeholder="Select..." size="large">
                              <Option value="ALL_DAYS">All Days</Option>
                              <Option value="WEEKDAYS_ONLY">Weekdays Only</Option>
                              <Option value="WEEKENDS_ONLY">Weekends Only</Option>
                              <Option value="HOLIDAYS_ONLY">Holidays Only</Option>
                              <Option value="WEEKDAYS_AND_HOLIDAYS">Weekdays + Holidays</Option>
                            </Select>
                          </Form.Item>
                          <Form.Item
                            name={['overtimeEngine', 'otStartAfterMinutes']}
                            label="OT Start After"
                            tooltip="OT begins only after employee works this many extra minutes beyond shift end">
                            <InputNumber min={0} className="w-full" size="large" addonAfter="mins" />
                          </Form.Item>
                        </div>

                        {/* Row 2: Minimum OT + OT Rounding */}
                        <div className="grid grid-cols-2 gap-4">
                          <Form.Item
                            name={['overtimeEngine', 'minimumMinutesToQualify']}
                            label="Minimum OT"
                            tooltip="Employee must work at least this many OT minutes to be eligible for payout">
                            <InputNumber min={0} className="w-full" size="large" addonAfter="mins" />
                          </Form.Item>
                          <Form.Item
                            name={['overtimeEngine', 'otRoundingMinutes']}
                            label="OT Rounding"
                            tooltip="Round OT to nearest selected interval (e.g., 15 mins means 17 mins OT rounds to 15 mins)">
                            <Select placeholder="No Rounding" size="large">
                              <Option value={0}>No Rounding</Option>
                              <Option value={5}>Round to 5 mins</Option>
                              <Option value={10}>Round to 10 mins</Option>
                              <Option value={15}>Round to 15 mins</Option>
                              <Option value={30}>Round to 30 mins</Option>
                              <Option value={60}>Round to 1 hr</Option>
                            </Select>
                          </Form.Item>
                        </div>

                        {/* Row 3: Max OT Per Day */}
                        <div className="grid grid-cols-2 gap-4">
                          <Form.Item
                            name={['overtimeEngine', 'maximumMinutesPerDay']}
                            label="Max. OT Per Day"
                            tooltip="Cap OT hours per day">
                            <InputNumber min={0} className="w-full" size="large" addonAfter="mins" />
                          </Form.Item>
                        </div>

                        {/* Shift End Logic */}
                        <Divider className="my-2 text-xs text-slate-400 font-semibold" orientation="left" plain>
                          <span className="flex items-center gap-1.5"><Clock size={13}/> Shift End Logic</span>
                        </Divider>
                        <div className="grid grid-cols-2 gap-4">
                          <Form.Item
                            name={['overtimeEngine', 'shiftEndGraceMinutes']}
                            label="Shift End Grace"
                            tooltip="Employee staying within this time after shift end is NOT counted as OT. Acts as a buffer before OT clock begins.">
                            <InputNumber min={0} className="w-full" size="large" addonAfter="mins" />
                          </Form.Item>
                          <Form.Item
                            name={['overtimeEngine', 'maxStayAfterShiftMinutes']}
                            label="Max Stay After Shift"
                            tooltip="Maximum time an employee is allowed to stay after shift end. Beyond this, system flags it as an anomaly.">
                            <InputNumber min={0} className="w-full" size="large" addonAfter="mins" />
                          </Form.Item>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Form.Item
                            name={['overtimeEngine', 'shiftEndAction']}
                            label="After Shift End Action"
                            tooltip="What happens when employee exceeds Max Stay After Shift">
                            <Select placeholder="Select action..." size="large">
                              <Option value="NONE">No Action</Option>
                              <Option value="AUTO_PUNCH_OUT">Auto Punch-Out</Option>
                              <Option value="FLAG_ANOMALY">Flag as Anomaly</Option>
                              <Option value="NOTIFY_MANAGER">Notify Manager</Option>
                            </Select>
                          </Form.Item>
                          <Form.Item
                            name={['overtimeEngine', 'countShiftEndGraceAsOT']}
                            label="Count Grace Period as OT"
                            tooltip="If ON, the grace period minutes are also counted as OT. If OFF, grace period is excluded from OT.">
                            <div className="flex items-center gap-3 pt-1">
                              <Form.Item name={['overtimeEngine', 'countShiftEndGraceAsOT']} valuePropName="checked" noStyle>
                                <Switch />
                              </Form.Item>
                              <span className="text-sm text-slate-500">Include in OT</span>
                            </div>
                          </Form.Item>
                        </div>


                        {/* Hidden fields — fixed 2.0 multiplier sent to backend */}
                        <Form.Item hidden name={['overtimeEngine', 'normalMultiplier']}><InputNumber /></Form.Item>
                        <Form.Item hidden name={['overtimeEngine', 'holidayMultiplier']}><InputNumber /></Form.Item>
                        <Form.Item hidden name={['overtimeEngine', 'weeklyOffMultiplier']}><InputNumber /></Form.Item>
                        <Form.Item hidden name={['overtimeEngine', 'nightShiftMultiplier']}><InputNumber /></Form.Item>

                        <div className="pt-4 border-t border-slate-100">
                          <Form.Item name={['overtimeEngine', 'requiresApproval']} valuePropName="checked" className="mb-0">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                              <div>
                                <span className="text-sm font-bold text-slate-700 block">Require Manager Approval for OT</span>
                                <span className="text-xs text-slate-500">If off, OT is automatically calculated and pushed to payroll.</span>
                              </div>
                              <Switch />
                            </div>
                          </Form.Item>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
                        <Zap size={32} className="mb-3 opacity-20"/>
                        <p>Overtime is disabled for this shift.</p>
                      </div>
                    )
                  }
                </Form.Item>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="sticky bottom-4 z-10 flex justify-end p-4 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg mt-8">
               <Space size="middle">
                 <Button disabled={loading} size="large" className="rounded-xl font-medium">Discard Changes</Button>
                 <Button type="primary" htmlType="submit" icon={<CheckCircle2 size={18} />} loading={loading} size="large"
                   className="rounded-xl font-semibold shadow-md shadow-indigo-500/20"
                   style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', border: 'none' }}>
                   Save Policy Version
                 </Button>
               </Space>
            </div>
          </Form>
        ) : (
           <div className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center py-24 shadow-sm mt-6">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border-4 border-white shadow-sm">
               <Settings2 size={32} className="text-slate-300"/>
             </div>
             <p className="text-lg font-bold text-slate-700">No Shift Selected</p>
             <p className="text-slate-500 mt-2 max-w-sm text-center">Please select a Shift Master from the dropdown above to configure its dynamic rules and policies.</p>
           </div>
        )}
      </Spin>
    </div>
  );
}

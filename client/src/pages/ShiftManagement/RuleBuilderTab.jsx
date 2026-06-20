import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Space, Card, Divider, Switch, InputNumber, message, Spin } from 'antd';
import { PlusOutlined, MinusCircleOutlined, SaveOutlined } from '@ant-design/icons';
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
      if (res.success && res.data.currentPolicy) {
        setCurrentPolicy(res.data.currentPolicy);
        
        // Transform backend data to form data
        const p = res.data.currentPolicy;
        form.setFieldsValue({
          attendanceRules: p.attendanceRules || { lateMarks: [], earlyExit: [], absentThresholdMinutes: 240 },
          permissionEngine: p.permissionEngine || { allowedDurations: [15, 30], monthlyLimitCount: 2, monthlyLimitMinutes: 120, yearlyLimitCount: 24, requiresApproval: true },
          overtimeEngine: p.overtimeEngine || { isEligible: false, minimumMinutesToQualify: 60, maximumMinutesPerDay: 240, normalMultiplier: 1.0, holidayMultiplier: 2.0, weeklyOffMultiplier: 2.0, nightShiftMultiplier: 1.5, requiresApproval: true }
        });
      } else {
        setCurrentPolicy(null);
        form.resetFields();
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
      // Construct the new policy object
      const newPolicyPayload = {
        shiftMasterId: selectedShift,
        effectiveFrom: dayjs().toDate(), // In Phase 1, Effective from is Immediate. Phase 4 handles future effective dates.
        attendanceRules: values.attendanceRules,
        permissionEngine: values.permissionEngine,
        overtimeEngine: values.overtimeEngine,
        // Send a specific flag to the backend to create a NEW version rather than overwriting
        isNewVersion: true 
      };

      // Since the backend 'updateShift' currently just updates the ShiftMaster, we need a specific API for updating Policy.
      // We'll use a hypothetical `savePolicy` endpoint we need to add to the controller next.
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
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Dynamic Rule Builder</h2>
          <p className="text-sm text-slate-500">Configure JSON logic for Attendance, Permissions, and Overtime.</p>
        </div>
        <div>
          <span className="mr-2 font-medium">Select Shift:</span>
          <Select 
            value={selectedShift} 
            onChange={setSelectedShift} 
            style={{ width: 250 }}
            placeholder="Select a Shift to configure"
          >
            {shifts.map(s => <Option key={s._id} value={s._id}>{s.name} ({s.code})</Option>)}
          </Select>
        </div>
      </div>

      <Spin spinning={loading}>
        {selectedShift ? (
          <Form form={form} layout="vertical" onFinish={handleSave}>
            
            {/* ============================== */}
            {/* 1. ATTENDANCE RULES ENGINE     */}
            {/* ============================== */}
            <Card title="Attendance Rules Engine" className="mb-6 shadow-sm border-slate-200" headStyle={{ backgroundColor: '#f8fafc' }}>
              <div className="mb-4 text-sm text-slate-500">
                Define the logical rules for Late Marks, Half Days, and Absences based on punch timings.
              </div>

              <div className="flex gap-4 mb-6">
                 <Form.Item name={['attendanceRules', 'absentThresholdMinutes']} label="Mark Absent if Working Hours < (Minutes)" className="mb-0">
                    <InputNumber min={0} />
                 </Form.Item>
              </div>

              {/* Late Mark Rules List */}
              <Divider orientation="left" plain>Late Arrival Logic</Divider>
              <Form.List name={['attendanceRules', 'lateMarks']}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <span className="font-semibold text-slate-600">IF Late</span>
                        <Form.Item {...restField} name={[name, 'conditionType']} rules={[{ required: true, message: 'Missing condition' }]}>
                          <Select placeholder="Condition" style={{ width: 140 }}>
                            <Option value="GREATER_THAN">{'>'} (Greater Than)</Option>
                            <Option value="LESS_THAN">{'<'} (Less Than)</Option>
                          </Select>
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'minutes']} rules={[{ required: true, message: 'Missing minutes' }]}>
                          <InputNumber placeholder="Minutes" min={0} />
                        </Form.Item>
                        <span className="font-semibold text-slate-600">THEN</span>
                        <Form.Item {...restField} name={[name, 'action']} rules={[{ required: true, message: 'Missing action' }]}>
                          <Select placeholder="Action" style={{ width: 150 }}>
                            <Option value="LATE_MARK">Late Mark</Option>
                            <Option value="HALF_DAY">Half Day</Option>
                            <Option value="ABSENT">Absent</Option>
                            <Option value="DEDUCT_LEAVE">Deduct Leave</Option>
                          </Select>
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} className="text-red-500 ml-2" />
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add({ conditionType: 'GREATER_THAN', action: 'LATE_MARK' })} block icon={<PlusOutlined />}>
                        Add Late Rule
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>

              {/* Early Exit Rules List */}
              <Divider orientation="left" plain>Early Exit Logic</Divider>
              <Form.List name={['attendanceRules', 'earlyExit']}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <span className="font-semibold text-slate-600">IF Early Exit</span>
                        <Form.Item {...restField} name={[name, 'conditionType']} rules={[{ required: true }]}>
                          <Select placeholder="Condition" style={{ width: 140 }}>
                            <Option value="GREATER_THAN">{'>'} (Greater Than)</Option>
                            <Option value="LESS_THAN">{'<'} (Less Than)</Option>
                          </Select>
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'minutes']} rules={[{ required: true }]}>
                          <InputNumber placeholder="Minutes" min={0} />
                        </Form.Item>
                        <span className="font-semibold text-slate-600">THEN</span>
                        <Form.Item {...restField} name={[name, 'action']} rules={[{ required: true }]}>
                          <Select placeholder="Action" style={{ width: 150 }}>
                            <Option value="LATE_MARK">Late Mark</Option>
                            <Option value="HALF_DAY">Half Day</Option>
                            <Option value="ABSENT">Absent</Option>
                            <Option value="DEDUCT_LEAVE">Deduct Leave</Option>
                          </Select>
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} className="text-red-500 ml-2" />
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add({ conditionType: 'GREATER_THAN', action: 'HALF_DAY' })} block icon={<PlusOutlined />}>
                        Add Early Exit Rule
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Card>

            {/* ============================== */}
            {/* 2. PERMISSION ENGINE           */}
            {/* ============================== */}
            <Card title="Permission Engine" className="mb-6 shadow-sm border-slate-200" headStyle={{ backgroundColor: '#f8fafc' }}>
               <div className="grid grid-cols-3 gap-6">
                  <Form.Item name={['permissionEngine', 'monthlyLimitCount']} label="Max Permissions Per Month">
                    <InputNumber min={0} className="w-full" />
                  </Form.Item>
                  <Form.Item name={['permissionEngine', 'monthlyLimitMinutes']} label="Max Minutes Per Month">
                    <InputNumber min={0} className="w-full" />
                  </Form.Item>
                  <Form.Item name={['permissionEngine', 'yearlyLimitCount']} label="Max Permissions Per Year">
                    <InputNumber min={0} className="w-full" />
                  </Form.Item>
               </div>
               <div className="grid grid-cols-2 gap-6 mt-2">
                  <Form.Item name={['permissionEngine', 'requiresApproval']} valuePropName="checked">
                    <Switch checkedChildren="Requires Workflow Approval" unCheckedChildren="Auto Approved" />
                  </Form.Item>
               </div>
            </Card>

            {/* ============================== */}
            {/* 3. OVERTIME ENGINE             */}
            {/* ============================== */}
            <Card title="Overtime Engine" className="mb-6 shadow-sm border-slate-200" headStyle={{ backgroundColor: '#f8fafc' }}>
              <div className="mb-4">
                <Form.Item name={['overtimeEngine', 'isEligible']} valuePropName="checked">
                   <Switch checkedChildren="Overtime Enabled for this Shift" unCheckedChildren="Overtime Disabled" />
                </Form.Item>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-4">
                 <Form.Item name={['overtimeEngine', 'minimumMinutesToQualify']} label="Minimum Minutes to Qualify for OT">
                    <InputNumber min={0} className="w-full" />
                 </Form.Item>
                 <Form.Item name={['overtimeEngine', 'maximumMinutesPerDay']} label="Maximum OT Minutes Per Day">
                    <InputNumber min={0} className="w-full" />
                 </Form.Item>
              </div>

              <Divider orientation="left" plain>OT Multipliers (Feeds into Payroll)</Divider>
              <div className="grid grid-cols-4 gap-4">
                 <Form.Item name={['overtimeEngine', 'normalMultiplier']} label="Normal Day (x)">
                    <InputNumber min={0} step={0.5} className="w-full" />
                 </Form.Item>
                 <Form.Item name={['overtimeEngine', 'holidayMultiplier']} label="Holiday (x)">
                    <InputNumber min={0} step={0.5} className="w-full" />
                 </Form.Item>
                 <Form.Item name={['overtimeEngine', 'weeklyOffMultiplier']} label="Weekly Off (x)">
                    <InputNumber min={0} step={0.5} className="w-full" />
                 </Form.Item>
                 <Form.Item name={['overtimeEngine', 'nightShiftMultiplier']} label="Night Shift (x)">
                    <InputNumber min={0} step={0.5} className="w-full" />
                 </Form.Item>
              </div>

              <Form.Item name={['overtimeEngine', 'requiresApproval']} valuePropName="checked" className="mb-0">
                <Switch checkedChildren="OT Requires Workflow Approval" unCheckedChildren="OT Auto Approved" />
              </Form.Item>
            </Card>

            {/* ACTION FOOTER */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
               <Space>
                 <Button disabled={loading}>Discard Changes</Button>
                 <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                   Save as New Policy Version
                 </Button>
               </Space>
            </div>
          </Form>
        ) : (
           <div className="text-center py-10 text-slate-500">
             Please create and select a Shift Master to configure its rules.
           </div>
        )}
      </Spin>
    </div>
  );
}

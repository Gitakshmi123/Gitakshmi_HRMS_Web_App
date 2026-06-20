import React, { useState, useEffect } from 'react';
import { Card, Form, Select, DatePicker, Button, TimePicker, message, Divider, Tag, Space, Alert } from 'antd';
import { PlayCircle, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import shiftMasterService from '../../services/shiftMasterService';

const { Option } = Select;

export default function SimulationCenterTab() {
  const [shifts, setShifts] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [policyData, setPolicyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const res = await shiftMasterService.getAllShifts('Active');
      if (res.success) setShifts(res.data);
    } catch (error) {
      message.error("Failed to fetch shifts");
    }
  };

  const handleShiftSelect = async (shiftId) => {
    setSelectedShiftId(shiftId);
    setSimulationResult(null);
    try {
      setLoading(true);
      const res = await shiftMasterService.getShiftById(shiftId);
      if (res.success && res.data.currentPolicy) {
        setPolicyData(res.data.currentPolicy);
      } else {
        setPolicyData(null);
        message.warning("This shift has no active rules configured. Go to Rule Builder.");
      }
    } catch (error) {
      message.error("Failed to load policy data");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (values) => {
    if (!policyData) return message.error("No policy loaded to simulate against.");
    
    try {
      setLoading(true);
      const punches = [
        { time: dayjs(values.date).format('YYYY-MM-DD') + 'T' + values.inTime.format('HH:mm') },
        { time: dayjs(values.date).format('YYYY-MM-DD') + 'T' + values.outTime.format('HH:mm') }
      ];

      const res = await shiftMasterService.simulateRules(policyData, punches);
      if (res.success) {
        setSimulationResult(res.data);
      }
    } catch (error) {
      message.error("Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Attendance Intelligence Simulation</h2>
        <p className="text-sm text-slate-500">Test how the Attendance Engine processes raw punches against your dynamic rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* INPUT PANEL */}
        <Card title="1. Test Parameters" className="shadow-sm border-slate-200">
          <Form form={form} layout="vertical" onFinish={handleSimulate}>
             <Form.Item name="shiftId" label="Select Shift" rules={[{ required: true }]}>
               <Select onChange={handleShiftSelect} placeholder="Select Shift to test">
                 {shifts.map(s => <Option key={s._id} value={s._id}>{s.name} ({s.code})</Option>)}
               </Select>
             </Form.Item>

             {policyData && (
                <Alert 
                  message={`Loaded Policy v${policyData.version}`} 
                  description="Ready to simulate against active rules." 
                  type="info" 
                  showIcon 
                  className="mb-4"
                />
             )}

             <Divider plain>Mock Punches</Divider>
             
             <Form.Item name="date" label="Punch Date" rules={[{ required: true }]} initialValue={dayjs()}>
               <DatePicker className="w-full" />
             </Form.Item>

             <div className="grid grid-cols-2 gap-4">
                <Form.Item name="inTime" label="In-Punch Time" rules={[{ required: true }]}>
                  <TimePicker format="HH:mm" className="w-full" />
                </Form.Item>
                <Form.Item name="outTime" label="Out-Punch Time" rules={[{ required: true }]}>
                  <TimePicker format="HH:mm" className="w-full" />
                </Form.Item>
             </div>

             <Button type="primary" htmlType="submit" icon={<PlayCircle size={16} />} block loading={loading}>
               Run Simulation
             </Button>
          </Form>
        </Card>

        {/* OUTPUT PANEL */}
        <Card title="2. Intelligence Engine Output" className="shadow-sm border-slate-200 bg-slate-50">
           {simulationResult ? (
              <div className="space-y-4">
                 <div className="flex justify-between items-center bg-white p-4 rounded border border-slate-200">
                    <span className="font-semibold text-slate-600">Final Status:</span>
                    <Tag color={
                      simulationResult.status === 'Present' ? 'success' :
                      simulationResult.status === 'Absent' ? 'error' :
                      simulationResult.status === 'Late' ? 'warning' : 'default'
                    } className="text-sm px-3 py-1">
                      {simulationResult.status.toUpperCase()}
                    </Tag>
                 </div>

                 <div className="bg-white p-4 rounded border border-slate-200 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-400">Total Working Minutes</div>
                      <div className="font-semibold">{simulationResult.totalWorkingMinutes} mins</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Late Arrival By</div>
                      <div className="font-semibold text-red-500">{simulationResult.lateMinutes} mins</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Early Exit By</div>
                      <div className="font-semibold text-orange-500">{simulationResult.earlyExitMinutes} mins</div>
                    </div>
                 </div>

                 <div className="bg-blue-50 p-4 rounded border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
                       <Clock size={16} />
                       Overtime Engine Result
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <div className="text-xs text-blue-600">Approved OT Minutes</div>
                         <div className="font-semibold text-blue-900">{simulationResult.otMinutes} mins</div>
                       </div>
                       <div>
                         <div className="text-xs text-blue-600">Multiplier Applied</div>
                         <div className="font-semibold text-blue-900">{simulationResult.otMultiplierApplied}x</div>
                       </div>
                    </div>
                 </div>
              </div>
           ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                 <PlayCircle size={48} className="mb-4 opacity-20" />
                 <p>Select a shift and run simulation to see results.</p>
              </div>
           )}
        </Card>
      </div>
    </div>
  );
}

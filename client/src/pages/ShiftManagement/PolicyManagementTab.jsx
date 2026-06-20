import React, { useState, useEffect } from 'react';
import { Table, Button, Drawer, Typography, Empty, message, Tag, Badge, Tabs } from 'antd';
import { Eye, History, GitBranch } from 'lucide-react';
import shiftMasterService from '../../services/shiftMasterService';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TabPane } = Tabs;

export default function PolicyManagementTab() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Drawer states
  const [policyHistory, setPolicyHistory] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('current');

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const res = await shiftMasterService.getAllShifts();
      if (res.success) {
        setShifts(res.data);
      }
    } catch (error) {
      message.error("Failed to fetch shifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleViewPolicy = async (shift) => {
    setSelectedShift(shift);
    setIsDrawerOpen(true);
    setDrawerLoading(true);
    
    try {
      const res = await shiftMasterService.getPolicyHistory(shift._id);
      if (res.success) {
        setPolicyHistory(res.data);
        setActiveTabKey(res.data.length > 0 ? res.data[0]._id : 'empty');
      }
    } catch (error) {
      message.error("Failed to load policy history");
    } finally {
      setDrawerLoading(false);
    }
  };

  const columns = [
    { title: 'Shift Code', dataIndex: 'code', key: 'code', render: text => <b>{text}</b> },
    { title: 'Shift Name', dataIndex: 'name', key: 'name' },
    { 
      title: 'Status', 
      dataIndex: 'status',
      key: 'status',
      render: status => <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="primary" 
          ghost 
          icon={<History size={16} />} 
          onClick={() => handleViewPolicy(record)}
        >
          View Version History
        </Button>
      )
    }
  ];

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Policy Versioning & Effective Dates</h2>
          <p className="text-sm text-slate-500">Track policy history, view JSON rules, and manage effective dates.</p>
        </div>
      </div>

      <Table 
        columns={columns} 
        dataSource={shifts} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        bordered
      />

      <Drawer
        title={
          <div className="flex items-center gap-2">
             <GitBranch size={18} />
             <span>Policy History - {selectedShift?.name} ({selectedShift?.code})</span>
          </div>
        }
        placement="right"
        width={750}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
      >
        {drawerLoading ? (
           <div className="flex justify-center p-10">Loading history...</div>
        ) : policyHistory.length > 0 ? (
          <Tabs 
            tabPosition="left" 
            activeKey={activeTabKey} 
            onChange={setActiveTabKey}
            items={policyHistory.map((policy) => ({
              key: policy._id,
              label: (
                <div className="flex flex-col items-start text-left w-full py-1">
                  <span className="font-semibold text-[13px]">
                     Version {policy.version} {policy.isCurrent && <Badge status="success" text="Active" className="ml-1" />}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                     Effective: {dayjs(policy.effectiveFrom).format('DD MMM YYYY')}
                  </span>
                </div>
              ),
              children: (
                <div>
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-4 flex justify-between items-center">
                     <div>
                       <div className="font-semibold text-slate-700">Policy Version {policy.version}</div>
                       <div className="text-sm text-slate-500">
                         Effective From: {dayjs(policy.effectiveFrom).format('DD MMM YYYY HH:mm')}
                       </div>
                     </div>
                     {policy.isCurrent ? (
                        <Tag color="green">Currently Active Engine</Tag>
                     ) : (
                        <Tag color="orange">Historical Engine</Tag>
                     )}
                  </div>

                  <div className="bg-slate-900 rounded-lg p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    <pre className="text-green-400 text-[11px] font-mono leading-relaxed">
                      {JSON.stringify({
                         attendanceRules: policy.attendanceRules,
                         permissionEngine: policy.permissionEngine,
                         overtimeEngine: policy.overtimeEngine
                      }, null, 2)}
                    </pre>
                  </div>
                </div>
              )
            }))}
          />
        ) : (
          <Empty description="No dynamic policies have been built for this shift yet." />
        )}
      </Drawer>
    </div>
  );
}

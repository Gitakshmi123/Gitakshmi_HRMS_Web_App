import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, message, Tabs, Spin } from 'antd';
import { Workflow, CheckCircle, XCircle } from 'lucide-react';
import api from '../../utils/api';
import dayjs from 'dayjs';

export default function WorkflowApprovalsTab() {
  const [activeTab, setActiveTab] = useState('pending');

  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetchPendingSwaps();
  }, []);

  const fetchPendingSwaps = async () => {
    try {
      setLoading(true);
      const res = await api.get('/swaps/pending');
      if (res.data.success) {
        setRequests(res.data.data.map(swap => ({
          key: swap._id,
          employee: `${swap.requesterId?.firstName} ${swap.requesterId?.lastName} (${swap.requesterId?.employeeId})`,
          type: 'Shift Swap',
          date: dayjs(swap.dateOfSwap).format('YYYY-MM-DD'),
          details: `Target Employee: ${swap.targetEmployeeId?.firstName} ${swap.targetEmployeeId?.lastName}`,
          status: swap.status,
          raw: swap
        })));
      }
    } catch (error) {
      message.error('Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (key, action) => {
    try {
      setLoading(true);
      const res = await api.post(`/swaps/${key}/action`, { action });
      if (res.data.success) {
        message.success(`Request ${action.toLowerCase()} successfully!`);
        fetchPendingSwaps();
      }
    } catch (error) {
      message.error(error.response?.data?.message || `Failed to process request`);
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Employee',
      dataIndex: 'employee',
      key: 'employee',
      className: 'font-medium text-slate-700'
    },
    {
      title: 'Request Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'Overtime' ? 'blue' : type === 'Shift Swap' ? 'purple' : 'cyan'}>
          {type}
        </Tag>
      )
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date'
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      width: '30%'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Pending' ? 'orange' : status === 'Approved' ? 'success' : 'error'}>
          {status}
        </Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        record.status === 'Pending' ? (
          <Space>
            <Button 
              type="text" 
              className="text-green-600 hover:bg-green-50" 
              icon={<CheckCircle size={16} />}
              onClick={() => handleAction(record.key, 'Approved')}
            >
              Approve
            </Button>
            <Button 
              type="text" 
              danger 
              icon={<XCircle size={16} />}
              onClick={() => handleAction(record.key, 'Rejected')}
            >
              Reject
            </Button>
          </Space>
        ) : (
          <span className="text-slate-400 text-sm">Action Taken</span>
        )
      )
    }
  ];

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
           <Workflow size={20} className="text-indigo-600"/> Workflow & Approvals
        </h2>
        <p className="text-sm text-slate-500">Manage shift-related requests such as Overtime, Shift Swaps, and Permissions.</p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
           <Tabs.TabPane tab="Pending Approvals" key="pending">
             <Table 
                columns={columns} 
                dataSource={requests.filter(r => r.status === 'Pending')} 
                pagination={false}
             />
           </Tabs.TabPane>
           <Tabs.TabPane tab="Approval History" key="history">
             <Table 
                columns={columns} 
                dataSource={requests.filter(r => r.status !== 'Pending')} 
                pagination={false}
             />
           </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  );
}

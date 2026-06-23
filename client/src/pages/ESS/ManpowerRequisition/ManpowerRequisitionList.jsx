import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, App, Tooltip, Typography } from 'antd';
import { Plus, Eye, FileText, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function ManpowerRequisitionList() {
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState([]);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/manpower-requisition');
      if (res.data?.success) {
        setRequisitions(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch requisitions', err);
      message.error('Failed to load manpower requisitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return 'success';
      case 'REJECTED': return 'error';
      case 'PENDING': return 'warning';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Raised On',
      dataIndex: 'requirementDate',
      key: 'requirementDate',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
    {
      title: 'Department',
      dataIndex: ['department', 'name'],
      key: 'department',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Designation',
      dataIndex: ['designation', 'name'],
      key: 'designation',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Type',
      dataIndex: 'requirementType',
      key: 'requirementType',
      render: (text) => (
        <Tag color={text === 'New' ? 'blue' : 'purple'}>{text}</Tag>
      ),
    },
    {
      title: 'Total Required',
      dataIndex: 'totalRequiredNumber',
      key: 'totalRequiredNumber',
    },
    {
      title: 'Target Date',
      dataIndex: 'positionToBeFilledByDate',
      key: 'positionToBeFilledByDate',
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{status?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button 
            type="text" 
            icon={<Eye size={16} className="text-slate-500" />} 
            onClick={() => navigate(record._id)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title level={4} className="!mb-1 text-slate-800 flex items-center gap-2">
            <Briefcase className="text-blue-600" size={24} />
            Manpower Requisitions
          </Title>
          <Text className="text-slate-500">Manage and track your manpower requirement requests.</Text>
        </div>
        <Button 
          type="primary" 
          icon={<Plus size={16} />} 
          onClick={() => navigate('new')}
          className="bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg"
        >
          Raise Request
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={requisitions} 
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          className="ant-table-striped"
        />
      </Card>
    </div>
  );
}

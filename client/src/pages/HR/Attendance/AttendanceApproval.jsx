import React, { useState } from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Badge, Space } from 'antd';
import { FilterOutlined, DownOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AttendanceApproval() {
  const [activeTab, setActiveTab] = useState('Pending');
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    fromDate: null,
    toDate: null,
    employee: 'All'
  });

  React.useEffect(() => {
    fetchRequests();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employee');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setEmployees(res.data.data);
      }
    } catch (err) {}
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hr/regularization'); // Using the same endpoint for HR approval view
      if (res.data && res.data.success) {
        setData(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    handleFilter();
  }, [data, activeTab, filters]);

  const handleFilter = () => {
    let filtered = [...data];
    if (activeTab === 'Pending') filtered = filtered.filter(item => item.status === 'Pending' || item.status === 'PENDING');
    else if (activeTab === 'Approved') filtered = filtered.filter(item => item.status === 'Approved' || item.status === 'APPROVED');
    else if (activeTab === 'Rejected') filtered = filtered.filter(item => item.status === 'Rejected' || item.status === 'REJECTED');
    
    if (filters.employee !== 'All') {
      filtered = filtered.filter(item => item.employee?._id === filters.employee || item.employee === filters.employee);
    }
    
    setFilteredData(filtered);
  };

  const columns = [
    { title: 'Sr. No.', dataIndex: 'srNo', width: 60 },
    { title: 'Req. ID', dataIndex: '_id', width: 100, render: id => id?.substring(0,8).toUpperCase() },
    { title: 'Emp. Code', dataIndex: ['employee', 'empCode'], width: 90 },
    { title: 'Employee Name', dataIndex: ['employee', 'name'], width: 150 },
    { title: 'Date', dataIndex: 'date', width: 100, render: d => d ? new Date(d).toLocaleDateString() : '-' },
    { title: 'Request Type', dataIndex: 'requestType', width: 140 },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      width: 100,
      render: text => <Badge status={text === 'Pending' ? 'warning' : text === 'Approved' ? 'success' : 'error'} text={text} />
    },
    { 
      title: 'Action', 
      key: 'action', 
      width: 100,
      render: (_, record) => record.status === 'Pending' ? (
        <Space size="small">
          <Button size="small" type="primary" className="bg-green-600" icon={<CheckOutlined />} />
          <Button size="small" type="primary" danger icon={<CloseOutlined />} />
        </Space>
      ) : <Text type="secondary">-</Text>
    },
  ];

    },
  ];

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={4} className="m-0">Attendance Approval</Title>
          <Text type="secondary" className="text-xs">Approve regularization requests</Text>
        </div>
      </div>

      <div className="flex space-x-4 mb-4 border-b border-gray-200">
        {['Pending', 'Approved', 'Rejected'].map(tab => (
          <div 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`cursor-pointer pb-2 px-1 border-b-2 text-sm ${activeTab === tab ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-blue-500'}`}
          >
            {tab} {tab === 'Pending' && '(8)'} {tab === 'Approved' && '(40)'} {tab === 'Rejected' && '(6)'}
          </div>
        ))}
      </div>

      <Card size="small" className="mb-4 bg-gray-50 border border-gray-200 shadow-sm">
        <Row gutter={[12, 12]} align="bottom">
          <Col span={6}>
            <Text className="text-xs">From Date</Text>
            <DatePicker value={filters.fromDate} onChange={d => setFilters({...filters, fromDate: d})} size="small" className="w-full" />
          </Col>
          <Col span={6}>
            <Text className="text-xs">To Date</Text>
            <DatePicker value={filters.toDate} onChange={d => setFilters({...filters, toDate: d})} size="small" className="w-full" />
          </Col>
          <Col span={6}>
            <Text className="text-xs">Employee</Text>
            <Select value={filters.employee} onChange={v => setFilters({...filters, employee: v})} size="small" className="w-full">
              <Option value="All">All</Option>
              {employees.map(e => <Option key={e._id} value={e._id}>{e.name || (e.firstName + ' ' + e.lastName)} ({e.empCode || e.employeeCode})</Option>)}
            </Select>
          </Col>
          <Col span={6} className="text-right">
            <Button type="primary" icon={<FilterOutlined />}>Apply Filter</Button>
          </Col>
        </Row>
      </Card>

      <Table
        loading={loading}
        columns={columns}
        dataSource={filteredData}
        rowKey="_id"
        size="small"
        bordered
        pagination={{ pageSize: 15 }}
        className="text-[12px]"
      />
    </div>
  );
}

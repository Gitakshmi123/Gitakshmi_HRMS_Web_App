import React, { useState } from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Badge, Space } from 'antd';
import { FilterOutlined, DownOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AttendanceApproval() {
  const [activeTab, setActiveTab] = useState('Pending');

  const columns = [
    { title: 'Sr. No.', dataIndex: 'srNo', width: 60 },
    { title: 'Req. ID', dataIndex: 'reqId', width: 100 },
    { title: 'Emp. Code', dataIndex: 'empCode', width: 90 },
    { title: 'Employee Name', dataIndex: 'name', width: 150 },
    { title: 'Date', dataIndex: 'date', width: 100 },
    { title: 'Request Type', dataIndex: 'reqType', width: 140 },
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

  const dataSource = [
    { key: '1', srNo: 1, reqId: 'RQ2026001', empCode: 'E00123', name: 'Rahul Kumar', date: '07-06-2026', reqType: 'In Time Correction', status: 'Pending' },
    { key: '2', srNo: 2, reqId: 'RQ2026002', empCode: 'E00124', name: 'Priya Sharma', date: '08-06-2026', reqType: 'Out Time Correction', status: 'Pending' },
    { key: '3', srNo: 3, reqId: 'RQ2026003', empCode: 'E00125', name: 'Amit Patel', date: '09-06-2026', reqType: 'Full Day Present', status: 'Pending' },
    { key: '4', srNo: 4, reqId: 'RQ2026004', empCode: 'E00126', name: 'Neha Jain', date: '10-06-2026', reqType: 'In/Out Correction', status: 'Pending' },
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
            <DatePicker size="small" className="w-full" />
          </Col>
          <Col span={6}>
            <Text className="text-xs">To Date</Text>
            <DatePicker size="small" className="w-full" />
          </Col>
          <Col span={6}>
            <Text className="text-xs">Employee</Text>
            <Select defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select>
          </Col>
          <Col span={6} className="text-right">
            <Button type="primary" icon={<FilterOutlined />}>Apply Filter</Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={activeTab === 'Pending' ? dataSource : []}
        size="small"
        bordered
        pagination={{ pageSize: 15 }}
        className="text-[12px]"
      />
    </div>
  );
}

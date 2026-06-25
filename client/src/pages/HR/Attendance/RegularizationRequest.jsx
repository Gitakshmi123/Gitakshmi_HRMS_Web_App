import React, { useState } from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Badge, Space } from 'antd';
import { FilterOutlined, DownOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function RegularizationRequest() {
  const [activeTab, setActiveTab] = useState('Pending');

  const columns = [
    { title: 'Sr. No.', dataIndex: 'srNo', width: 60 },
    { title: 'Req. ID', dataIndex: 'reqId', width: 100 },
    { title: 'Emp. Code', dataIndex: 'empCode', width: 90 },
    { title: 'Employee Name', dataIndex: 'name', width: 150 },
    { title: 'Date', dataIndex: 'date', width: 100 },
    { title: 'Request Type', dataIndex: 'reqType', width: 140 },
    { title: 'Current Status', dataIndex: 'currStatus', width: 100, render: text => <Text type="secondary">{text}</Text> },
    { title: 'Requested In', dataIndex: 'reqIn', width: 100, render: text => <Text strong>{text || '-'}</Text> },
    { title: 'Requested Out', dataIndex: 'reqOut', width: 100, render: text => <Text strong>{text || '-'}</Text> },
    { title: 'Reason', dataIndex: 'reason', width: 150 },
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
    { key: '1', srNo: 1, reqId: 'RQ2026001', empCode: 'E00123', name: 'Rahul Kumar', date: '07-06-2026', reqType: 'In Time Correction', currStatus: '-', reqIn: '09:00', reqOut: '18:00', reason: 'Biometric Issue', status: 'Pending' },
    { key: '2', srNo: 2, reqId: 'RQ2026002', empCode: 'E00124', name: 'Priya Sharma', date: '08-06-2026', reqType: 'Out Time Correction', currStatus: '-', reqIn: '09:00', reqOut: '19:30', reason: 'Client meeting', status: 'Pending' },
    { key: '3', srNo: 3, reqId: 'RQ2026003', empCode: 'E00125', name: 'Amit Patel', date: '09-06-2026', reqType: 'Full Day Present', currStatus: 'Absent', reqIn: '09:00', reqOut: '18:00', reason: 'Forgot to punch', status: 'Pending' },
    { key: '4', srNo: 4, reqId: 'RQ2026004', empCode: 'E00126', name: 'Neha Jain', date: '10-06-2026', reqType: 'In/Out Correction', currStatus: '-', reqIn: '09:15', reqOut: '18:15', reason: 'System issue', status: 'Pending' },
  ];

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={4} className="m-0">Regularization Request</Title>
          <Text type="secondary" className="text-xs">Employee requests for correction</Text>
        </div>
      </div>

      <div className="flex space-x-4 mb-4 border-b border-gray-200">
        {['Pending', 'Approved', 'Rejected', 'Cancelled'].map(tab => (
          <div 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`cursor-pointer pb-2 px-1 border-b-2 text-sm ${activeTab === tab ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-blue-500'}`}
          >
            {tab} {tab === 'Pending' && '(12)'} {tab === 'Approved' && '(25)'} {tab === 'Rejected' && '(5)'}
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

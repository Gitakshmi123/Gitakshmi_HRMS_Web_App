import React from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker } from 'antd';
import { FilterOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AttendanceLock() {
  
  const columns = [
    { title: 'Sr. No.', dataIndex: 'srNo', width: 60 },
    { title: 'Period', dataIndex: 'period', width: 200 },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      width: 100,
      render: text => <Text className={text === 'Locked' ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}>{text}</Text>
    },
    { title: 'Locked By', dataIndex: 'lockedBy', width: 150 },
    { title: 'Locked On', dataIndex: 'lockedOn', width: 150 },
    { title: 'Unlock By', dataIndex: 'unlockBy', width: 150, render: text => text || '-' },
    { title: 'Unlock On', dataIndex: 'unlockOn', width: 150, render: text => text || '-' },
    { 
      title: 'Action', 
      key: 'action', 
      width: 100,
      render: (_, record) => record.status === 'Locked' 
        ? <Button size="small" icon={<UnlockOutlined />} /> 
        : <Button size="small" danger icon={<LockOutlined />} />
    },
  ];

  const dataSource = [
    { key: '1', srNo: 1, period: '01-06-2026 To 31-06-2026', status: 'Locked', lockedBy: 'Sandeep Kumar', lockedOn: '01-06-2026 11:30', unlockBy: '', unlockOn: '' },
    { key: '2', srNo: 2, period: '01-05-2026 To 31-05-2026', status: 'Open', lockedBy: '-', lockedOn: '-', unlockBy: '-', unlockOn: '-' },
  ];

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={4} className="m-0">Attendance Lock</Title>
          <Text type="secondary" className="text-xs">Lock attendance for payroll processing</Text>
        </div>
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
          <Col span={12} className="text-right">
            <Button type="primary" icon={<FilterOutlined />}>Apply Filter</Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={dataSource}
        size="small"
        bordered
        pagination={false}
        className="text-[12px]"
      />
    </div>
  );
}

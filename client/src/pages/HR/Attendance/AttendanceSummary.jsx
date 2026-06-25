import React from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Space } from 'antd';
import { FilterOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AttendanceSummary() {
  
  const columns = [
    { title: 'Summary For', dataIndex: 'summaryFor', width: 120, render: text => <Text strong>{text}</Text> },
    { title: 'Total Emp.', dataIndex: 'totalEmp', width: 100 },
    { title: 'Present Days', dataIndex: 'present', width: 100, render: text => <Text className="text-green-600">{text}</Text> },
    { title: 'Absent Days', dataIndex: 'absent', width: 100, render: text => <Text className="text-red-500">{text}</Text> },
    { title: 'Leave Days', dataIndex: 'leave', width: 100, render: text => <Text className="text-orange-500">{text}</Text> },
    { title: 'OD Days', dataIndex: 'od', width: 100, render: text => <Text className="text-blue-600">{text}</Text> },
    { title: 'WO Days', dataIndex: 'wo', width: 100 },
    { title: 'Holiday', dataIndex: 'holiday', width: 100 },
    { title: 'Short Hours', dataIndex: 'shortHrs', width: 100, render: text => <Text className="text-pink-500">{text}</Text> },
  ];

  const dataSource = [
    { key: '1', summaryFor: 'IT', totalEmp: 50, present: 22.8, absent: 1.2, leave: 2.4, od: 1.1, wo: 4.0, holiday: 1.0, shortHrs: '15:20' },
    { key: '2', summaryFor: 'HR', totalEmp: 120, present: 23.5, absent: 1.0, leave: 1.8, od: 0.8, wo: 4.0, holiday: 2.0, shortHrs: '08:30' },
    { key: '3', summaryFor: 'Finance', totalEmp: 160, present: 21.9, absent: 1.5, leave: 2.1, od: 0.7, wo: 4.0, holiday: 2.0, shortHrs: '12:15' },
    { key: '4', summaryFor: 'Operations', totalEmp: 200, present: 22.1, absent: 1.4, leave: 2.3, od: 1.0, wo: 4.0, holiday: 2.0, shortHrs: '14:40' },
  ];

  const totals = {
    key: 'total', summaryFor: 'Total', totalEmp: 1000, present: 22.5, absent: 1.3, leave: 2.2, od: 0.9, wo: 4.0, holiday: 2.0, shortHrs: '50:45'
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={4} className="m-0">Attendance Summary</Title>
          <Text type="secondary" className="text-xs">Summary report of attendance</Text>
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
          <Col span={6}>
            <Text className="text-xs">Department</Text>
            <Select defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select>
          </Col>
          <Col span={6} className="text-right">
            <Button type="primary" icon={<FilterOutlined />}>Apply Filter</Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={[...dataSource, totals]}
        size="small"
        bordered
        pagination={false}
        className="text-[12px]"
        rowClassName={record => record.key === 'total' ? 'bg-blue-50 font-bold' : ''}
      />
    </div>
  );
}

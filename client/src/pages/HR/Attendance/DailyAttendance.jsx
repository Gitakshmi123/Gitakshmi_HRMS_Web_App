import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Space, Tag } from 'antd';
import { FilterOutlined, DownOutlined, EditOutlined } from '@ant-design/icons';
import api from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

export default function DailyAttendance() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDailyAttendance();
  }, []);

  const fetchDailyAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/daily-attendance');
      if (res.data) {
        const fetchedData = res.data.data ? res.data.data : res.data;
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
          setData(fetchedData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch daily attendance', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (value, key) => {
    const newData = [...data];
    const index = newData.findIndex(item => key === item.key);
    if (index > -1) {
      newData[index].status = value;
      setData(newData);
    }
  };

  const columns = [
    { title: 'Sr. No.', dataIndex: 'srNo', width: 70 },
    { title: 'Emp. Code', dataIndex: 'empCode', width: 100 },
    { title: 'Employee Name', dataIndex: 'name', width: 150 },
    { title: 'Shift', dataIndex: 'shift', width: 90 },
    { title: 'Shift In', dataIndex: 'shiftIn', width: 90 },
    { title: 'Shift Out', dataIndex: 'shiftOut', width: 90 },
    { title: 'Actual In', dataIndex: 'actualIn', width: 90, render: text => <Text className="text-blue-600 font-medium">{text}</Text> },
    { title: 'Actual Out', dataIndex: 'actualOut', width: 90, render: text => <Text className="text-blue-600 font-medium">{text}</Text> },
    { title: 'Total Hrs', dataIndex: 'totalHrs', width: 90, render: text => <Text strong>{text}</Text> },
    { 
      title: 'OT Hrs', 
      dataIndex: 'otHrs', 
      width: 90,
      render: text => text !== '-' ? <Text className="text-purple-600 font-bold">{text}</Text> : text
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      width: 130,
      render: (status, record) => (
        <Select 
          value={status} 
          size="small" 
          onChange={(val) => handleStatusChange(val, record.key)}
          style={{ width: '100%' }}
          bordered={false}
          className={`
            ${status === 'Present' ? 'bg-green-50 text-green-700' : ''}
            ${status === 'Absent' ? 'bg-red-50 text-red-700' : ''}
            ${status === 'Leave' ? 'bg-orange-50 text-orange-700' : ''}
            ${status === 'Half Day' ? 'bg-yellow-50 text-yellow-700' : ''}
          `}
        >
          <Option value="Present">Present</Option>
          <Option value="Absent">Absent</Option>
          <Option value="Leave">Leave</Option>
          <Option value="Half Day">Half Day</Option>
        </Select>
      )
    },
    { title: 'Work Type', dataIndex: 'workType', width: 100 },
    { title: 'Remarks', dataIndex: 'remarks', width: 140, render: text => <Text type="secondary" className="text-xs">{text}</Text> },
    { 
      title: 'Correction', 
      key: 'action', 
      width: 100,
      render: () => <Button type="link" size="small" icon={<EditOutlined />}>Correct</Button> 
    },
  ];

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={4} className="m-0">Daily Attendance</Title>
          <Text type="secondary" className="text-xs">View daily attendance of employees and manage corrections</Text>
        </div>
      </div>

      {/* Header Summary */}
      <div className="flex space-x-6 mb-6">
        <div>
          <Text type="secondary" className="text-xs">Total Employees: </Text>
          <Text strong>1250</Text>
        </div>
        <div>
          <Text type="secondary" className="text-xs">Present: </Text>
          <Text className="text-green-600 font-bold">1065</Text>
        </div>
        <div>
          <Text type="secondary" className="text-xs">Absent: </Text>
          <Text className="text-red-500 font-bold">85</Text>
        </div>
        <div>
          <Text type="secondary" className="text-xs">Late: </Text>
          <Text className="text-orange-500 font-bold">42</Text>
        </div>
        <div>
          <Text type="secondary" className="text-xs">Early Leave: </Text>
          <Text className="text-orange-500 font-bold">35</Text>
        </div>
        <div>
          <Text type="secondary" className="text-xs">Missing Punch: </Text>
          <Text className="text-pink-500 font-bold">18</Text>
        </div>
      </div>

      <Card size="small" className="mb-4 bg-gray-50 border border-gray-200 shadow-sm">
        <Row gutter={[12, 12]} align="bottom">
          <Col span={6}>
            <Text className="text-xs">Date</Text>
            <DatePicker size="small" className="w-full" />
          </Col>
          <Col span={4}>
            <Text className="text-xs">Department</Text>
            <Select defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select>
          </Col>
          <Col span={4}>
            <Text className="text-xs">Shift Name</Text>
            <Select defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select>
          </Col>
          <Col span={4}>
            <Text className="text-xs">Status</Text>
            <Select defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select>
          </Col>
          <Col span={6} className="text-right">
            <Button type="primary" icon={<FilterOutlined />}>Apply Filter</Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        size="small"
        bordered
        pagination={{ pageSize: 15 }}
        className="text-[12px]"
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { Card, Row, Col, Typography, Table, Badge, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  FileTextOutlined,
  CalendarOutlined,
  BarChartOutlined,
  FormOutlined,
  CheckSquareOutlined,
  LockOutlined,
  ScheduleOutlined,
  PieChartOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

export default function AttendanceDashboard() {
  const navigate = useNavigate();

  const [kpis, setKpis] = useState([
    { label: 'Total Employees', value: 0, color: 'text-blue-600' },
    { label: 'Present Today', value: 0, color: 'text-green-500' },
    { label: 'Absent Today', value: 0, color: 'text-red-500' },
    { label: 'On Leave', value: 0, color: 'text-orange-500' },
    { label: 'Weekly Off', value: 0, color: 'text-gray-500' },
    { label: 'Holiday', value: 0, color: 'text-blue-400' },
    { label: 'Missing Punch', value: 0, color: 'text-pink-500' },
  ]);

  const [dailyAttendance, setDailyAttendance] = useState([]);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const res = await api.get('/attendance/dashboard-kpi');
        if (res.data.success) {
          const data = res.data.data;
          setKpis([
            { label: 'Total Employees', value: data.totalEmployees || 0, color: 'text-blue-600' },
            { label: 'Present Today', value: data.presentToday || 0, color: 'text-green-500' },
            { label: 'Absent Today', value: data.absentToday || 0, color: 'text-red-500' },
            { label: 'On Leave', value: data.onLeave || 0, color: 'text-orange-500' },
            { label: 'Weekly Off', value: data.weeklyOff || 0, color: 'text-gray-500' },
            { label: 'Holiday', value: data.holiday || 0, color: 'text-blue-400' },
            { label: 'Missing Punch', value: data.missingPunch || 0, color: 'text-pink-500' },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch KPIs', err);
      }
    };
    const fetchDailyPreview = async () => {
      try {
        const res = await api.get('/attendance/daily-attendance');
        if (res.data.success) {
          setDailyAttendance(res.data.data.slice(0, 5)); // Just preview top 5
        }
      } catch (err) {
        console.error('Failed to fetch daily preview', err);
      }
    };
    fetchKPIs();
    fetchDailyPreview();
  }, []);

  // Quick Links Data
  const quickLinks = [
    { title: 'Attendance Sheet', desc: 'View & manage monthly attendance', icon: <FileTextOutlined className="text-2xl text-blue-500" />, path: '/hr/attendance-sheet' },
    { title: 'Muster Roll', desc: 'View complete monthly grid', icon: <FileTextOutlined className="text-2xl text-blue-500" />, path: '/hr/muster-roll' },
    { title: 'Daily Attendance', desc: 'View daily attendance of employees', icon: <CalendarOutlined className="text-2xl text-green-500" />, path: '/hr/daily-attendance' },
    { title: 'Attendance Summary', desc: 'Summary report of attendance', icon: <BarChartOutlined className="text-2xl text-purple-500" />, path: '/hr/attendance-summary' },
    { title: 'Regularization Request', desc: 'Employee requests for correction', icon: <FormOutlined className="text-2xl text-orange-500" />, path: '/hr/regularization-request' },
    { title: 'Attendance Approval', desc: 'Approve regularization requests', icon: <CheckSquareOutlined className="text-2xl text-teal-500" />, path: '/hr/attendance-approval' },
    { title: 'Attendance Lock', desc: 'Lock attendance for payroll', icon: <LockOutlined className="text-2xl text-red-500" />, path: '/hr/attendance-lock' },
    { title: 'Holiday Calendar', desc: 'Manage holiday calendar', icon: <CalendarOutlined className="text-2xl text-indigo-500" />, path: '/hr/holiday-calendar' },
    { title: 'Shift & Roster', desc: 'Manage shifts and rosters', icon: <ScheduleOutlined className="text-2xl text-cyan-500" />, path: '/hr/shift-roster' },
    { title: 'Reports', desc: 'Various attendance reports', icon: <PieChartOutlined className="text-2xl text-blue-400" />, path: '/hr/attendance-reports' },
  ];

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="mb-4">
        <Title level={4} className="mb-0">Attendance</Title>
        <Text type="secondary">Complete attendance details of employees</Text>
      </div>

      {/* KPI Section */}
      <Row gutter={[16, 16]} className="mb-6">
        {kpis.map((kpi, idx) => (
          <Col span={idx === 0 || idx === 1 || idx === 6 ? 4 : 3} key={idx}>
            <Card className="text-center shadow-sm h-full">
              <Text type="secondary" className="block mb-2 text-xs">{kpi.label}</Text>
              <Title level={3} className={`${kpi.color} m-0`}>{kpi.value}</Title>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Quick Links Grid */}
      <Row gutter={[16, 16]} className="mb-6">
        {quickLinks.map((link, idx) => (
          <Col span={6} key={idx}>
            <Card 
              hoverable 
              className="shadow-sm cursor-pointer border-l-4 border-l-blue-500 h-full"
              onClick={() => navigate(link.path)}
              bodyStyle={{ padding: '16px' }}
            >
              <div className="flex items-center">
                <div className="mr-4 bg-gray-100 p-3 rounded-md">
                  {link.icon}
                </div>
                <div>
                  <Title level={5} className="m-0 mb-1 text-sm">{link.title}</Title>
                  <Text type="secondary" className="text-xs">{link.desc}</Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Preview Tables Section */}
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="Daily Attendance" extra={<Button type="link" onClick={() => navigate('/hr/daily-attendance')}>View All</Button>} className="shadow-sm">
            <Table 
              size="small"
              pagination={false}
              dataSource={dailyAttendance}
              columns={[
                { title: 'Emp. Code', dataIndex: 'empCode' },
                { title: 'Employee Name', dataIndex: 'name' },
                { title: 'Shift', dataIndex: 'shift' },
                { title: 'In Time', dataIndex: 'in' },
                { title: 'Out Time', dataIndex: 'out' },
                { title: 'Status', dataIndex: 'status', render: text => <Text type="success">{text}</Text> },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Regularization Request" extra={<Button type="link" onClick={() => navigate('/hr/regularization-request')}>View All</Button>} className="shadow-sm">
            <Table 
              size="small"
              pagination={false}
              dataSource={[
                { key: 1, reqId: 'RQ2026001', name: 'Rahul Kumar', type: 'In Time Correction', status: 'Pending' },
                { key: 2, reqId: 'RQ2026002', name: 'Priya Sharma', type: 'Out Time Correction', status: 'Pending' },
                { key: 3, reqId: 'RQ2026003', name: 'Amit Patel', type: 'Full Day Present', status: 'Pending' },
              ]}
              columns={[
                { title: 'Req. ID', dataIndex: 'reqId' },
                { title: 'Employee Name', dataIndex: 'name' },
                { title: 'Request Type', dataIndex: 'type' },
                { title: 'Status', dataIndex: 'status', render: text => <Badge status="warning" text={text} /> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

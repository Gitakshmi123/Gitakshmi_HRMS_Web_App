import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Statistic } from 'antd';
import { FilterOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AttendanceReports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    department: 'All',
    dateRange: [dayjs().startOf('month'), dayjs().endOf('month')]
  });

  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    avgPresent: 0,
    avgAbsent: 0,
    avgLeave: 0
  });

  useEffect(() => {
    fetchDepartments();
    fetchReportData();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/hierarchy/departments');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setDepartments(res.data.data);
      }
    } catch (err) {}
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/muster-roll', {
        params: {
          startDate: filters.dateRange[0].format('YYYY-MM-DD'),
          endDate: filters.dateRange[1].format('YYYY-MM-DD')
        }
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        let rawData = res.data.data;
        if (filters.department !== 'All') {
          rawData = rawData.filter(emp => emp.department === filters.department || emp.department?._id === filters.department);
        }

        const reportData = rawData.map((emp, index) => {
          let presentCount = 0;
          let absentCount = 0;
          let leaveCount = 0;
          
          for (let i = 1; i <= 31; i++) {
            const val = emp[`day${i}`];
            if (val) {
              if (['P', 'WFH', 'OD', 'BT'].includes(val)) presentCount++;
              else if (['HD', 'AHD', 'LWPHD', 'ELHD', 'CLHD', 'SLHD'].includes(val)) presentCount += 0.5;
              
              if (['A', 'LWP'].includes(val)) absentCount++;
              else if (['AHD', 'LWPHD'].includes(val)) absentCount += 0.5;
              
              if (['EL', 'CL', 'SL', 'PL', 'ML', 'MARL', 'STL', 'L', 'CO'].includes(val)) leaveCount++;
              else if (['ELHD', 'CLHD', 'SLHD'].includes(val)) leaveCount += 0.5;
            }
          }

          return {
            key: emp._id || index,
            srNo: index + 1,
            empCode: emp.empCode || '-',
            name: emp.firstName ? `${emp.firstName} ${emp.lastName}` : (emp.name || '-'),
            department: emp.department?.name || emp.department || 'N/A',
            present: presentCount,
            absent: absentCount,
            leave: leaveCount,
            totalWorking: presentCount + absentCount + leaveCount
          };
        });

        setData(reportData);

        if (reportData.length > 0) {
          const totalPresent = reportData.reduce((acc, curr) => acc + curr.present, 0);
          const totalAbsent = reportData.reduce((acc, curr) => acc + curr.absent, 0);
          const totalLeave = reportData.reduce((acc, curr) => acc + curr.leave, 0);
          
          setMetrics({
            totalEmployees: reportData.length,
            avgPresent: (totalPresent / reportData.length).toFixed(1),
            avgAbsent: (totalAbsent / reportData.length).toFixed(1),
            avgLeave: (totalLeave / reportData.length).toFixed(1)
          });
        } else {
          setMetrics({ totalEmployees: 0, avgPresent: 0, avgAbsent: 0, avgLeave: 0 });
        }
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(error);
      showToast('error', 'Error', 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (data.length === 0) {
      showToast('info', 'Export', 'No data available to export');
      return;
    }
    
    // Simulate CSV Export
    const headers = ['Sr. No.', 'Emp. Code', 'Employee Name', 'Department', 'Present Days', 'Absent Days', 'Leave Days', 'Total Working Days'];
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
      csvRows.push(`${row.srNo},${row.empCode},${row.name},${row.department},${row.present},${row.absent},${row.leave},${row.totalWorking}`);
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Report_${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('success', 'Export Successful', 'Report downloaded as CSV.');
  };

  const columns = [
    { title: 'Sr. No.', dataIndex: 'srNo', width: 70 },
    { title: 'Emp. Code', dataIndex: 'empCode', width: 100 },
    { title: 'Employee Name', dataIndex: 'name', width: 200 },
    { title: 'Department', dataIndex: 'department', width: 150 },
    { title: 'Present Days', dataIndex: 'present', width: 120, align: 'center', render: val => <Text type="success">{val}</Text> },
    { title: 'Absent Days', dataIndex: 'absent', width: 120, align: 'center', render: val => <Text type="danger">{val}</Text> },
    { title: 'Leave Days', dataIndex: 'leave', width: 120, align: 'center', render: val => <Text type="warning">{val}</Text> },
    { title: 'Total Evaluated', dataIndex: 'totalWorking', width: 120, align: 'center' }
  ];

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={4} className="m-0">Attendance Reports</Title>
          <Text type="secondary" className="text-xs">Comprehensive attendance insights and data export</Text>
        </div>
        <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExport} className="bg-green-600 hover:bg-green-700">
          Export CSV
        </Button>
      </div>

      <Card size="small" className="mb-4 bg-gray-50 border border-gray-200 shadow-sm">
        <Row gutter={[12, 12]} align="bottom">
          <Col span={8}>
            <Text className="text-xs block mb-1">Date Range</Text>
            <RangePicker 
              value={filters.dateRange} 
              onChange={val => setFilters({...filters, dateRange: val})} 
              size="small" 
              className="w-full" 
            />
          </Col>
          <Col span={6}>
            <Text className="text-xs block mb-1">Department</Text>
            <Select 
              value={filters.department} 
              onChange={val => setFilters({...filters, department: val})} 
              size="small" 
              className="w-full"
            >
              <Option value="All">All Departments</Option>
              {departments.map(d => <Option key={d._id} value={d._id}>{d.name}</Option>)}
            </Select>
          </Col>
          <Col span={10} className="text-right">
            <Button type="primary" icon={<FilterOutlined />} onClick={fetchReportData} loading={loading}>
              Generate Report
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} className="mb-4">
        <Col span={6}>
          <Card size="small" bordered={false} className="bg-blue-50 text-center">
            <Statistic title="Total Employees" value={metrics.totalEmployees} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bordered={false} className="bg-green-50 text-center">
            <Statistic title="Avg Present Days" value={metrics.avgPresent} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bordered={false} className="bg-red-50 text-center">
            <Statistic title="Avg Absent Days" value={metrics.avgAbsent} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" bordered={false} className="bg-yellow-50 text-center">
            <Statistic title="Avg Leave Days" value={metrics.avgLeave} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      <Table
        loading={loading}
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

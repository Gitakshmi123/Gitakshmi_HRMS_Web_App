import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Space, Spin } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import api from '../../../utils/api';
import dayjs from 'dayjs';

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

  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({});
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: null,
    toDate: null,
    department: 'All'
  });

  useEffect(() => {
    fetchSummary();
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      const deptRes = await api.get('/hierarchy/departments').catch(() => null);
      if (deptRes?.data?.success) setDepartments(deptRes.data.data);
    } catch (err) {}
  };

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/muster-roll');
      if (res.data && Array.isArray(res.data.data)) {
        processSummary(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const processSummary = (rawData) => {
    let filtered = rawData;
    if (filters.department !== 'All') {
      filtered = rawData.filter(item => item.department === filters.department || item.departmentId?._id === filters.department);
    }

    const deptMap = {};
    filtered.forEach(row => {
      const deptName = row.department || row.departmentId?.departmentName || 'Unassigned';
      if (!deptMap[deptName]) {
        deptMap[deptName] = { summaryFor: deptName, totalEmp: 0, present: 0, absent: 0, leave: 0, od: 0, wo: 0, holiday: 0, shortHrs: '00:00' };
      }
      
      let pCount = 0, aCount = 0, lCount = 0, odCount = 0, wCount = 0, hCount = 0;
      for (let i = 1; i <= 31; i++) {
        const val = row[`day${i}`];
        if (['P', 'WFH', 'BT', 'HD', 'CO'].includes(val)) pCount++;
        if (['A', 'LWP', 'AHD'].includes(val)) aCount++;
        if (['CL', 'SL', 'EL', 'PL', 'ML', 'MARL', 'STL'].includes(val)) lCount++;
        if (val === 'OD') odCount++;
        if (val === 'WO') wCount++;
        if (['H', 'OH'].includes(val)) hCount++;
      }
      
      deptMap[deptName].totalEmp += 1;
      deptMap[deptName].present += pCount;
      deptMap[deptName].absent += aCount;
      deptMap[deptName].leave += lCount;
      deptMap[deptName].od += odCount;
      deptMap[deptName].wo += wCount;
      deptMap[deptName].holiday += hCount;
    });

    const summaryData = Object.keys(deptMap).map((k, idx) => ({ key: idx.toString(), ...deptMap[k] }));
    
    const agg = {
      key: 'total', summaryFor: 'Total', totalEmp: 0, present: 0, absent: 0, leave: 0, od: 0, wo: 0, holiday: 0, shortHrs: '00:00'
    };
    summaryData.forEach(d => {
      agg.totalEmp += d.totalEmp; agg.present += d.present; agg.absent += d.absent; 
      agg.leave += d.leave; agg.od += d.od; agg.wo += d.wo; agg.holiday += d.holiday;
    });
    
    setData(summaryData);
    setTotals(agg);
  };

  const handleApplyFilter = () => {
    fetchSummary();
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
            <DatePicker value={filters.fromDate} onChange={d => setFilters({...filters, fromDate: d})} size="small" className="w-full" />
          </Col>
          <Col span={6}>
            <Text className="text-xs">To Date</Text>
            <DatePicker value={filters.toDate} onChange={d => setFilters({...filters, toDate: d})} size="small" className="w-full" />
          </Col>
          <Col span={6}>
            <Text className="text-xs">Department</Text>
            <Select value={filters.department} onChange={v => setFilters({...filters, department: v})} size="small" className="w-full">
              <Option value="All">All</Option>
              {departments.map(d => <Option key={d._id} value={d.name || d.departmentName}>{d.name || d.departmentName}</Option>)}
            </Select>
          </Col>
          <Col span={6} className="text-right">
            <Button type="primary" icon={<FilterOutlined />} onClick={handleApplyFilter} loading={loading}>Apply Filter</Button>
          </Col>
        </Row>
      </Card>

      <Table
        loading={loading}
        columns={columns}
        dataSource={data.length > 0 ? [...data, totals] : []}
        size="small"
        bordered
        pagination={false}
        className="text-[12px]"
        rowClassName={record => record.key === 'total' ? 'bg-blue-50 font-bold' : ''}
      />
    </div>
  );
}

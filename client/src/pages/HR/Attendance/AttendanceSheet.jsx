import React, { useState } from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Space, Divider, Input, AutoComplete } from 'antd';
import { DownloadOutlined, UploadOutlined, FilterOutlined, DownOutlined } from '@ant-design/icons';
import api from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AttendanceSheet() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generate 31 columns for days
  const dayColumns = [];
  for (let i = 1; i <= 31; i++) {
    // Generate dummy date headers (e.g. Mon, Tue)
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(i + 4) % 7];
    dayColumns.push({
      title: (
        <div className="text-center text-xs">
          <div>{i}</div>
          <div className="font-normal text-[10px] text-gray-500">{dayOfWeek}</div>
        </div>
      ),
      dataIndex: `day${i}`,
      width: 75,
      align: 'center',
      render: (text, record) => {
        let colorClass = 'text-gray-500';
        let bgClass = '';
        if (text === 'P') { colorClass = 'text-green-600 font-bold'; }
        if (text === 'A') { colorClass = 'text-red-500 font-bold'; }
        if (text === 'L') { colorClass = 'text-orange-500 font-bold'; bgClass = 'bg-orange-50'; }
        if (text === 'OD') { colorClass = 'text-blue-600 font-bold'; }
        if (text === 'WO') { colorClass = 'text-gray-400 font-bold'; }
        if (text === 'H') { colorClass = 'text-cyan-500 font-bold'; bgClass = 'bg-cyan-50'; }
        
        return (
          <div className={`text-xs ${colorClass} ${bgClass} py-1 cursor-pointer hover:bg-gray-100`}>
            <Select 
              showSearch
              filterOption={(input, option) => option.value.toLowerCase().includes(input.toLowerCase())}
              value={text || '-'} 
              size="small" 
              bordered={false} 
              className="w-full text-center"
              dropdownMatchSelectWidth={false}
              onChange={(val) => handleCellChange(val, record.key, `day${i}`)}
            >
              {/* Full Days & Duty */}
              <Option value="P"><span className="text-green-600 font-bold">P</span></Option>
              <Option value="WFH"><span className="text-green-500 font-bold">WFH</span></Option>
              <Option value="OD"><span className="text-blue-600 font-bold">OD</span></Option>
              <Option value="BT"><span className="text-blue-500 font-bold">BT</span></Option>
              
              {/* Half Days */}
              <Option value="HD"><span className="text-green-400 font-bold">HD</span></Option>
              <Option value="AHD"><span className="text-orange-500 font-bold">AHD</span></Option>
              <Option value="LWPHD"><span className="text-orange-400 font-bold">LWPHD</span></Option>
              <Option value="ELHD"><span className="text-orange-400 font-bold">ELHD</span></Option>
              <Option value="SLHD"><span className="text-orange-400 font-bold">SLHD</span></Option>
              <Option value="CLHD"><span className="text-orange-400 font-bold">CLHD</span></Option>

              {/* Leaves & Absents */}
              <Option value="A"><span className="text-red-500 font-bold">A</span></Option>
              <Option value="LWP"><span className="text-red-400 font-bold">LWP</span></Option>
              <Option value="CO"><span className="text-purple-500 font-bold">CO</span></Option>
              <Option value="EL"><span className="text-orange-500 font-bold">EL</span></Option>
              <Option value="SL"><span className="text-orange-500 font-bold">SL</span></Option>
              <Option value="CL"><span className="text-orange-500 font-bold">CL</span></Option>
              <Option value="PL"><span className="text-orange-500 font-bold">PL</span></Option>
              <Option value="ML"><span className="text-orange-500 font-bold">ML</span></Option>
              <Option value="MARL"><span className="text-orange-500 font-bold">MARL</span></Option>
              <Option value="STL"><span className="text-orange-500 font-bold">STL</span></Option>
              <Option value="OH"><span className="text-cyan-600 font-bold">OH</span></Option>

              <Option value="WO"><span className="text-gray-400 font-bold">WO</span></Option>
              <Option value="H"><span className="text-cyan-500 font-bold">H</span></Option>
              <Option value="-">-</Option>
            </Select>
            {(['P', 'WFH', 'OD', 'BT', 'HD', 'AHD', 'LWPHD', 'ELHD', 'SLHD', 'CLHD'].includes(text)) && (
              <div className="flex flex-col items-center mt-1 space-y-1">
                <input 
                  type="time" 
                  value={record[`in${i}`] || '--:--'} 
                  onChange={(e) => handleTimeChange(e.target.value, record.key, `in${i}`)}
                  className="w-[50px] text-[8px] border border-gray-300 rounded px-0.5 text-center bg-white text-gray-700 focus:outline-none"
                />
                <input 
                  type="time" 
                  value={record[`out${i}`] || '--:--'} 
                  onChange={(e) => handleTimeChange(e.target.value, record.key, `out${i}`)}
                  className="w-[50px] text-[8px] border border-gray-300 rounded px-0.5 text-center bg-white text-gray-700 focus:outline-none"
                />
              </div>
            )}
          </div>
        );
      }
    });
  }

  const columns = [
    { title: 'Sr.', dataIndex: 'srNo', width: 50, fixed: 'left' },
    { title: 'Emp. Code', dataIndex: 'empCode', width: 80, fixed: 'left' },
    { title: 'Employee Name', dataIndex: 'name', width: 140, fixed: 'left' },
    { title: 'Designation', dataIndex: 'designation', width: 120 },
    { title: 'Department', dataIndex: 'department', width: 100 },
    { title: 'Branch', dataIndex: 'branch', width: 80 },
    { title: 'Shift', dataIndex: 'shift', width: 70 },
    { title: 'Roster', dataIndex: 'roster', width: 100 },
    
    ...dayColumns,

    // Aggregate columns based on user request (Grouped)
    {
      title: 'Presents & Duty',
      children: [
        { title: 'P', dataIndex: 'p', width: 45 },
        { title: 'WFH', dataIndex: 'wfh', width: 50 },
        { title: 'BT', dataIndex: 'bt', width: 45 },
        { title: 'OD', dataIndex: 'od', width: 45 },
        { title: 'HD', dataIndex: 'hdDays', width: 45 },
        { title: 'CO', dataIndex: 'co', width: 45 },
        { title: 'Total', dataIndex: 'totalPresentDays', width: 60, className: 'bg-green-50' }
      ]
    },
    {
      title: 'Paid Leaves',
      children: [
        { title: 'CL', dataIndex: 'cl', width: 45 },
        { title: 'SL', dataIndex: 'sl', width: 45 },
        { title: 'EL', dataIndex: 'el', width: 45 },
        { title: 'PL', dataIndex: 'pl', width: 45 },
        { title: 'ML', dataIndex: 'ml', width: 45 },
        { title: 'MARL', dataIndex: 'marl', width: 50 },
        { title: 'Total', dataIndex: 'totalLeaves', width: 60, className: 'bg-orange-50' }
      ]
    },
    {
      title: 'Offs & Holidays',
      children: [
        { title: 'WO', dataIndex: 'wo', width: 45 },
        { title: 'H', dataIndex: 'h', width: 45 },
        { title: 'OH', dataIndex: 'oh', width: 45 }
      ]
    },
    {
      title: 'Absents & Unpaid',
      children: [
        { title: 'A', dataIndex: 'absentDays', width: 45 },
        { title: 'AHD', dataIndex: 'hdAbs', width: 50 },
        { title: 'LWP', dataIndex: 'lwp', width: 50 },
        { title: 'STL', dataIndex: 'stl', width: 45 }
      ]
    },
    { title: 'Total Paid Days', dataIndex: 'totalPaidDays', width: 80, fixed: 'right', className: 'font-bold bg-blue-50' }
  ];

  const [dataSource, setDataSource] = useState([]);
  const [filteredDataSource, setFilteredDataSource] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const metrics = React.useMemo(() => {
    const dataToUse = filteredDataSource.length > 0 ? filteredDataSource : dataSource;
    if (!dataToUse || dataToUse.length === 0) {
      return { totalEmployees: 0, avgPresent: '0.0', avgLeave: '0.0', avgWO: '0.0', leaveSummary: [
        { key: 1, type: 'CL (Casual Leave)', ob: 0, availed: 0, balance: 0 },
        { key: 2, type: 'SL (Sick Leave)', ob: 0, availed: 0, balance: 0 },
        { key: 3, type: 'PL (Privilege Leave)', ob: 0, availed: 0, balance: 0 },
      ]};
    }
    const totalEmp = dataToUse.length;
    const totalPresent = dataToUse.reduce((sum, r) => sum + (r.totalPresentDays || 0), 0);
    const totalLeave = dataToUse.reduce((sum, r) => sum + (r.totalLeaves || 0), 0);
    const totalWO = dataToUse.reduce((sum, r) => sum + ((r.wo || 0) + (r.h || 0) + (r.oh || 0)), 0);

    const clAvailed = dataToUse.reduce((sum, r) => sum + (r.cl || 0), 0);
    const slAvailed = dataToUse.reduce((sum, r) => sum + (r.sl || 0), 0);
    const plAvailed = dataToUse.reduce((sum, r) => sum + (r.pl || 0), 0);

    return {
      totalEmployees: totalEmp,
      avgPresent: (totalPresent / totalEmp).toFixed(1),
      avgLeave: (totalLeave / totalEmp).toFixed(1),
      avgWO: (totalWO / totalEmp).toFixed(1),
      leaveSummary: [
        { key: 1, type: 'CL (Casual Leave)', ob: totalEmp * 12, availed: clAvailed, balance: (totalEmp * 12) - clAvailed },
        { key: 2, type: 'SL (Sick Leave)', ob: totalEmp * 10, availed: slAvailed, balance: (totalEmp * 10) - slAvailed },
        { key: 3, type: 'PL (Privilege Leave)', ob: totalEmp * 15, availed: plAvailed, balance: (totalEmp * 15) - plAvailed },
      ]
    };
  }, [dataSource, filteredDataSource]);

  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [shifts, setShifts] = useState([]);
  
  const [filters, setFilters] = useState({
    company: 'All',
    branch: 'All',
    department: 'All',
    designation: 'All',
    employeeType: 'All',
    shift: 'All'
  });

  React.useEffect(() => {
    fetchMusterRoll();
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      const [deptRes, branchRes, desigRes, shiftRes] = await Promise.all([
        api.get('/hierarchy/departments').catch(() => null),
        api.get('/hierarchy/branches').catch(() => null),
        api.get('/hierarchy/designations').catch(() => null),
        api.get('/shift-master').catch(() => null)
      ]);
      if (deptRes?.data?.success) setDepartments(deptRes.data.data);
      if (branchRes?.data?.success) setBranches(branchRes.data.data);
      if (desigRes?.data?.success) setDesignations(desigRes.data.data);
      if (shiftRes?.data?.success) setShifts(shiftRes.data.data);
    } catch (err) {
      console.error('Failed to fetch masters', err);
    }
  };

  const fetchMusterRoll = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/muster-roll');
      if(res.data && res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        const processedData = res.data.data.map(row => recalculateRow(row));
        setDataSource(processedData);
        setFilteredDataSource(processedData);
      }
    } catch (err) {
      console.error('Failed to fetch attendance sheet', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    let filtered = [...dataSource];
    
    if (filters.department !== 'All') {
      filtered = filtered.filter(item => item.departmentId?._id === filters.department || item.department === filters.department);
    }
    if (filters.branch !== 'All') {
      filtered = filtered.filter(item => item.branchId?._id === filters.branch || item.branch === filters.branch);
    }
    if (filters.designation !== 'All') {
      filtered = filtered.filter(item => item.designationId?._id === filters.designation || item.designation === filters.designation);
    }
    if (filters.shift !== 'All') {
      filtered = filtered.filter(item => item.shiftId?._id === filters.shift || item.shift === filters.shift);
    }

    setFilteredDataSource(filtered);
  };

  const recalculateRow = (row) => {
    let pCount = 0, wfhCount = 0, btCount = 0, odCount = 0, hdCount = 0, coCount = 0;
    let clCount = 0, slCount = 0, elCount = 0, plCount = 0, mlCount = 0, marlCount = 0, stlCount = 0;
    let woCount = 0, hCount = 0, ohCount = 0;
    let aCount = 0, ahdCount = 0, lwpCount = 0;

    for (let i = 1; i <= 31; i++) {
      const val = row[`day${i}`];
      
      // Full Presents & Duty
      if (val === 'P') pCount++;
      if (val === 'WFH') wfhCount++;
      if (val === 'BT') btCount++;
      if (val === 'OD') odCount++;
      if (val === 'CO') coCount++; 
      
      // Half Day logic
      if (val === 'HD') {
        hdCount += 0.5;
      }
      if (val === 'AHD') {
        ahdCount += 0.5;
        hdCount += 0.5;
      }
      if (val === 'LWPHD') {
        lwpCount += 0.5;
        hdCount += 0.5;
      }
      if (val === 'ELHD') {
        elCount += 0.5;
        hdCount += 0.5;
      }
      if (val === 'CLHD') {
        clCount += 0.5;
        hdCount += 0.5;
      }
      if (val === 'SLHD') {
        slCount += 0.5;
        hdCount += 0.5;
      }

      // Full Absents & Unpaid
      if (val === 'A') aCount++;
      if (val === 'LWP') lwpCount++;

      // Offs & Holidays
      if (val === 'WO') {
        const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(i + 4) % 7];
        if (dayOfWeek === 'Sat') woCount += 0.5;
        else woCount++;
      }
      if (val === 'H') hCount++;
      if (val === 'OH') ohCount++;
      
      // Full Paid Leaves
      if (val === 'EL') elCount++;
      if (val === 'CL') clCount++;
      if (val === 'SL') slCount++;
      if (val === 'PL') plCount++;
      if (val === 'ML') mlCount++;
      if (val === 'MARL') marlCount++;
      if (val === 'STL') stlCount++;
    }
    
    const totalPresentDays = pCount + wfhCount + btCount + odCount + hdCount + coCount;
    const totalLeaves = clCount + slCount + elCount + plCount + mlCount + marlCount;
    const totalPaidDays = totalPresentDays + totalLeaves + woCount + hCount + ohCount;

    row.p = pCount;
    row.wfh = wfhCount;
    row.bt = btCount;
    row.od = odCount;
    row.hdDays = hdCount;
    row.co = coCount;
    row.totalPresentDays = totalPresentDays;
    
    row.cl = clCount;
    row.sl = slCount;
    row.el = elCount;
    row.pl = plCount;
    row.ml = mlCount;
    row.marl = marlCount;
    row.stl = stlCount;
    row.totalLeaves = totalLeaves;
    
    row.wo = woCount;
    row.h = hCount;
    row.oh = ohCount;
    
    row.absentDays = aCount;
    row.hdAbs = ahdCount;
    row.lwp = lwpCount;
    
    row.totalPaidDays = totalPaidDays;

    return row;
  };

  const handleTimeChange = (value, rowKey, timeKey) => {
    const newData = [...dataSource];
    const index = newData.findIndex(item => rowKey === item.key);
    if (index > -1) {
      newData[index][timeKey] = value;
      newData[index] = recalculateRow(newData[index]);
      setDataSource(newData);
      autoSave(newData);
    }
  };

  const autoSave = async (dataToSave) => {
    try {
      await api.post('/attendance/muster-roll/save', { updates: dataToSave });
    } catch (err) {
      console.error('Failed to auto-save attendance', err);
    }
  };

  const handleCellChange = (value, rowKey, dayKey) => {
    const newData = [...dataSource];
    const index = newData.findIndex(item => rowKey === item.key);
    if (index > -1) {
      newData[index][dayKey] = value;
      
      const presents = ['P', 'WFH', 'OD', 'BT'];
      const halfDays = ['HD', 'AHD', 'LWPHD', 'ELHD', 'SLHD', 'CLHD'];

      // Default time for Present/Half Day variants
      if (presents.includes(value) || halfDays.includes(value)) {
        const dayNum = dayKey.replace('day', '');
        if (!newData[index][`in${dayNum}`] || newData[index][`in${dayNum}`] === '--:--') {
          newData[index][`in${dayNum}`] = '09:00';
        }
        if (!newData[index][`out${dayNum}`] || newData[index][`out${dayNum}`] === '--:--') {
          newData[index][`out${dayNum}`] = halfDays.includes(value) ? '13:30' : '18:00';
        }
      } else {
        // Clear time if not P or HD
        const dayNum = dayKey.replace('day', '');
        newData[index][`in${dayNum}`] = '--:--';
        newData[index][`out${dayNum}`] = '--:--';
      }
      
      newData[index] = recalculateRow(newData[index]);
      setDataSource(newData);
      autoSave(newData);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await api.post('/attendance/muster-roll/save', { updates: dataSource });
      if (res.data && res.data.success) {
        await fetchMusterRoll();
      }
    } catch (err) {
      console.error('Failed to save attendance sheet', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(dataSource);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Sheet");
      XLSX.writeFile(wb, "AttendanceSheet_Export.xlsx");
    });
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    import('xlsx').then(XLSX => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const newData = [...dataSource];
        data.forEach(row => {
          const index = newData.findIndex(item => item.empCode === row.empCode);
          if (index > -1) {
            for (let i = 1; i <= 31; i++) {
              if (row[`day${i}`]) newData[index][`day${i}`] = row[`day${i}`];
              if (row[`in${i}`]) newData[index][`in${i}`] = row[`in${i}`];
              if (row[`out${i}`]) newData[index][`out${i}`] = row[`out${i}`];
            }
            newData[index] = recalculateRow(newData[index]);
          }
        });
        setDataSource(newData);
      };
      reader.readAsBinaryString(file);
    });
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={4} className="m-0">Attendance Sheet</Title>
          <Text type="secondary" className="text-xs">Complete attendance details of employees</Text>
        </div>
        <Space>
          <label>
            <input type="file" accept=".xlsx, .xls" style={{display: 'none'}} onChange={handleImport} />
            <Button icon={<UploadOutlined />} className="text-green-600 border-green-600" onClick={(e) => e.target.previousElementSibling.click()}>Import Attendance</Button>
          </label>
          <Button type="primary" icon={<FilterOutlined />} onClick={handleApplyFilter}>Apply Filter</Button>
          <Button onClick={handleSave} loading={loading} type="primary" className="bg-green-600">Save Changes</Button>
          <Button type="primary" icon={<DownloadOutlined />} className="bg-blue-600" onClick={handleExport}>Export</Button>
        </Space>
      </div>

      {/* Filters Section */}
      <Card size="small" className="mb-4 bg-gray-50 border border-gray-200 shadow-sm">
        <Text strong className="text-xs mb-2 block">Basic Filters</Text>
        <Row gutter={[12, 12]}>
          <Col span={4}>
            <Text className="text-xs">Company Name</Text>
            <Select 
              showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
              value={filters.company} onChange={(v) => setFilters({...filters, company: v})} size="small" className="w-full">
              <Option value="All">All</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Text className="text-xs">Branch</Text>
            <Select 
              showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
              value={filters.branch} onChange={(v) => setFilters({...filters, branch: v})} size="small" className="w-full">
              <Option value="All">All</Option>
              {branches.map(b => <Option key={b._id} value={b.name || b.branchName || b.city}>{b.name || b.branchName || b.city}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Text className="text-xs">Department</Text>
            <Select 
              showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
              value={filters.department} onChange={(v) => setFilters({...filters, department: v})} size="small" className="w-full">
              <Option value="All">All</Option>
              {departments.map(d => <Option key={d._id} value={d.name || d.departmentName}>{d.name || d.departmentName}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Text className="text-xs">Designation</Text>
            <Select 
              showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
              value={filters.designation} onChange={(v) => setFilters({...filters, designation: v})} size="small" className="w-full">
              <Option value="All">All</Option>
              {designations.map(d => <Option key={d._id} value={d.name || d.designationName || d.title}>{d.name || d.designationName || d.title}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Text className="text-xs">Employee Type</Text>
            <Select 
              showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
              value={filters.employeeType} onChange={(v) => setFilters({...filters, employeeType: v})} size="small" className="w-full">
              <Option value="All">All</Option>
              <Option value="Permanent">Permanent</Option>
              <Option value="Contract">Contract</Option>
            </Select>
          </Col>
        </Row>
        
        <Divider className="my-3" />
        
        <div className="flex justify-between items-center cursor-pointer text-blue-600 text-xs" onClick={() => setShowAdvanced(!showAdvanced)}>
          <Text className="text-blue-600">{showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'} <DownOutlined rotate={showAdvanced ? 180 : 0}/></Text>
        </div>

        {showAdvanced && (
          <Row gutter={[12, 12]} className="mt-3">
            <Col span={4}>
              <Text className="text-xs">Shift Name</Text>
              <Select value={filters.shift} onChange={(v) => setFilters({...filters, shift: v})} size="small" className="w-full">
                <Option value="All">All</Option>
                {shifts.map(s => <Option key={s._id} value={s.name || s.shiftName}>{s.name || s.shiftName}</Option>)}
              </Select>
            </Col>
            <Col span={4}><Text className="text-xs">Location</Text><Select defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
            <Col span={4}><Text className="text-xs">Cost Center</Text><Select defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
            <Col span={4}><Text className="text-xs">Employee Status</Text><Select defaultValue="Active" size="small" className="w-full"><Option value="Active">Active</Option></Select></Col>
            <Col span={8}><Text className="text-xs">Date Range</Text><RangePicker size="small" className="w-full" /></Col>
          </Row>
        )}
      </Card>

      {/* Main Data Grid */}
      <div className="border border-gray-200 rounded-md">
        <Table
          columns={columns}
          dataSource={filteredDataSource}
          scroll={{ x: 2500, y: 500 }}
          pagination={false}
          size="small"
          bordered
          className="attendance-grid text-[11px]"
          rowClassName="align-top"
        />
      </div>

      {/* Legend */}
      <div className="flex justify-end space-x-4 my-2 text-xs">
        <span className="flex items-center"><span className="w-3 h-3 bg-green-500 mr-1 rounded-sm"></span> Present</span>
        <span className="flex items-center"><span className="w-3 h-3 bg-red-500 mr-1 rounded-sm"></span> Absent</span>
        <span className="flex items-center"><span className="w-3 h-3 bg-orange-400 mr-1 rounded-sm"></span> Leave</span>
        <span className="flex items-center"><span className="w-3 h-3 bg-blue-600 mr-1 rounded-sm text-white text-[8px] flex justify-center items-center">OD</span> Official Duty</span>
        <span className="flex items-center"><span className="w-3 h-3 bg-gray-400 mr-1 rounded-sm text-white text-[8px] flex justify-center items-center">WO</span> Week Off</span>
        <span className="flex items-center"><span className="w-3 h-3 bg-cyan-500 mr-1 rounded-sm text-white text-[8px] flex justify-center items-center">H</span> Holiday</span>
        <span className="flex items-center"><span className="w-3 h-3 bg-cyan-600 mr-1 rounded-sm text-white text-[8px] flex justify-center items-center">OH</span> Optional Holiday</span>
      </div>

      {/* Summary Panels */}
      <Row gutter={16} className="mt-4">
        <Col span={10}>
          <Card size="small" title="Attendance Summary" className="shadow-sm h-full">
            <Row>
              <Col span={6} className="text-center">
                <Text type="secondary" className="text-xs block">Total Employees</Text>
                <Title level={3} className="m-0">{metrics.totalEmployees}</Title>
              </Col>
              <Col span={6} className="text-center">
                <Text type="secondary" className="text-xs block">Avg Present Days</Text>
                <Title level={3} className="text-green-500 m-0">{metrics.avgPresent}</Title>
                <Text type="secondary" className="text-[10px]">Per Employee</Text>
              </Col>
              <Col span={6} className="text-center">
                <Text type="secondary" className="text-xs block">Avg Leave Days</Text>
                <Title level={3} className="text-orange-500 m-0">{metrics.avgLeave}</Title>
                <Text type="secondary" className="text-[10px]">Per Employee</Text>
              </Col>
              <Col span={6} className="text-center">
                <Text type="secondary" className="text-xs block">Avg WO Days</Text>
                <Title level={3} className="text-gray-500 m-0">{metrics.avgWO}</Title>
                <Text type="secondary" className="text-[10px]">Per Employee</Text>
              </Col>
            </Row>
          </Card>
        </Col>
        
        <Col span={8}>
          <Card size="small" title="Leave Summary" className="shadow-sm h-full">
            <Table 
              size="small"
              pagination={false}
              dataSource={metrics.leaveSummary}
              columns={[
                { title: 'Leave Type', dataIndex: 'type', width: 120 },
                { title: 'Opening Balance', dataIndex: 'ob', align: 'center' },
                { title: 'Availed', dataIndex: 'availed', align: 'center' },
                { title: 'Balance', dataIndex: 'balance', align: 'center' },
              ]}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card size="small" title="Action Panel" className="shadow-sm h-full">
            <div className="mb-3">
              <Text className="text-xs block mb-1">Bulk Update</Text>
              <div className="flex">
                <Select size="small" className="w-full mr-2" placeholder="Select Action" />
                <Button size="small" type="primary">Update</Button>
              </div>
            </div>
            <div>
              <Text className="text-xs block mb-1">Copy From</Text>
              <div className="flex">
                <DatePicker size="small" className="w-full mr-2" />
                <Button size="small" type="primary" className="bg-blue-600">Copy</Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

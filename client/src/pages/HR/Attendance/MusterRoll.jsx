import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Button, Select, DatePicker, Space, Divider } from 'antd';
import { DownloadOutlined, UploadOutlined, FilterOutlined, DownOutlined } from '@ant-design/icons';
import api from '../../../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function MusterRoll() {
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
        if (text === 'HD') { colorClass = 'text-yellow-600 font-bold'; bgClass = 'bg-yellow-50'; }
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

  const defaultData = [
    {
      key: '1', srNo: 1, empCode: 'E00123', name: 'Rahul Kumar', designation: 'Software Eng', department: 'IT', branch: 'Noida', shift: 'G1',
      day1: 'P', day2: 'P', day3: 'P', day4: 'P', day5: 'L', day6: 'WO', day7: 'WO', day8: 'P', day9: 'P', day10: 'P', day11: 'OD', day12: 'H', day13: 'P', day14: 'A',
      totalHrs: '176:30', otHrs: '05:15', leave: 1.0, od: 1.0, wo: 4.0, holiday: 1.0, shortHrs: '02:45', remarks: '0'
    },
    {
      key: '2', srNo: 2, empCode: 'E00124', name: 'Priya Sharma', designation: 'Sr. Developer', department: 'IT', branch: 'Noida', shift: 'G1',
      day1: 'H', day2: 'P', day3: 'P', day4: 'P', day5: 'P', day6: 'WO', day7: 'WO', day8: 'P', day9: 'P', day10: 'P', day11: 'P', day12: 'P', day13: 'P', day14: 'L',
      totalHrs: '171:20', otHrs: '04:30', leave: 1.5, od: 0.0, wo: 4.0, holiday: 1.0, shortHrs: '05:30', remarks: '1'
    },
    {
      key: '3', srNo: 3, empCode: 'E00125', name: 'Amit Patel', designation: 'Team Lead', department: 'IT', branch: 'Noida', shift: 'G2',
      day1: 'P', day2: 'P', day3: 'P', day4: 'P', day5: 'P', day6: 'WO', day7: 'WO', day8: 'P', day9: 'P', day10: 'P', day11: 'P', day12: 'P', day13: 'A', day14: 'P',
      totalHrs: '182:10', otHrs: '03:45', leave: 0.0, od: 0.0, wo: 4.0, holiday: 1.0, shortHrs: '00:00', remarks: '0'
    }
  ];

  const [dataSource, setDataSource] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMusterRoll();
  }, []);

  const fetchMusterRoll = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/muster-roll');
      if(res.data && res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        const processedData = res.data.data.map(row => recalculateRow(row));
        setDataSource(processedData);
      }
    } catch (err) {
      console.error('Failed to fetch muster roll', err);
    } finally {
      setLoading(false);
    }
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

  const handleCellChange = (value, rowKey, dayKey) => {
    const newData = [...dataSource];
    const index = newData.findIndex(item => rowKey === item.key);
    if (index > -1) {
      newData[index][dayKey] = value;
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

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await api.post('/attendance/muster-roll/save', { updates: dataSource });
      if (res.data && res.data.success) {
        // reload
        await fetchMusterRoll();
      }
    } catch (err) {
      console.error('Failed to save muster roll', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(dataSource);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Muster Roll");
      XLSX.writeFile(wb, "MusterRoll_Export.xlsx");
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
        
        // Match with current data and update
        const newData = [...dataSource];
        data.forEach(row => {
          const index = newData.findIndex(item => item.empCode === row.empCode);
          if (index > -1) {
            // update days
            for (let i = 1; i <= 31; i++) {
              if (row[`day${i}`]) {
                newData[index][`day${i}`] = row[`day${i}`];
              }
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
          <Button type="primary" icon={<FilterOutlined />}>Apply Filter</Button>
          <Button onClick={handleSave} loading={loading} type="primary" className="bg-green-600">Save Changes</Button>
          <Button type="primary" icon={<DownloadOutlined />} className="bg-blue-600" onClick={handleExport}>Export</Button>
        </Space>
      </div>

      {/* Filters Section */}
      <Card size="small" className="mb-4 bg-gray-50 border border-gray-200 shadow-sm">
        <Text strong className="text-xs mb-2 block">Basic Filters</Text>
        <Row gutter={[12, 12]}>
          <Col span={4}><Text className="text-xs">Company Name</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
          <Col span={4}><Text className="text-xs">Branch</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
          <Col span={4}><Text className="text-xs">Department</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
          <Col span={4}><Text className="text-xs">Designation</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
          <Col span={4}><Text className="text-xs">Grade</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
          <Col span={4}><Text className="text-xs">Employee Type</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
        </Row>
        
        <Divider className="my-3" />
        
        <div className="flex justify-between items-center cursor-pointer text-blue-600 text-xs" onClick={() => setShowAdvanced(!showAdvanced)}>
          <Text className="text-blue-600">{showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'} <DownOutlined rotate={showAdvanced ? 180 : 0}/></Text>
        </div>

        {showAdvanced && (
          <Row gutter={[12, 12]} className="mt-3">
            <Col span={4}><Text className="text-xs">Shift Name</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
            <Col span={4}><Text className="text-xs">Location</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
            <Col span={4}><Text className="text-xs">Cost Center</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="All" size="small" className="w-full"><Option value="All">All</Option></Select></Col>
            <Col span={4}><Text className="text-xs">Employee Status</Text><Select showSearch filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())} defaultValue="Active" size="small" className="w-full"><Option value="Active">Active</Option></Select></Col>
            <Col span={8}><Text className="text-xs">Date Range</Text><RangePicker size="small" className="w-full" /></Col>
          </Row>
        )}
      </Card>

      {/* Main Data Grid */}
      <div className="border border-gray-200 rounded-md">
        <Table
          columns={columns}
          dataSource={dataSource}
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
                <Title level={3} className="m-0">125</Title>
              </Col>
              <Col span={6} className="text-center">
                <Text type="secondary" className="text-xs block">Avg Present Days</Text>
                <Title level={3} className="text-green-500 m-0">22.4</Title>
                <Text type="secondary" className="text-[10px]">Per Employee</Text>
              </Col>
              <Col span={6} className="text-center">
                <Text type="secondary" className="text-xs block">Avg Leave Days</Text>
                <Title level={3} className="text-orange-500 m-0">1.7</Title>
                <Text type="secondary" className="text-[10px]">Per Employee</Text>
              </Col>
              <Col span={6} className="text-center">
                <Text type="secondary" className="text-xs block">Avg WO Days</Text>
                <Title level={3} className="text-gray-500 m-0">4.0</Title>
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
              dataSource={[
                { key: 1, type: 'CL (Casual Leave)', ob: 12.0, availed: 1.5, balance: 10.5 },
                { key: 2, type: 'SL (Sick Leave)', ob: 10.0, availed: 0.0, balance: 10.0 },
                { key: 3, type: 'PL (Privilege Leave)', ob: 15.0, availed: 2.0, balance: 13.0 },
              ]}
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

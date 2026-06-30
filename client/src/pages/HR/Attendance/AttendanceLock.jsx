import React, { useState } from 'react';
import { Card, Row, Col, Typography, Table, Button, DatePicker, Modal, Descriptions } from 'antd';
import { FilterOutlined, LockOutlined, UnlockOutlined, EyeOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function AttendanceLock() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  
  const handleView = (record) => {
    setSelectedRecord(record);
    setIsModalVisible(true);
  };
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
      width: 140,
      render: (_, record) => (
        <div className="flex gap-2">
          {record.status === 'Locked' 
            ? <Button size="small" icon={<UnlockOutlined />} /> 
            : <Button size="small" danger icon={<LockOutlined />} />
          }
          <Button size="small" type="primary" icon={<EyeOutlined />} onClick={() => handleView(record)}>View</Button>
        </div>
      )
    },
  ];

  const dataSource = [
    { key: '1', srNo: 1, period: '01-06-2026 To 31-06-2026', startDate: '2026-06-01', endDate: '2026-06-31', status: 'Locked', lockedBy: 'Sandeep Kumar', lockedOn: '01-06-2026 11:30', unlockBy: '', unlockOn: '' },
    { key: '2', srNo: 2, period: '01-05-2026 To 31-05-2026', startDate: '2026-05-01', endDate: '2026-05-31', status: 'Open', lockedBy: '-', lockedOn: '-', unlockBy: '-', unlockOn: '-' },
  ];

  const filteredData = dataSource.filter(item => {
    let isValid = true;
    if (fromDate) {
      isValid = isValid && new Date(item.startDate) >= fromDate.toDate();
    }
    if (toDate) {
      isValid = isValid && new Date(item.endDate) <= toDate.toDate();
    }
    return isValid;
  });

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
            <DatePicker value={fromDate} onChange={setFromDate} size="small" className="w-full" />
          </Col>
          <Col span={6}>
            <Text className="text-xs">To Date</Text>
            <DatePicker value={toDate} onChange={setToDate} size="small" className="w-full" />
          </Col>
          <Col span={12} className="text-right">
            <Button type="primary" icon={<FilterOutlined />} onClick={() => {/* Filtering is handled implicitly by state */}}>Apply Filter</Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredData}
        size="small"
        bordered
        pagination={false}
        className="text-[12px]"
      />

      <Modal
        title="Attendance Lock Details"
        open={isModalVisible}
        onOk={() => setIsModalVisible(false)}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsModalVisible(false)}>
            Close
          </Button>
        ]}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Period">{selectedRecord.period}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Text className={selectedRecord.status === 'Locked' ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}>
                {selectedRecord.status}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Locked By">{selectedRecord.lockedBy}</Descriptions.Item>
            <Descriptions.Item label="Locked On">{selectedRecord.lockedOn}</Descriptions.Item>
            <Descriptions.Item label="Unlock By">{selectedRecord.unlockBy || '-'}</Descriptions.Item>
            <Descriptions.Item label="Unlock On">{selectedRecord.unlockOn || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

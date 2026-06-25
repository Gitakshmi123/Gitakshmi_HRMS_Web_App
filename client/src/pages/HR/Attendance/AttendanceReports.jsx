import React from 'react';
import { Typography } from 'antd';
const { Title, Text } = Typography;

export default function AttendanceReports() {
  return (
    <div className="p-4 bg-white min-h-screen">
      <Title level={4}>Reports</Title>
      <Text type="secondary">View attendance reports here...</Text>
    </div>
  );
}

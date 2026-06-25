import React from 'react';
import { Typography } from 'antd';
const { Title, Text } = Typography;

export default function HolidayCalendar() {
  return (
    <div className="p-4 bg-white min-h-screen">
      <Title level={4}>Holiday Calendar</Title>
      <Text type="secondary">Manage holidays here...</Text>
    </div>
  );
}

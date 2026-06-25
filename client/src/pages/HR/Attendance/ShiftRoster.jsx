import React from 'react';
import { Typography } from 'antd';
const { Title, Text } = Typography;

export default function ShiftRoster() {
  return (
    <div className="p-4 bg-white min-h-screen">
      <Title level={4}>Shift & Roster</Title>
      <Text type="secondary">Manage shift roster here...</Text>
    </div>
  );
}

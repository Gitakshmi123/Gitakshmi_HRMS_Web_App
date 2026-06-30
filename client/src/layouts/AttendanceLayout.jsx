import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TableOutlined,
  FileDoneOutlined,
  CheckSquareOutlined,
  LockOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  BarChartOutlined,
  HistoryOutlined,
  AimOutlined,
  SmileOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;

export default function AttendanceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // The main menu items to mirror the SuccessFactors style
  const menuItems = [
    {
      key: '/hr/attendance-dashboard',
      icon: <DashboardOutlined />,
      label: 'Attendance Dashboard',
    },
    {
      key: '/hr/attendance-sheet',
      icon: <TableOutlined />,
      label: 'Attendance Sheet',
    },
    {
      key: '/hr/muster-roll',
      icon: <TableOutlined />,
      label: 'Muster Roll',
    },
    {
      key: '/hr/daily-attendance',
      icon: <TableOutlined />,
      label: 'Daily Attendance',
    },
    {
      key: '/hr/attendance-summary',
      icon: <BarChartOutlined />,
      label: 'Attendance Summary',
    },
    {
      key: '/hr/regularization-request',
      icon: <FileDoneOutlined />,
      label: 'Regularization Request',
    },
    {
      key: '/hr/attendance-approval',
      icon: <CheckSquareOutlined />,
      label: 'Attendance Approval',
    },
    {
      key: '/hr/attendance-lock',
      icon: <LockOutlined />,
      label: 'Attendance Lock',
    },
    {
      key: '/hr/holiday-calendar',
      icon: <CalendarOutlined />,
      label: 'Holiday Calendar',
    },
    {
      key: '/hr/shift-roster',
      icon: <ScheduleOutlined />,
      label: 'Shift & Roster',
    },
    {
      key: '/hr/attendance-reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
    },
    // The existing legacy menus that user wants to preserve
    {
      type: 'divider',
    },
    {
      key: '/hr/attendance-history',
      icon: <HistoryOutlined />,
      label: 'History',
    },
    {
      key: '/hr/attendance/live-tracking',
      icon: <AimOutlined />,
      label: 'Live Tracking',
    },
    {
      key: '/hr/attendance-calendar',
      icon: <CalendarOutlined />,
      label: 'Legacy Calendar',
    },
    {
      key: '/hr/face-update-requests',
      icon: <SmileOutlined />,
      label: 'Face Updates',
    }
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <Layout className="h-full bg-transparent flex flex-row">
      <Sider 
        width={250} 
        className="bg-white border-r border-gray-200"
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        theme="light"
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0 pt-4"
        />
      </Sider>
      <Layout className="bg-transparent pl-4">
        <Content className="bg-white rounded-md shadow-sm min-h-full overflow-y-auto">
          {/* Outlet will render the sub-routes like AttendanceDashboard, AttendanceSheet, etc. */}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

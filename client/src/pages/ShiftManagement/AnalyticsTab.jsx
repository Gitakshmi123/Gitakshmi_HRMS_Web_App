import React, { useState, useEffect } from 'react';
import { Card, Spin, message, Row, Col, Statistic } from 'antd';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { LineChart, Users, Calendar, Replace } from 'lucide-react';
import api from '../../utils/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28CF8'];

export default function AnalyticsTab() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalActiveAssignments: 0,
    totalPendingSwaps: 0,
    currentMonthRostersGenerated: 0,
    shiftDistribution: [],
    swapAnalytics: []
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shift-analytics/dashboard');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      message.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
           <LineChart size={20} className="text-indigo-600"/> Shift Management Analytics
        </h2>
        <p className="text-sm text-slate-500">Live dashboard tracking shift distributions, swap requests, and roster fulfillment.</p>
      </div>

      <Row gutter={[16, 16]} className="mb-6">
        <Col span={8}>
          <Card className="shadow-sm border-slate-200">
            <Statistic 
              title={<span className="flex items-center gap-2"><Users size={16} className="text-blue-500"/> Total Employees Assigned</span>}
              value={stats.totalActiveAssignments} 
              valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="shadow-sm border-slate-200">
            <Statistic 
              title={<span className="flex items-center gap-2"><Replace size={16} className="text-orange-500"/> Pending Swap Requests</span>}
              value={stats.totalPendingSwaps} 
              valueStyle={{ color: '#fa8c16', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="shadow-sm border-slate-200">
            <Statistic 
              title={<span className="flex items-center gap-2"><Calendar size={16} className="text-green-500"/> Rosters Generated (This Month)</span>}
              value={stats.currentMonthRostersGenerated} 
              valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="Shift Types Distribution" className="shadow-sm border-slate-200 h-96">
            {stats.shiftDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.shiftDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.shiftDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-full text-slate-400">No shift data available</div>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Swap Requests Overview" className="shadow-sm border-slate-200 h-96">
            {stats.swapAnalytics.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.swapAnalytics} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#A28CF8" radius={[4, 4, 0, 0]}>
                    {stats.swapAnalytics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={
                        entry.name === 'Approved' ? '#52c41a' : 
                        entry.name === 'Rejected' ? '#f5222d' : '#fa8c16'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-full text-slate-400">No swap data available</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

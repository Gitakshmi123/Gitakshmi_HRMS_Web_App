import React, { useState, useEffect } from 'react';
import { Card, Timeline, Typography, Spin, message, Tag } from 'antd';
import { History, User, Activity } from 'lucide-react';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function AuditReplayTab() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs/shift');
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (error) {
      message.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('CREATE')) return 'green';
    if (action.includes('UPDATE')) return 'blue';
    if (action.includes('DELETE')) return 'red';
    if (action.includes('SWAP')) return 'purple';
    return 'default';
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
           <History size={20} className="text-indigo-600"/> Audit Replay
        </h2>
        <p className="text-sm text-slate-500">Track all changes, updates, and actions performed within the Shift Management module.</p>
      </div>

      <Card className="shadow-sm border-slate-200 min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-40"><Spin /></div>
        ) : logs.length === 0 ? (
          <div className="text-center text-slate-400 py-10">No audit logs found.</div>
        ) : (
          <Timeline mode="left">
            {logs.map((log) => (
              <Timeline.Item key={log._id} color={getActionColor(log.action)} dot={<Activity size={16} />}>
                <div className="mb-1 flex items-center justify-between">
                  <Text strong className="text-slate-700">{log.action.replace(/_/g, ' ')}</Text>
                  <Text type="secondary" className="text-xs">{dayjs(log.createdAt).format('DD MMM YYYY, hh:mm A')}</Text>
                </div>
                
                <div className="bg-slate-50 p-3 rounded border border-slate-100 text-sm">
                  <div className="flex items-center gap-2 mb-2 text-slate-600">
                    <User size={14} /> 
                    <span>
                      {log.performedBy ? `${log.performedBy.firstName} ${log.performedBy.lastName}` : 'System / Admin'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Tag color="cyan">{log.entity}</Tag>
                    {log.meta && Object.keys(log.meta).length > 0 && (
                      <span className="text-xs text-slate-400">
                        {JSON.stringify(log.meta)}
                      </span>
                    )}
                  </div>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>
    </div>
  );
}

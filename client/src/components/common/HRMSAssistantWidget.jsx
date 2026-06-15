import React, { useMemo, useState } from 'react';
import { Bot, MessageSquare, Send, X } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

function normalizeAssistantRole(role) {
  const r = String(role || '').toLowerCase();
  if (['hr'].includes(r)) return 'hr';
  if (['admin', 'psa', 'company_admin', 'company_super_admin'].includes(r)) return 'admin';
  return 'employee';
}

function formatAssistantResponse(payload) {
  if (!payload) return 'Please share a bit more detail so I can help correctly.';
  if (payload.message) return String(payload.message);
  if (!payload.data) return 'Please share a bit more detail so I can help correctly.';

  if (Array.isArray(payload.data)) {
    if (payload.data.length === 0) return 'I could not find an exact match. Please share full employee name.';
    return payload.data
      .slice(0, 8)
      .map((item) => {
        if (item.employee && item.leaveType) return `${item.employee} - ${item.leaveType}`;
        if (item.leaveType != null && item.available != null) return `${item.leaveType}: ${item.available}`;
        return JSON.stringify(item);
      })
      .join('\n');
  }

  if (typeof payload.data === 'object') {
    return Object.entries(payload.data)
      .map(([k, v]) => `${k}: ${v == null ? '-' : String(v)}`)
      .join('\n');
  }

  return String(payload.data);
}

export default function HRMSAssistantWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi, ask me about salary, attendance, leave balance, or profile.' },
  ]);

  const role = useMemo(() => normalizeAssistantRole(user?.role), [user?.role]);
  const userId = user?.id || user?._id || user?.employeeId || null;

  if (!userId) return null;

  const sendMessage = async () => {
    const query = input.trim();
    if (!query || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/hrms-assistant', {
        query,
        userRole: role,
        userId: String(userId),
      });
      const reply = formatAssistantResponse(res?.data);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Something went wrong.';
      setMessages((prev) => [...prev, { role: 'assistant', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[140]">
      {open && (
        <div className="mb-3 w-[350px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot size={16} />
              HRMS Assistant
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10">
              <X size={16} />
            </button>
          </div>

          <div className="h-[320px] overflow-y-auto p-3 space-y-2 bg-slate-50">
            {messages.map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="max-w-[88%] rounded-xl px-3 py-2 text-sm bg-white border border-slate-200 text-slate-500">
                Thinking...
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-2 flex items-center gap-2 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
              placeholder="Ask HRMS..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-60"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700"
        title="Open HRMS Assistant"
      >
        <MessageSquare size={22} />
      </button>
    </div>
  );
}

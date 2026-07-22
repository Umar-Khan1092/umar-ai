'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, User, Megaphone, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase, adminSupabase } from '@/lib/supabase';

const CATEGORIES = [
  { value: 'Attendance', label: '📋 Attendance', color: '#3B82F6' },
  { value: 'Results', label: '📊 Results', color: '#8B5CF6' },
  { value: 'Fees', label: '💰 Fees', color: '#F59E0B' },
  { value: 'Salary', label: '💳 Salary', color: '#10B981' },
  { value: 'Announcements', label: '📢 Announcements', color: '#6366F1' },
  { value: 'Timetable', label: '🗓️ Timetable', color: '#0EA5E9' },
  { value: 'Homework', label: '📚 Homework', color: '#EC4899' },
  { value: 'Leave', label: '🏖️ Leave', color: '#F97316' },
  { value: 'Emergency', label: '🚨 Emergency', color: '#EF4444' },
];

const ROLES = [
  { value: 'Teacher', label: 'All Teachers', icon: '👩‍🏫' },
  { value: 'Guardian', label: 'All Guardians / Parents', icon: '👨‍👩‍👧' },
  { value: 'Admin', label: 'All Admins', icon: '👨‍💼' },
];

export const NotificationsPage: React.FC = () => {
  const [tab, setTab] = useState<'send' | 'history'>('send');

  // Send form
  const [form, setForm] = useState({
    type: 'broadcast' as 'broadcast' | 'role' | 'individual',
    selectedRoles: [] as string[],
    recipientEmail: '',
    category: 'Announcements',
    title: '',
    message: '',
    url: '/',
  });

  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [isSending, setIsSending] = useState(false);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (tab === 'history') {
      fetchHistory();
    }
  }, [tab]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const dbClient = adminSupabase || supabase;
    const { data } = await dbClient
      .from('notification_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setHistory(data || []);
    setHistoryLoading(false);
  };

  const handleRoleToggle = (role: string) => {
    setForm(prev => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(role)
        ? prev.selectedRoles.filter(r => r !== role)
        : [...prev.selectedRoles, role]
    }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      setStatus({ type: 'error', message: 'Title and message are required.' });
      return;
    }
    if (form.type === 'role' && form.selectedRoles.length === 0) {
      setStatus({ type: 'error', message: 'Please select at least one role.' });
      return;
    }

    setIsSending(true);
    setStatus({ type: null, message: '' });

    try {
      const payload: any = {
        title: form.title,
        message: form.message,
        url: form.url,
        category: form.category,
      };

      if (form.type === 'role') {
        payload.roles = form.selectedRoles;
      } else if (form.type === 'individual') {
        // Find user by email
        const dbClient = adminSupabase || supabase;
        const { data: subs } = await dbClient
          .from('push_subscriptions')
          .select('user_id')
          .eq('user_id', form.recipientEmail)
          .limit(1);
        if (!subs || subs.length === 0) {
          setStatus({ type: 'error', message: 'No subscription found for that user. They must enable notifications first.' });
          setIsSending(false);
          return;
        }
        payload.userIds = [subs[0].user_id];
      }
      // broadcast: no userIds or roles

      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.error) throw new Error(result.error);

      setStatus({ type: 'success', message: `Notification sent to ${result.sent || 0} device(s) successfully!` });
      setForm(prev => ({ ...prev, title: '', message: '', url: '/' }));
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const getCategoryColor = (cat: string) => CATEGORIES.find(c => c.value === cat)?.color || '#6366F1';
  const getCategoryLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label || cat;

  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '12px', padding: '10px', display: 'flex' }}>
          <Bell size={22} color="white" />
        </div>
        <div>
          <h1 className="section-heading" style={{ margin: 0 }}>Notifications</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>Send push notifications to staff, guardians, or everyone</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--color-surface)', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {(['send', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              background: tab === t ? 'var(--color-primary, #6366F1)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--color-text-secondary)',
              transition: 'all 0.2s',
              textTransform: 'capitalize',
            }}
          >
            {t === 'send' ? '📤 Send' : '📋 History'}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <form onSubmit={handleSend} className="card form-card">
          {status.type && (
            <div className={`toast ${status.type}`} style={{ position: 'relative', top: 0, left: 0, right: 0, transform: 'none', marginBottom: '16px' }}>
              {status.message}
            </div>
          )}

          {/* Recipient Type */}
          <h2 className="card-heading">Recipients</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              { value: 'broadcast', label: '📢 Everyone', desc: 'All users' },
              { value: 'role', label: '👥 By Role', desc: 'Specific roles' },
              { value: 'individual', label: '👤 Individual', desc: 'Single user' },
            ].map(opt => (
              <div
                key={opt.value}
                onClick={() => setForm(prev => ({ ...prev, type: opt.value as any }))}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: `2px solid ${form.type === opt.value ? '#6366F1' : 'var(--color-border)'}`,
                  background: form.type === opt.value ? 'rgba(99,102,241,0.1)' : 'var(--color-surface)',
                  flex: '1 1 120px',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px', color: form.type === opt.value ? '#6366F1' : 'var(--color-text-main)' }}>{opt.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{opt.desc}</div>
              </div>
            ))}
          </div>

          {form.type === 'role' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {ROLES.map(r => (
                <div
                  key={r.value}
                  onClick={() => handleRoleToggle(r.value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: `2px solid ${form.selectedRoles.includes(r.value) ? '#6366F1' : 'var(--color-border)'}`,
                    background: form.selectedRoles.includes(r.value) ? 'rgba(99,102,241,0.1)' : 'var(--color-surface)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: form.selectedRoles.includes(r.value) ? '#6366F1' : 'var(--color-text-main)',
                    transition: 'all 0.15s',
                  }}
                >
                  {r.icon} {r.label}
                </div>
              ))}
            </div>
          )}

          {/* Category */}
          <h2 className="card-heading">Category</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {CATEGORIES.map(cat => (
              <div
                key={cat.value}
                onClick={() => setForm(prev => ({ ...prev, category: cat.value }))}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  border: `2px solid ${form.category === cat.value ? cat.color : 'var(--color-border)'}`,
                  background: form.category === cat.value ? cat.color + '20' : 'var(--color-surface)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: form.category === cat.value ? cat.color : 'var(--color-text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {cat.label}
              </div>
            ))}
          </div>

          {/* Message Details */}
          <h2 className="card-heading">Message</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Title <span className="required-indicator">*</span></label>
              <input
                className="input-field"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder={`e.g. "${form.category} Update"`}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Message <span className="required-indicator">*</span></label>
              <textarea
                className="input-field"
                value={form.message}
                onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Type your notification message here..."
                rows={3}
                required
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Deep Link URL (optional)</label>
              <input
                className="input-field"
                value={form.url}
                onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="/fees or /attendance"
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
                Where should clicking the notification take the user?
              </span>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={isSending} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
              <Send size={16} />
              {isSending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </form>
      )}

      {tab === 'history' && (
        <div className="card" style={{ padding: '20px' }}>
          <h2 className="card-heading">Notification History (last 20 days)</h2>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>Loading...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
              No notifications sent yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map(n => (
                <div key={n.id} style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: getCategoryColor(n.category), marginTop: '5px', flexShrink: 0
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-main)' }}>{n.title}</span>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                        background: getCategoryColor(n.category) + '20', color: getCategoryColor(n.category), fontWeight: 600
                      }}>
                        {getCategoryLabel(n.category)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>{n.message}</p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      <span>To: {n.recipient_id ? 'Individual' : (n.role || 'Everyone')}</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function Page() {
  return <NotificationsPage />;
}

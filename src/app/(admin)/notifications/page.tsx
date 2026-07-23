'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Send, ArrowLeft, Search, MessageSquare, Clock, User, Check, AlertCircle, Paperclip, CheckSquare, Inbox, X, CheckCircle } from 'lucide-react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type TabType = 'sent' | 'received' | 'chat' | 'compose';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>('sent');
  const [previousTab, setPreviousTab] = useState<TabType>('sent');

  // Data states
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Compose State
  const [composeForm, setComposeForm] = useState({
    subject: '',
    message: '',
    priority: 'Normal',
    targetType: 'Staff', // Staff or Students
    selectedRoles: [] as string[],
    selectedClasses: [] as string[],
    selectedStudents: [] as string[],
  });
  const [composeStatus, setComposeStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [isSending, setIsSending] = useState(false);

  // Available data
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setIsLoading(true);
    const dbClient = adminSupabase || supabase;
    try {
      if (tab === 'sent' || tab === 'compose') {
        const { data } = await dbClient.from('notification_history').select('*').order('created_at', { ascending: false }).limit(50);
        setSentMessages(data || []);
      } else if (tab === 'received') {
        // Assume messages sent to Admin role or this specific user
        const { data } = await dbClient.from('notifications').select('*').eq('role', 'Admin').order('created_at', { ascending: false }).limit(50);
        setReceivedMessages(data || []);
      } else if (tab === 'chat') {
        // Fetch all parent-teacher communications (mocking by fetching messages categorized as Chat)
        const { data } = await dbClient.from('notification_history').select('*').eq('category', 'Chat').order('created_at', { ascending: false }).limit(50);
        setChatMessages(data || []);
      }

      // Pre-load lookup data for compose
      if (tab === 'compose') {
        const [settingsRes, studentsRes, staffRes] = await Promise.all([
          dbClient.from('settings').select('*').eq('key', 'app_settings').single(),
          dbClient.from('students').select('id, name, class_name, section').neq('status', 'Struck Off'),
          dbClient.from('staff').select('id, name, role')
        ]);
        if (settingsRes.data?.value?.classes) {
          setAvailableClasses(settingsRes.data.value.classes);
        }
        if (studentsRes.data) setAvailableStudents(studentsRes.data);
        if (staffRes.data) setAvailableStaff(staffRes.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComposeClick = () => {
    setPreviousTab(tab === 'compose' ? 'sent' : tab);
    setTab('compose');
    setComposeStatus({ type: null, message: '' });
  };

  const handleCancelCompose = () => {
    setTab(previousTab);
  };

  const handleSend = async () => {
    if (!composeForm.subject.trim() || !composeForm.message.trim()) {
      setComposeStatus({ type: 'error', message: 'Subject and message are required.' });
      return;
    }
    setIsSending(true);
    setComposeStatus({ type: null, message: '' });
    
    try {
      const dbClient = adminSupabase || supabase;
      
      const payload: any = {
        title: composeForm.subject,
        message: composeForm.message,
        url: '/',
        category: 'Announcements',
      };

      if (composeForm.targetType === 'Staff') {
        payload.roles = composeForm.selectedRoles.length > 0 ? composeForm.selectedRoles : ['Teacher', 'Admin'];
      } else {
        payload.roles = ['Guardian'];
      }

      const { error } = await dbClient.from('notification_history').insert([payload]);
      if (error) throw error;

      setComposeStatus({ type: 'success', message: 'Message sent successfully.' });
      setTimeout(() => {
        setComposeForm({ subject: '', message: '', priority: 'Normal', targetType: 'Staff', selectedRoles: [], selectedClasses: [], selectedStudents: [] });
        setTab('sent');
      }, 1500);
    } catch (err: any) {
      setComposeStatus({ type: 'error', message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const renderCard = (msg: any, isReceived = false) => {
    const time = new Date(msg.created_at || new Date()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(msg.created_at || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    return (
      <div key={msg.id} style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        border: '1px solid #E2E8F0',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        position: 'relative'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: isReceived ? '#F1F5F9' : '#EFF6FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: isReceived ? '#64748B' : '#3B82F6'
        }}>
          {isReceived ? <User size={20} /> : <Bell size={20} />}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {msg.title || 'No Subject'}
            </h4>
            <span style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <Clock size={12} /> {date} • {time}
            </span>
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {msg.message}
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: '#F1F5F9', color: '#475569', fontWeight: 500 }}>
              {isReceived ? 'From: System/User' : `To: ${(msg.roles || []).join(', ') || 'All'}`}
            </span>
            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: '#F0FDF4', color: '#16A34A', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={12} /> Delivered
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'var(--font-inter, sans-serif)' }}>
      {/* Sticky Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
        position: 'sticky',
        top: '0',
        background: '#F8FAFC',
        padding: '16px 0',
        zIndex: 10,
        borderBottom: '1px solid #E2E8F0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {tab === 'compose' ? (
            <button 
              onClick={handleCancelCompose}
              style={{ background: 'transparent', border: '1px solid #E2E8F0', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ArrowLeft size={20} color="#475569" />
            </button>
          ) : (
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={24} color="#FFF" />
            </div>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#1E293B' }}>
              {tab === 'compose' ? 'New Message' : 'Notifications & Messages'}
            </h1>
            <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
              {tab === 'compose' ? 'Send a broadcast or individual message' : 'Manage all communications across the school'}
            </p>
          </div>
        </div>
        
        {tab !== 'compose' && (
          <button 
            onClick={handleComposeClick}
            style={{
              background: '#3B82F6', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
            }}
          >
            <Send size={16} /> Send New Message
          </button>
        )}
      </div>

      {tab !== 'compose' && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '1px' }}>
          {[
            { id: 'sent', label: 'Sent', icon: Send },
            { id: 'received', label: 'Received', icon: Inbox },
            { id: 'chat', label: 'Teacher Parent Chat', icon: MessageSquare }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as TabType)}
              style={{
                background: tab === t.id ? '#FFF' : 'transparent',
                border: '1px solid',
                borderColor: tab === t.id ? '#E2E8F0' : 'transparent',
                borderBottomColor: tab === t.id ? '#FFF' : 'transparent',
                padding: '10px 20px',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: tab === t.id ? 600 : 500,
                color: tab === t.id ? '#3B82F6' : '#64748B',
                marginBottom: '-1px',
                position: 'relative',
                zIndex: tab === t.id ? 2 : 1
              }}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      {tab === 'sent' && (
        <div>
          {isLoading ? <p>Loading sent messages...</p> : 
           sentMessages.length > 0 ? sentMessages.map(m => renderCard(m, false)) : 
           <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px' }}>No sent messages found.</p>
          }
        </div>
      )}

      {tab === 'received' && (
        <div>
          {isLoading ? <p>Loading received messages...</p> : 
           receivedMessages.length > 0 ? receivedMessages.map(m => renderCard(m, true)) : 
           <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px' }}>No received messages found.</p>
          }
        </div>
      )}

      {tab === 'chat' && (
        <div style={{ display: 'flex', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', height: '600px', overflow: 'hidden' }}>
          <div style={{ width: '300px', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
                <input type="text" placeholder="Search chats..." style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px', fontSize: '14px' }}>No active chats.</p>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9' }}>
            <div style={{ textAlign: 'center', color: '#94A3B8' }}>
              <MessageSquare size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <h3>Select a conversation</h3>
              <p>Monitor communications between teachers and parents.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'compose' && (
        <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {composeStatus.type && (
            <div style={{ padding: '12px 16px', background: composeStatus.type === 'success' ? '#F0FDF4' : '#FEF2F2', color: composeStatus.type === 'success' ? '#16A34A' : '#DC2626', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0' }}>
              {composeStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {composeStatus.message}
            </div>
          )}
          
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '32px' }}>
              
              {/* Left Sidebar - Recipients */}
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1E293B' }}>Recipients</h3>
                
                <div style={{ display: 'flex', background: '#F1F5F9', padding: '4px', borderRadius: '8px', marginBottom: '16px' }}>
                  <button
                    onClick={() => setComposeForm(p => ({ ...p, targetType: 'Staff' }))}
                    style={{ flex: 1, padding: '6px', background: composeForm.targetType === 'Staff' ? '#FFF' : 'transparent', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, color: composeForm.targetType === 'Staff' ? '#0F172A' : '#64748B', cursor: 'pointer', boxShadow: composeForm.targetType === 'Staff' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  >
                    Staff
                  </button>
                  <button
                    onClick={() => setComposeForm(p => ({ ...p, targetType: 'Students' }))}
                    style={{ flex: 1, padding: '6px', background: composeForm.targetType === 'Students' ? '#FFF' : 'transparent', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 500, color: composeForm.targetType === 'Students' ? '#0F172A' : '#64748B', cursor: 'pointer', boxShadow: composeForm.targetType === 'Students' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  >
                    Students
                  </button>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                  {composeForm.targetType === 'Staff' ? (
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={composeForm.selectedRoles.includes('Teacher')} 
                          onChange={(e) => {
                            const newRoles = e.target.checked ? [...composeForm.selectedRoles, 'Teacher'] : composeForm.selectedRoles.filter(r => r !== 'Teacher');
                            setComposeForm(p => ({ ...p, selectedRoles: newRoles }));
                          }}
                        /> All Teachers
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={composeForm.selectedRoles.includes('Admin')} 
                          onChange={(e) => {
                            const newRoles = e.target.checked ? [...composeForm.selectedRoles, 'Admin'] : composeForm.selectedRoles.filter(r => r !== 'Admin');
                            setComposeForm(p => ({ ...p, selectedRoles: newRoles }));
                          }}
                        /> All Admins
                      </label>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={composeForm.selectedClasses.length === availableClasses.length && availableClasses.length > 0} 
                          onChange={(e) => {
                            setComposeForm(p => ({ ...p, selectedClasses: e.target.checked ? [...availableClasses] : [] }));
                          }}
                        /> All Classes
                      </label>
                      <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {availableClasses.map(cls => (
                          <label key={cls} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={composeForm.selectedClasses.includes(cls)} 
                              onChange={(e) => {
                                const newClasses = e.target.checked ? [...composeForm.selectedClasses, cls] : composeForm.selectedClasses.filter(c => c !== cls);
                                setComposeForm(p => ({ ...p, selectedClasses: newClasses }));
                              }}
                            /> {cls}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right - Message Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Subject</label>
                  <input 
                    type="text" 
                    value={composeForm.subject}
                    onChange={e => setComposeForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Enter message subject" 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }} 
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Message</label>
                  <textarea 
                    value={composeForm.message}
                    onChange={e => setComposeForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Type your message here..." 
                    rows={8}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', resize: 'vertical' }} 
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button style={{ background: 'transparent', border: 'none', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                      <Paperclip size={16} /> Attach File
                    </button>
                    <select 
                      value={composeForm.priority}
                      onChange={e => setComposeForm(p => ({ ...p, priority: e.target.value }))}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: '#F8FAFC' }}
                    >
                      <option value="Normal">Normal Priority</option>
                      <option value="High">High Priority 🚨</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={handleCancelCompose}
                      style={{ background: '#F1F5F9', color: '#475569', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSend}
                      disabled={isSending}
                      style={{ background: '#3B82F6', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: isSending ? 'not-allowed' : 'pointer', opacity: isSending ? 0.7 : 1 }}
                    >
                      <Send size={16} /> {isSending ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

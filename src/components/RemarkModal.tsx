import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface RemarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  context: 'Attendance' | 'Marks';
  subject?: string;
}

export const RemarkModal: React.FC<RemarkModalProps> = ({ isOpen, onClose, studentId, studentName, context, subject }) => {
  const { user } = useAuth();
  const [remark, setRemark] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{type: 'success' | 'error' | null, message: string}>({type: null, message: ''});

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!remark.trim()) return;
    setIsSending(true);
    setStatus({type: null, message: ''});

    try {
      const { error } = await supabase.from('notifications').insert({
        recipient_id: 'parent_' + studentId,
        recipient_role: 'Guardian',
        sender_id: user?.id || '',
        sender_role: 'Teacher',
        message: remark,
        context: context,
        student_id: studentId,
        subject: subject
      });

      if (error) throw new Error(error.message);
      
      setStatus({type: 'success', message: 'Remark sent to parent successfully!'});
      setTimeout(() => {
        onClose();
        setRemark('');
        setStatus({type: null, message: ''});
      }, 1500);
    } catch (err: any) {
      setStatus({type: 'error', message: err.message || 'Error sending remark'});
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '24px', position: 'relative', backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', boxShadow: 'var(--tp-shadow-soft, 0 4px 20px rgba(0,0,0,0.08))' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: '#F8FAFC', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: '#64748B' }}>
          <X size={18} />
        </button>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: '#1E293B' }}>Send Remark</h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748B' }}>
          To Parent of: <strong style={{ color: '#1E293B' }}>{studentName}</strong>
        </p>

        {status.type && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontWeight: 500, backgroundColor: status.type === 'success' ? '#F0FDF4' : '#FEF2F2', color: status.type === 'success' ? '#16A34A' : '#EF4444' }}>
            {status.message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Message</label>
          <textarea 
            style={{ width: '100%', minHeight: '120px', resize: 'vertical', padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '14px', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            placeholder={`Type your remark regarding ${context}...`}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} disabled={isSending} style={{ padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, backgroundColor: 'transparent', color: '#64748B', border: 'none', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSend} disabled={!remark.trim() || isSending} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, backgroundColor: (!remark.trim() || isSending) ? '#94A3B8' : 'var(--tp-primary, #2563EB)', color: '#FFFFFF', border: 'none', cursor: (!remark.trim() || isSending) ? 'not-allowed' : 'pointer', boxShadow: (!remark.trim() || isSending) ? 'none' : 'var(--tp-shadow-soft)' }}>
            <Send size={16} /> {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

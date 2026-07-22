import { useState } from 'react';
import { X, MessageCircle, User, CheckCircle, Loader2 } from 'lucide-react';

interface WhatsAppSalaryModalProps {
  slip: any;
  onClose: () => void;
  onSend: (message: string) => void;
}

export const WhatsAppSalaryModal: React.FC<WhatsAppSalaryModalProps> = ({ slip, onClose, onSend }) => {
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [_copied, setCopied] = useState(false);

  const defaultTemplate = `Dear {{employee_name}},

Your salary for {{salary_month}} has been successfully disbursed.

*Salary Summary*
Base Salary: Rs {{base_salary}}
Deductions: Rs {{deductions}}
*Net Paid: Rs {{net_salary}}*

Please find your official invoice on the portal or in your records.

Thank you for your dedication.`;

  const [messageTemplate, _setMessageTemplate] = useState(defaultTemplate);
  void _setMessageTemplate;

  // Computed Values
  const deductions = (slip.advance_deduction || 0) + (slip.absent_deduction || 0);
  const employeeId = slip.id.substring(0, 8).toUpperCase();

  const formatMonthName = (monthStr: string) => {
    if (/^\d{4}-\d{2}$/.test(monthStr)) {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return monthStr;
  };

  const formattedMonth = formatMonthName(slip.month);

  const parseMessage = (template: string) => {
    return template
      .replace(/{{employee_name}}/g, slip.staff_name)
      .replace(/{{salary_month}}/g, formattedMonth)
      .replace(/{{base_salary}}/g, slip.base_salary.toLocaleString())
      .replace(/{{deductions}}/g, deductions.toLocaleString())
      .replace(/{{net_salary}}/g, slip.net_payable.toLocaleString());
  };

  const currentMessage = parseMessage(messageTemplate);

  const _handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  void _handleCopy;

  const handleSend = () => {
    setIsSending(true);
    // Simulate network latency for a premium feel
    setTimeout(() => {
      setIsSending(false);
      setIsSuccess(true);
      setTimeout(() => {
        onSend(currentMessage);
      }, 1000);
    }, 1500);
  };


  return (
    <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div className="modal-content" style={{ 
        maxWidth: '500px', 
        width: '95%', 
        padding: '0', 
        borderRadius: '16px', 
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
      }}>
        
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#dcf8c6', padding: '8px', borderRadius: '100%' }}>
              <MessageCircle size={24} color="#047857" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>Share Salary Notification</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Enterprise WhatsApp Integration</p>
            </div>
          </div>
          <button onClick={onClose} style={{ 
            background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' 
          }} onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        {/* Body Split */}
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          
          {/* Left Panel: Verification */}
          <div style={{ 
            flex: '1 1 350px', 
            background: '#ffffff', 
            borderRight: '1px solid #e2e8f0', 
            padding: '24px' 
          }}>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '16px', fontWeight: 600 }}>Employee Details</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '100%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} color="#94a3b8" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#0f172a' }}>{slip.staff_name}</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>{slip.staff_role} • ID: EMP-{employeeId}</div>
                <div style={{ fontSize: '12px', color: '#047857', fontWeight: 500, marginTop: '4px' }}>Salary Month: {formattedMonth}</div>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '16px', fontWeight: 600 }}>Salary Breakdown</h3>
            
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px', color: '#475569' }}>
                <span>Base Salary</span>
                <span style={{ fontWeight: 500 }}>Rs {slip.base_salary.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px', color: '#475569' }}>
                <span>Deductions</span>
                <span style={{ color: '#dc2626', fontWeight: 500 }}>{deductions > 0 ? `- Rs ${deductions.toLocaleString()}` : 'Rs 0'}</span>
              </div>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '12px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>
                <span>Net Salary</span>
                <span style={{ color: '#059669' }}>Rs {slip.net_payable.toLocaleString()}</span>
              </div>
            </div>
            
            <div style={{ marginTop: '24px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} color="#059669" /> Verify details before sending.
              </div>
            </div>
          </div>
          {/* The right panel was removed as per request to just send PDF directly */}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '20px 24px', 
          borderTop: '1px solid #e2e8f0', 
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} disabled={isSending || isSuccess} style={{ 
              background: 'transparent', border: 'none', color: '#64748b', fontSize: '14px', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 
            }}>
              Cancel
            </button>
            <button 
              onClick={handleSend} 
              disabled={isSending || isSuccess}
              style={{ 
                background: isSuccess ? '#059669' : '#047857', 
                border: 'none', 
                color: '#ffffff', 
                fontSize: '14px', 
                padding: '10px 24px', 
                borderRadius: '8px', 
                cursor: (isSending || isSuccess) ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontWeight: 600,
                boxShadow: '0 4px 6px -1px rgba(4, 120, 87, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              {isSending ? (
                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending PDF...</>
              ) : isSuccess ? (
                <><CheckCircle size={16} /> PDF Sent Successfully!</>
              ) : (
                <><MessageCircle size={16} /> Send Invoice PDF</>
              )}
            </button>
          </div>
        </div>

      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

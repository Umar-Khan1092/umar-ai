import React, { useState, useEffect } from 'react';
import TimeKeeperWrapper from 'react-timekeeper';

// Handle Vite CommonJS interop for default exports
const TimeKeeper = (TimeKeeperWrapper as any).default || TimeKeeperWrapper;

interface CustomTimePickerProps {
  time: string;
  onSave: (time: string) => void;
  onCancel: () => void;
  minTime?: string;
  maxTime?: string;
}

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const parts = timeStr.toLowerCase().split(' ');
  const time = parts[0];
  const modifier = parts[1] || '';
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'pm' && hours < 12) hours += 12;
  if (modifier === 'am' && hours === 12) hours = 0;
  return hours * 60 + (minutes || 0);
};

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ time, onSave, onCancel, minTime, maxTime }) => {
  const [tempTime, setTempTime] = useState(time || '08:00');

  useEffect(() => {
    if (time) {
      setTempTime(time);
    }
  }, [time]);

  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 9999 }}>
      <div className="premium-timepicker-wrapper" style={{ overflow: 'hidden', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.05)' }}>
      <style>{`
        .premium-timepicker-wrapper .react-timekeeper__clock-hours span,
        .premium-timepicker-wrapper .react-timekeeper__clock-minutes span {
          font-weight: 700 !important;
          font-size: 15px !important;
        }
        .premium-timepicker-wrapper .react-timekeeper__time-info {
          font-weight: bold !important;
        }
        .premium-timepicker-wrapper .react-timekeeper__meridiem-toggle {
          font-weight: bold !important;
        }
      `}</style>
      <TimeKeeper 
        time={tempTime}
        onChange={(newTime: any) => setTempTime(newTime.formatted12)}
        switchToMinuteOnHourSelect
        doneButton={() => {
          const currentMins = timeToMinutes(tempTime);
          const minMins = minTime ? timeToMinutes(minTime) : -1;
          const maxMins = maxTime ? timeToMinutes(maxTime) : 9999;
          const isOutOfRange = (minTime && currentMins < minMins) || (maxTime && currentMins > maxMins);
          
          return (
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            {isOutOfRange && (
              <div style={{ padding: '8px 12px', color: '#DC2626', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', background: '#FEE2E2', borderBottom: '1px solid #FECACA' }}>
                <span style={{ fontSize: '14px' }}>⚠️</span> 
                {`Time must be between ${minTime} and ${maxTime}`}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', padding: '12px' }}>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
              style={{ 
                flex: 1, 
                background: 'var(--color-bg-secondary)', 
                color: 'var(--color-text-main)', 
                border: '1px solid var(--color-border)', 
                padding: '8px', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: 600, 
                fontSize: '13px',
                transition: 'background 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.filter = 'brightness(0.95)'}
              onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
            >
              Cancel
            </button>
            <button 
              type="button"
              disabled={!!isOutOfRange}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(!isOutOfRange) onSave(tempTime); }} 
              style={{ 
                flex: 1, 
                background: isOutOfRange ? '#94a3b8' : 'var(--color-primary)', 
                color: 'white', 
                border: 'none', 
                padding: '8px', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: 600, 
                fontSize: '13px', 
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'background 0.2s'
              }}>
                Save Time
            </button>
            </div>
          </div>
        )}}
      />
      </div>
    </div>
  );
};

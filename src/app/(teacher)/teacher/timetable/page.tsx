'use client';

import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatTime } from '@/utils/formatDate';
import { supabase } from '@/lib/supabase';

interface TimetableEntry {
  id: string;
  class_name: string;
  section: string;
  day: string;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id: string;
  teacher_name: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TeacherTimetable: React.FC = () => {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      (async () => {
        try {
          const staffRes = await supabase.from('staff').select('id').eq('username', user.email).limit(1).maybeSingle();
          if (!staffRes.data) return;

          const res = await supabase.from('timetable').select('*').eq('teacher_id', staffRes.data.id);
          const mapped = (res.data || []).map(t => ({
            ...t,
            class_name: t.academic_class
          }));
          setTimetable(mapped);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [user]);

  if (loading) {
    return <div className="page-content">Loading your timetable...</div>;
  }

  const hasClasses = timetable.length > 0;

  return (
    <div className="teacher-page" style={{ paddingBottom: '80px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>My Timetable</h2>
      {!hasClasses ? (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', textAlign: 'center', padding: '60px', color: '#94A3B8', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))' }}>
          <Calendar size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
          <h3>You don't have any periods scheduled yet.</h3>
          <p>Please contact the Admin to arrange your timetable.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {(() => {
            // 1. Group by Class + Section
            const sectionSchedules: Record<string, TimetableEntry[]> = {};
            timetable.forEach(entry => {
              const key = `${entry.class_name}|${entry.section}`;
              if (!sectionSchedules[key]) sectionSchedules[key] = [];
              sectionSchedules[key].push(entry);
            });

            // 2. Generate Signatures
            const sectionSignatures = Object.entries(sectionSchedules).map(([key, entries]) => {
              const [cls, sec] = key.split('|');
              // Sort deterministically to create a stable signature
              const sortedEntries = [...entries].sort((a, b) => 
                a.day.localeCompare(b.day) || 
                a.start_time.localeCompare(b.start_time) || 
                a.subject.localeCompare(b.subject)
              );
              const sig = sortedEntries.map(e => `${e.day}_${e.start_time}_${e.end_time}_${e.subject}_${e.teacher_id}`).join('|');
              return { cls, sec, entries: sortedEntries, sig };
            });

            // 3. Merge identical sections
            type MergedGroup = { cls: string, sections: string[], entries: TimetableEntry[], all_entry_ids: string[] };
            const groupedBySignature: Record<string, MergedGroup> = {};
            sectionSignatures.forEach(({ cls, sec, entries, sig }) => {
              const key = `${cls}::${sig}`;
              if (!groupedBySignature[key]) {
                groupedBySignature[key] = { cls, sections: [], entries, all_entry_ids: [] }; 
              }
              groupedBySignature[key].sections.push(sec);
              groupedBySignature[key].all_entry_ids.push(...entries.map(e => e.id));
            });

            const mergedGroups = Object.values(groupedBySignature).sort((a, b) => a.cls.localeCompare(b.cls) || a.sections[0].localeCompare(b.sections[0]));

            if (mergedGroups.length === 0) {
              return (
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', textAlign: 'center', padding: '60px', color: '#94A3B8', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))' }}>
                  <Calendar size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                  <h3>No timetable entries found.</h3>
                </div>
              );
            }

            const cardColors = ['#E0F2FE', '#FCE7F3', '#FEF3C7', '#DCFCE7', '#F3E8FF'];
            const borderColors = ['#38BDF8', '#F472B6', '#FBBF24', '#4ADE80', '#C084FC'];

            return mergedGroups.map((group, idx) => {
              const themeColor = cardColors[idx % cardColors.length];
              const borderColor = borderColors[idx % borderColors.length];
              const uniqueTeachers = Array.from(new Set(group.entries.map(e => e.teacher_id)));
              const isModel1 = uniqueTeachers.length === 1 && group.entries.length >= 6; // Rough check for full week/model 1

              const minStartTime = group.entries.reduce((min, e) => e.start_time < min ? e.start_time : min, group.entries[0].start_time);
              const maxEndTime = group.entries.reduce((max, e) => e.end_time > max ? e.end_time : max, group.entries[0].end_time);
              const uniqueDays = Array.from(new Set(group.entries.map(e => e.day)));
              const daysText = uniqueDays.length === DAYS.length ? 'Full Week' : uniqueDays.join(', ');

              return (
                <div key={idx} style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '0', overflow: 'hidden', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', border: '1px solid #E2E8F0', borderLeft: `5px solid ${borderColor}` }}>
                  <div style={{ backgroundColor: themeColor, padding: '16px', borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                        <span>Class {group.cls} <span style={{ color: '#475569', fontSize: '1rem', fontWeight: 'normal' }}>({group.sections.sort().join(', ')})</span></span>
                      </h3>
                    </div>
                    {isModel1 && (
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 100%' }}><span style={{ color: '#475569' }}>Class Teacher:</span> <span style={{ fontWeight: 600, color: '#0F172A' }}>{group.entries[0].teacher_name}</span></div>
                        <div style={{ flex: '1 1 45%' }}><span style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>Timing:</span> <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatTime(minStartTime)}<br/>{formatTime(maxEndTime)}</span></div>
                        <div style={{ flex: '1 1 45%' }}><span style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>Days:</span> <span style={{ fontWeight: 600, color: '#0F172A' }}>{daysText}</span></div>
                      </div>
                    )}
                  </div>

                  {isModel1 ? (
                    <div style={{ padding: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#475569', fontSize: '1rem', fontWeight: 600 }}>Timetable</h4>
                      <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
                        <thead>
                          <tr>
                            <th style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '12px 8px', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Section</th>
                            {Array.from(new Set(group.entries.map(e => e.subject))).sort().map(sub => (
                              <th key={sub} style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '12px 8px', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sub}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.sections.sort().map(sec => (
                            <tr key={sec} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '12px 8px', fontWeight: 500, color: '#1E293B' }}>{sec}</td>
                              {Array.from(new Set(group.entries.map(e => e.subject))).sort().map(sub => (
                                <td key={sub} style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--tp-primary, #2563EB)' }}>✓</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table className="data-table" style={{ margin: 0, borderTop: 'none', width: '100%', borderCollapse: 'collapse', minWidth: '300px' }}>
                        <thead>
                          <tr>
                            <th style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject</th>
                            <th style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time</th>
                            <th style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Days</th>
                          </tr>
                        </thead>
                      <tbody>
                        {(() => {
                          const compressed: Record<string, { subject: string, start_time: string, end_time: string, days: string[] }> = {};
                          
                          group.entries.forEach(period => {
                            const key = `${period.subject}|${period.start_time}|${period.end_time}`;
                            if (!compressed[key]) {
                              compressed[key] = {
                                subject: period.subject,
                                start_time: period.start_time,
                                end_time: period.end_time,
                                days: []
                              };
                            }
                            if (!compressed[key].days.includes(period.day)) {
                              compressed[key].days.push(period.day);
                            }
                          });

                          return Object.values(compressed)
                            .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.subject.localeCompare(b.subject))
                            .map((period, i) => {
                              period.days.sort((d1, d2) => DAYS.indexOf(d1) - DAYS.indexOf(d2));
                              const daysDisplay = period.days.length === DAYS.length ? 'Full Week' : period.days.join(', ');

                              return (
                                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E293B', fontSize: '13px' }}>{period.subject}</td>
                                  <td style={{ padding: '12px 16px', color: '#475569', fontSize: '13px', whiteSpace: 'nowrap' }}>{formatTime(period.start_time)} - {formatTime(period.end_time)}</td>
                                  <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '13px' }}>{daysDisplay}</td>
                                </tr>
                              );
                            });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};

export default TeacherTimetable;

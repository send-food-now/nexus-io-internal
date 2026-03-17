'use client';

import { useState, useEffect } from 'react';

const theme = { bg: '#0a0a0a', fg: '#ededed', accent: '#3b82f6', muted: '#888', surface: '#141414', border: '#222' };

const STAGE_LABELS = {
  profile: 'Profile Candidate',
  discover: 'Discover Startups',
  categorize: 'Categorize & Score',
  enrich: 'Enrich Data',
  outreach: 'Generate Outreach',
  sheets: 'Export to Sheets',
  notify: 'Send Notification',
};

const STAGE_ORDER = ['profile', 'discover', 'categorize', 'enrich', 'outreach', 'sheets', 'notify'];

function StatusIcon({ status }) {
  if (status === 'completed') return <span style={{ color: '#22c55e', fontSize: 18 }}>&#10003;</span>;
  if (status === 'running') return <span style={{ color: theme.accent, fontSize: 18, animation: 'pulse 1.5s infinite' }}>&#9679;</span>;
  if (status === 'error') return <span style={{ color: '#ef4444', fontSize: 18 }}>&#10007;</span>;
  return <span style={{ color: theme.muted, fontSize: 18 }}>&#9675;</span>;
}

export default function JobStatus({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/job-status?jobId=${jobId}`);
        if (res.ok) {
          setJob(await res.json());
        } else {
          setError('Failed to fetch job status');
        }
      } catch (e) {
        setError(e.message);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  const sheetsUrl = job?.stages?.sheets?.result?.spreadsheetUrl;
  const isComplete = job?.status === 'completed';
  const isError = job?.status === 'error';

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: '40px 20px' }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ color: theme.fg, fontSize: 24, margin: 0 }}>Pipeline Status</h1>
          <button onClick={onBack} style={{ padding: '8px 16px', background: theme.surface, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
            New Candidate
          </button>
        </div>

        {error && <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>}

        <p style={{ color: theme.muted, fontSize: 13, marginBottom: 24 }}>Job ID: {jobId}</p>

        {isComplete && sheetsUrl && (
          <a href={sheetsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '14px 20px', background: '#22c55e', color: '#fff', borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: 15, marginBottom: 24, textDecoration: 'none' }}>
            View Google Sheet
          </a>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STAGE_ORDER.map((stage) => {
            const stageData = job?.stages?.[stage] || { status: 'pending' };
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8 }}>
                <StatusIcon status={stageData.status} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: theme.fg, fontSize: 14, margin: 0 }}>{STAGE_LABELS[stage]}</p>
                  {stageData.error && <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{stageData.error}</p>}
                </div>
                <span style={{ color: theme.muted, fontSize: 12, textTransform: 'capitalize' }}>{stageData.status}</span>
              </div>
            );
          })}
        </div>

        {isComplete && (
          <p style={{ color: '#22c55e', textAlign: 'center', marginTop: 24, fontSize: 15 }}>Pipeline completed successfully!</p>
        )}
        {isError && (
          <p style={{ color: '#ef4444', textAlign: 'center', marginTop: 24, fontSize: 15 }}>Pipeline encountered an error. Check stage details above.</p>
        )}
      </div>
    </div>
  );
}

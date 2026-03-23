'use client';

import { useState, useEffect } from 'react';

const theme = { bg: '#0a0a0a', fg: '#ededed', accent: '#3b82f6', muted: '#888', surface: '#141414', border: '#222' };

const PHASES = [
  {
    label: 'Operator Lens',
    stages: [
      { key: 'analyze', label: 'Analyze Candidate Profile' },
      { key: 'opportunities', label: 'Identify Best-Fit Opportunities' },
    ],
  },
  {
    label: 'Enrich',
    stages: [
      { key: 'targets', label: 'Build Target List' },
      { key: 'context', label: 'Populate Outreach Context' },
    ],
  },
  {
    label: 'Output',
    stages: [
      { key: 'sheets', label: 'Generate Google Sheet' },
      { key: 'notify', label: 'Send Notification' },
    ],
  },
];

function StatusIcon({ status }) {
  if (status === 'completed') return <span style={{ color: '#22c55e', fontSize: 18 }}>&#10003;</span>;
  if (status === 'running') return <span style={{ color: theme.accent, fontSize: 18, animation: 'pulse 1.5s infinite' }}>&#9679;</span>;
  if (status === 'error') return <span style={{ color: '#ef4444', fontSize: 18 }}>&#10007;</span>;
  return <span style={{ color: theme.muted, fontSize: 18 }}>&#9675;</span>;
}

function getPhaseStatus(phase, stages) {
  const statuses = phase.stages.map(s => stages?.[s.key]?.status || 'pending');
  if (statuses.some(s => s === 'error')) return 'error';
  if (statuses.every(s => s === 'completed')) return 'completed';
  if (statuses.some(s => s === 'running')) return 'running';
  return 'pending';
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {PHASES.map((phase) => {
            const phaseStatus = getPhaseStatus(phase, job?.stages);
            return (
              <div key={phase.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <StatusIcon status={phaseStatus} />
                  <p style={{ color: theme.fg, fontSize: 15, fontWeight: 600, margin: 0 }}>{phase.label}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 26 }}>
                  {phase.stages.map((stage) => {
                    const stageData = job?.stages?.[stage.key] || { status: 'pending' };
                    return (
                      <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8 }}>
                        <StatusIcon status={stageData.status} />
                        <div style={{ flex: 1 }}>
                          <p style={{ color: theme.fg, fontSize: 13, margin: 0 }}>{stage.label}</p>
                          {stageData.error && <p style={{ color: '#ef4444', fontSize: 11, margin: '4px 0 0' }}>{stageData.error}</p>}
                        </div>
                        <span style={{ color: theme.muted, fontSize: 11, textTransform: 'capitalize' }}>{stageData.status}</span>
                      </div>
                    );
                  })}
                </div>
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

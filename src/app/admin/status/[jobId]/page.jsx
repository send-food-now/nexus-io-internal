'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const colors = { bg: '#0a0a0a', surface: '#1a1a1a', border: '#2a2a2a', fg: '#e0e0e0', muted: '#888', accent: '#3b82f6', success: '#22c55e', error: '#ef4444', warning: '#f59e0b' };

const s = {
  page: { minHeight: '100vh', padding: '2rem', maxWidth: '640px', margin: '0 auto' },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' },
  subtitle: { color: colors.muted, fontSize: '0.875rem', marginBottom: '2rem' },
  card: { background: colors.surface, borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '1.25rem 1.5rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  stageIcon: (status) => ({
    width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
    background: status === 'completed' ? colors.success + '22' : status === 'running' ? colors.accent + '22' : status === 'failed' ? colors.error + '22' : colors.border + '44',
    color: status === 'completed' ? colors.success : status === 'running' ? colors.accent : status === 'failed' ? colors.error : colors.muted,
  }),
  stageInfo: { flex: 1 },
  stageName: { fontWeight: 600, fontSize: '0.95rem' },
  stageStatus: (status) => ({ fontSize: '0.8rem', color: status === 'completed' ? colors.success : status === 'running' ? colors.accent : status === 'failed' ? colors.error : colors.muted }),
  stageResult: { fontSize: '0.8rem', color: colors.muted, marginTop: '0.125rem' },
  retryBtn: { padding: '0.375rem 0.75rem', background: colors.error + '22', color: colors.error, border: `1px solid ${colors.error}44`, borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' },
  banner: (type) => ({
    background: type === 'success' ? colors.success + '15' : type === 'error' ? colors.error + '15' : colors.accent + '15',
    border: `1px solid ${type === 'success' ? colors.success : type === 'error' ? colors.error : colors.accent}33`,
    borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'center',
  }),
  link: { color: colors.accent, textDecoration: 'none', fontWeight: 600 },
  backBtn: { padding: '0.5rem 1rem', background: 'transparent', color: colors.fg, border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', marginTop: '1.5rem' },
  notFound: { textAlign: 'center', padding: '4rem 2rem', color: colors.muted },
};

const STAGE_LABELS = {
  profile: 'Profile Candidate',
  discover: 'Discover Startups',
  categorize: 'Categorize & Score',
  enrich: 'Enrich Data',
  outreach: 'Generate Outreach',
  sheets: 'Export to Sheets',
  notify: 'Notify Admin',
};

const STAGE_ICONS = { pending: '○', running: '◉', completed: '✓', failed: '✕' };

function formatResult(stage, result) {
  if (!result) return null;
  switch (stage) {
    case 'profile': return `${result.skills} skills identified • ${result.seniority} level`;
    case 'discover': return `Found ${result.count} startups`;
    case 'categorize': return `${result.exact} exact • ${result.recommended} recommended • ${result.luck} luck shot`;
    case 'enrich': return `Enriched ${result.enriched} startups`;
    case 'outreach': return `Generated ${result.generated} outreach emails`;
    case 'sheets': return null; // Handled by banner
    case 'notify': return result.emailSent ? 'Notification sent' : 'Notification skipped';
    default: return null;
  }
}

export default function JobStatusPage() {
  const { jobId } = useParams();
  const router = useRouter();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/job-status/${jobId}`);
      if (res.status === 404) {
        setError('not_found');
        return false;
      }
      if (!res.ok) return true; // Keep polling on transient errors
      const data = await res.json();
      setJob(data);

      // Stop polling if completed or failed
      return data.status !== 'completed' && data.status !== 'failed';
    } catch {
      return true; // Keep polling on network errors
    }
  }, [jobId]);

  useEffect(() => {
    let active = true;
    let timer;

    async function poll() {
      if (!active) return;
      const shouldContinue = await fetchStatus();
      if (active && shouldContinue) {
        timer = setTimeout(poll, 5000);
      }
    }

    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [fetchStatus]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await fetch(`/api/retry/${jobId}`, { method: 'POST' });
      // Resume polling
      const interval = setInterval(async () => {
        const res = await fetch(`/api/job-status/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setJob(data);
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
          }
        }
      }, 5000);
    } catch {
      // Ignore
    } finally {
      setRetrying(false);
    }
  }

  if (error === 'not_found') {
    return (
      <div style={s.page}>
        <div style={s.notFound}>
          <h2>Job Not Found</h2>
          <p>Job ID: {jobId}</p>
          <p style={{ marginTop: '0.5rem' }}>This job may have expired or the ID is incorrect.</p>
          <button style={s.backBtn} onClick={() => router.push('/admin')}>Back to Admin</button>
        </div>
      </div>
    );
  }

  const stages = job?.stages || {};
  const sheetUrl = stages.sheets?.result?.spreadsheetUrl;
  const allCompleted = job?.status === 'completed';
  const hasFailed = job?.status === 'failed';

  return (
    <div style={s.page}>
      <h1 style={s.title}>Pipeline Status</h1>
      <p style={s.subtitle}>{job?.candidateName || 'Loading...'} — {jobId.slice(0, 8)}...</p>

      {/* Completion banner */}
      {allCompleted && sheetUrl && (
        <div style={s.banner('success')}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: colors.success }}>Pipeline Complete</div>
          <a href={sheetUrl} target="_blank" rel="noopener noreferrer" style={s.link}>Open Google Sheet →</a>
        </div>
      )}

      {hasFailed && (
        <div style={s.banner('error')}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.error }}>Pipeline Failed</div>
          <p style={{ color: colors.muted, fontSize: '0.875rem', marginTop: '0.25rem' }}>One or more stages encountered an error. You can retry below.</p>
        </div>
      )}

      {/* Stage cards */}
      {Object.entries(STAGE_LABELS).map(([key, label]) => {
        const stage = stages[key] || { status: 'pending' };
        const resultText = formatResult(key, stage.result);

        return (
          <div key={key} style={s.card}>
            <div style={s.stageIcon(stage.status)}>{STAGE_ICONS[stage.status] || '○'}</div>
            <div style={s.stageInfo}>
              <div style={s.stageName}>{label}</div>
              <div style={s.stageStatus(stage.status)}>
                {stage.status === 'running' ? 'Processing...' : stage.status}
              </div>
              {resultText && <div style={s.stageResult}>{resultText}</div>}
              {stage.error && <div style={{ ...s.stageResult, color: colors.error }}>{stage.error}</div>}
            </div>
            {stage.status === 'failed' && (
              <button style={s.retryBtn} onClick={handleRetry} disabled={retrying}>
                {retrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
          </div>
        );
      })}

      <button style={s.backBtn} onClick={() => router.push('/admin')}>← Back to Admin</button>
    </div>
  );
}

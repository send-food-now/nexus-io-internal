'use client';

import { useState } from 'react';
import IntakeForm from './IntakeForm';
import JobStatus from './JobStatus';

const theme = { bg: '#0a0a0a', fg: '#ededed', accent: '#3b82f6', muted: '#888', surface: '#141414', border: '#222' };

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [currentJobId, setCurrentJobId] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 40, width: 360, textAlign: 'center' }}>
          <h1 style={{ color: theme.fg, fontSize: 24, marginBottom: 8 }}>Nexus Pipeline</h1>
          <p style={{ color: theme.muted, fontSize: 14, marginBottom: 24 }}>Admin Access Required</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            style={{ width: '100%', padding: '10px 14px', background: theme.bg, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button type="submit" style={{ width: '100%', padding: '10px 14px', background: theme.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            Sign In
          </button>
        </form>
      </div>
    );
  }

  if (currentJobId) {
    return <JobStatus jobId={currentJobId} onBack={() => setCurrentJobId(null)} />;
  }

  return <IntakeForm onJobCreated={(id) => setCurrentJobId(id)} />;
}

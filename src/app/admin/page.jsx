'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  card: {
    background: '#1a1a1a',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    padding: '2.5rem',
    maxWidth: '420px',
    width: '100%',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#888',
    fontSize: '0.875rem',
    marginBottom: '2rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    color: '#888',
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '1rem',
    outline: 'none',
    marginBottom: '1rem',
  },
  button: {
    width: '100%',
    padding: '0.75rem',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: '#ef4444',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  navButton: {
    padding: '1rem',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '1rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
  navTitle: {
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  navDesc: {
    color: '#888',
    fontSize: '0.875rem',
  },
  statusInput: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  },
};

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobIdInput, setJobIdInput] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setAuthenticated(true);
        sessionStorage.setItem('admin_auth', 'true');
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  // Check session storage on mount
  if (typeof window !== 'undefined' && !authenticated && sessionStorage.getItem('admin_auth')) {
    setAuthenticated(true);
  }

  if (!authenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Nexus Pipeline</h1>
          <p style={styles.subtitle}>H-1B1 Candidate Processing Admin</p>
          <form onSubmit={handleLogin}>
            <label style={styles.label}>Admin Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={{ ...styles.button, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: '500px' }}>
        <h1 style={styles.title}>Nexus Pipeline</h1>
        <p style={styles.subtitle}>H-1B1 Candidate Processing Admin</p>
        <div style={styles.nav}>
          <button style={styles.navButton} onClick={() => router.push('/admin/intake')}>
            <div style={styles.navTitle}>New Candidate</div>
            <div style={styles.navDesc}>Start a new H-1B1 pipeline for a candidate</div>
          </button>
          <div style={styles.navButton}>
            <div style={styles.navTitle}>Check Job Status</div>
            <div style={styles.navDesc}>Enter a job ID to view pipeline progress</div>
            <div style={styles.statusInput}>
              <input
                style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                value={jobIdInput}
                onChange={(e) => setJobIdInput(e.target.value)}
                placeholder="Job ID"
              />
              <button
                style={{ ...styles.button, width: 'auto', padding: '0.75rem 1.5rem' }}
                onClick={() => jobIdInput && router.push(`/admin/status/${jobIdInput}`)}
              >
                View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

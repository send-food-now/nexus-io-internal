'use client';

import { useState, useRef } from 'react';

const theme = { bg: '#0a0a0a', fg: '#ededed', accent: '#3b82f6', muted: '#888', surface: '#141414', border: '#222' };

const REGIONS = ['US — West Coast', 'US — East Coast', 'US — Midwest', 'US — South', 'Canada', 'Remote (US)', 'Remote (Global)'];
const RISK_LABELS = ['1 — Very Conservative', '2 — Conservative', '3 — Moderate-Low', '4 — Moderate-High', '5 — Aggressive', '6 — Very Aggressive'];
const DIRECTIONS = [
  { value: 'double-down', label: 'Double Down', desc: 'Stay in my current domain and go deeper' },
  { value: 'pivot', label: 'Pivot', desc: 'Explore adjacent or new spaces' },
];

function ChipSelect({ options, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onToggle(opt)} style={{
          padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: 'none', fontWeight: 500,
          background: selected.includes(opt) ? theme.accent : theme.border,
          color: selected.includes(opt) ? '#fff' : theme.fg,
        }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function FileDropzone({ file, onFile, label }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') onFile(f); };
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  return (
    <div onClick={() => inputRef.current?.click()} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
      style={{ border: `2px dashed ${dragOver ? theme.accent : theme.border}`, borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer', background: dragOver ? `${theme.accent}10` : 'transparent', transition: 'all 0.15s' }}>
      <input ref={inputRef} type="file" accept=".pdf" onChange={e => e.target.files[0] && onFile(e.target.files[0])} style={{ display: 'none' }} />
      {file ? (
        <div>
          <p style={{ color: theme.fg, fontSize: 14, marginBottom: 4 }}>{file.name}</p>
          <p style={{ color: theme.muted, fontSize: 12 }}>{(file.size / 1024).toFixed(1)} KB</p>
          <button type="button" onClick={e => { e.stopPropagation(); onFile(null); }} style={{ marginTop: 8, padding: '4px 12px', background: theme.border, color: theme.fg, border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Remove</button>
        </div>
      ) : (
        <div>
          <p style={{ color: theme.fg, fontSize: 14, marginBottom: 4 }}>{label}</p>
          <p style={{ color: theme.muted, fontSize: 12 }}>Drag & drop PDF or click to browse</p>
        </div>
      )}
    </div>
  );
}

const STEPS = ['Candidate Info', 'Search Parameters', 'Documents', 'Review'];

export default function IntakeForm({ onJobCreated }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', visaStatus: 'H-1B1 Singapore',
    linkedinUrl: '', portfolioUrl: '', githubUrl: '',
    regions: [],
    riskAppetite: 3,
    direction: 'double-down',
    resume: null, coverLetter: null,
  });

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleChip = (key, val) => setForm(prev => ({
    ...prev, [key]: prev[key].includes(val) ? prev[key].filter(v => v !== val) : [...prev[key], val],
  }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('visaStatus', form.visaStatus);
      fd.append('linkedinUrl', form.linkedinUrl);
      fd.append('portfolioUrl', form.portfolioUrl);
      fd.append('githubUrl', form.githubUrl);
      fd.append('regions', JSON.stringify(form.regions));
      fd.append('riskAppetite', String(form.riskAppetite));
      fd.append('direction', form.direction);
      if (form.resume) fd.append('resume', form.resume);
      if (form.coverLetter) fd.append('coverLetter', form.coverLetter);

      const res = await fetch('/api/submit', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.jobId) onJobCreated(data.jobId);
    } catch (e) {
      console.error('Submit failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', background: theme.bg, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const labelStyle = { color: theme.fg, fontSize: 14, marginBottom: 6, display: 'block', fontWeight: 500 };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ color: theme.fg, fontSize: 24, marginBottom: 8 }}>New Candidate</h1>
        <p style={{ color: theme.muted, fontSize: 14, marginBottom: 28 }}>H-1B1 Pipeline Intake</p>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? theme.accent : theme.border }} />
          ))}
        </div>
        <p style={{ color: theme.muted, fontSize: 12, marginBottom: 20 }}>Step {step + 1}: {STEPS[step]}</p>

        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 28 }}>
          {/* Step 1: Candidate Info */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label style={labelStyle}>Full Name</label><input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Jane Doe" style={inputStyle} /></div>
              <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="jane@example.com" style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Visa Status</label>
                <select value={form.visaStatus} onChange={e => update('visaStatus', e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
                  <option>H-1B1 Singapore</option><option>H-1B1 Chile</option><option>Other</option>
                </select>
              </div>
              <div><label style={labelStyle}>LinkedIn URL</label><input value={form.linkedinUrl} onChange={e => update('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/janedoe" style={inputStyle} /></div>
              <div><label style={labelStyle}>Portfolio URL</label><input value={form.portfolioUrl} onChange={e => update('portfolioUrl', e.target.value)} placeholder="https://janedoe.com" style={inputStyle} /></div>
              <div><label style={labelStyle}>GitHub URL</label><input value={form.githubUrl} onChange={e => update('githubUrl', e.target.value)} placeholder="https://github.com/janedoe" style={inputStyle} /></div>
            </div>
          )}

          {/* Step 2: Search Parameters */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <label style={labelStyle}>Preferred Geography</label>
                <ChipSelect options={REGIONS} selected={form.regions} onToggle={v => toggleChip('regions', v)} />
              </div>

              <div>
                <label style={labelStyle}>Risk Appetite</label>
                <p style={{ color: theme.muted, fontSize: 12, marginBottom: 12 }}>
                  Low risk (1-3) targets late-stage firms (Series C+). High risk (4-6) targets early-stage firms (Series B or earlier).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {RISK_LABELS.map((label, i) => {
                    const value = i + 1;
                    const isSelected = form.riskAppetite === value;
                    return (
                      <button key={value} type="button" onClick={() => update('riskAppetite', value)} style={{
                        padding: '10px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                        border: isSelected ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`,
                        background: isSelected ? `${theme.accent}15` : 'transparent',
                        color: isSelected ? '#fff' : theme.fg,
                        textAlign: 'left', fontWeight: isSelected ? 600 : 400,
                      }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Desired Direction</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {DIRECTIONS.map(d => {
                    const isSelected = form.direction === d.value;
                    return (
                      <button key={d.value} type="button" onClick={() => update('direction', d.value)} style={{
                        flex: 1, padding: '16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        border: isSelected ? `2px solid ${theme.accent}` : `1px solid ${theme.border}`,
                        background: isSelected ? `${theme.accent}15` : 'transparent',
                      }}>
                        <p style={{ color: isSelected ? '#fff' : theme.fg, fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>{d.label}</p>
                        <p style={{ color: theme.muted, fontSize: 12, margin: 0 }}>{d.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Documents */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div><label style={labelStyle}>Resume (PDF)</label><FileDropzone file={form.resume} onFile={f => update('resume', f)} label="Upload Resume" /></div>
              <div><label style={labelStyle}>Cover Letter (PDF)</label><FileDropzone file={form.coverLetter} onFile={f => update('coverLetter', f)} label="Upload Cover Letter" /></div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ color: theme.fg, fontSize: 16, marginBottom: 4 }}>Review Submission</h3>
              <div style={{ fontSize: 13, color: theme.fg }}>
                <p><span style={{ color: theme.muted }}>Name:</span> {form.name}</p>
                <p><span style={{ color: theme.muted }}>Email:</span> {form.email}</p>
                <p><span style={{ color: theme.muted }}>Visa:</span> {form.visaStatus}</p>
                {form.linkedinUrl && <p><span style={{ color: theme.muted }}>LinkedIn:</span> {form.linkedinUrl}</p>}
                {form.portfolioUrl && <p><span style={{ color: theme.muted }}>Portfolio:</span> {form.portfolioUrl}</p>}
                {form.githubUrl && <p><span style={{ color: theme.muted }}>GitHub:</span> {form.githubUrl}</p>}
                <p style={{ marginTop: 10 }}><span style={{ color: theme.muted }}>Regions:</span> {form.regions.join(', ') || 'None selected'}</p>
                <p><span style={{ color: theme.muted }}>Risk Appetite:</span> {RISK_LABELS[form.riskAppetite - 1]}</p>
                <p><span style={{ color: theme.muted }}>Direction:</span> {DIRECTIONS.find(d => d.value === form.direction)?.label}</p>
                <p style={{ marginTop: 10 }}><span style={{ color: theme.muted }}>Resume:</span> {form.resume?.name || 'Not uploaded'}</p>
                <p><span style={{ color: theme.muted }}>Cover Letter:</span> {form.coverLetter?.name || 'Not uploaded'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button type="button" onClick={() => setStep(s => s - 1)} disabled={step === 0}
            style={{ padding: '10px 20px', background: theme.surface, color: step === 0 ? theme.muted : theme.fg, border: `1px solid ${theme.border}`, borderRadius: 8, cursor: step === 0 ? 'default' : 'pointer', fontSize: 14 }}>
            Back
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep(s => s + 1)}
              style={{ padding: '10px 20px', background: theme.accent, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Next
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              style={{ padding: '10px 24px', background: submitting ? theme.muted : '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'default' : 'pointer', fontSize: 14, fontWeight: 600 }}>
              {submitting ? 'Submitting...' : 'Submit Candidate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

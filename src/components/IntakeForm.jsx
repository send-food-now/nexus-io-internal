'use client';

import { useState, useRef } from 'react';

const theme = { bg: '#0a0a0a', fg: '#ededed', accent: '#3b82f6', muted: '#888', surface: '#141414', border: '#222' };

const FUNDING_STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
const TEAM_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];
const INDUSTRIES = ['AI/ML', 'Fintech', 'Healthcare', 'SaaS', 'E-commerce', 'DevTools', 'Cybersecurity', 'Climate', 'EdTech', 'Biotech'];
const LOCATIONS = ['San Francisco', 'New York', 'Austin', 'Seattle', 'Boston', 'Remote', 'Los Angeles', 'Chicago'];

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

function TagInput({ tags, onAdd, onRemove, placeholder }) {
  const [value, setValue] = useState('');
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      if (!tags.includes(value.trim())) onAdd(value.trim());
      setValue('');
    }
  };
  return (
    <div>
      <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder}
        style={{ width: '100%', padding: '10px 14px', background: theme.bg, color: theme.fg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 8 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map(tag => (
          <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: theme.border, borderRadius: 14, fontSize: 12, color: theme.fg }}>
            {tag}
            <button type="button" onClick={() => onRemove(tag)} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>&times;</button>
          </span>
        ))}
      </div>
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

const STEPS = ['Candidate Info', 'Search Parameters', 'Interests', 'Documents', 'Review'];

export default function IntakeForm({ onJobCreated }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', visaStatus: 'H-1B1 Singapore',
    fundingStages: [], teamSizes: [], industries: [], locations: [],
    techStack: [], customInterests: [],
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
      fd.append('fundingStages', JSON.stringify(form.fundingStages));
      fd.append('teamSizes', JSON.stringify(form.teamSizes));
      fd.append('industries', JSON.stringify(form.industries));
      fd.append('locations', JSON.stringify(form.locations));
      fd.append('techStack', JSON.stringify(form.techStack));
      fd.append('customInterests', JSON.stringify(form.customInterests));
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
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div><label style={labelStyle}>Funding Stages</label><ChipSelect options={FUNDING_STAGES} selected={form.fundingStages} onToggle={v => toggleChip('fundingStages', v)} /></div>
              <div><label style={labelStyle}>Team Sizes</label><ChipSelect options={TEAM_SIZES} selected={form.teamSizes} onToggle={v => toggleChip('teamSizes', v)} /></div>
              <div><label style={labelStyle}>Industries</label><ChipSelect options={INDUSTRIES} selected={form.industries} onToggle={v => toggleChip('industries', v)} /></div>
              <div><label style={labelStyle}>Locations</label><ChipSelect options={LOCATIONS} selected={form.locations} onToggle={v => toggleChip('locations', v)} /></div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div><label style={labelStyle}>Tech Stack</label><TagInput tags={form.techStack} onAdd={t => update('techStack', [...form.techStack, t])} onRemove={t => update('techStack', form.techStack.filter(x => x !== t))} placeholder="Type and press Enter (e.g. React, Python)" /></div>
              <div><label style={labelStyle}>Custom Interests</label><TagInput tags={form.customInterests} onAdd={t => update('customInterests', [...form.customInterests, t])} onRemove={t => update('customInterests', form.customInterests.filter(x => x !== t))} placeholder="Type and press Enter (e.g. climate tech)" /></div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div><label style={labelStyle}>Resume (PDF)</label><FileDropzone file={form.resume} onFile={f => update('resume', f)} label="Upload Resume" /></div>
              <div><label style={labelStyle}>Cover Letter (PDF)</label><FileDropzone file={form.coverLetter} onFile={f => update('coverLetter', f)} label="Upload Cover Letter" /></div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ color: theme.fg, fontSize: 16, marginBottom: 4 }}>Review Submission</h3>
              <div style={{ fontSize: 13, color: theme.fg }}>
                <p><span style={{ color: theme.muted }}>Name:</span> {form.name}</p>
                <p><span style={{ color: theme.muted }}>Email:</span> {form.email}</p>
                <p><span style={{ color: theme.muted }}>Visa:</span> {form.visaStatus}</p>
                <p style={{ marginTop: 10 }}><span style={{ color: theme.muted }}>Funding:</span> {form.fundingStages.join(', ') || 'None selected'}</p>
                <p><span style={{ color: theme.muted }}>Team Size:</span> {form.teamSizes.join(', ') || 'None selected'}</p>
                <p><span style={{ color: theme.muted }}>Industries:</span> {form.industries.join(', ') || 'None selected'}</p>
                <p><span style={{ color: theme.muted }}>Locations:</span> {form.locations.join(', ') || 'None selected'}</p>
                <p style={{ marginTop: 10 }}><span style={{ color: theme.muted }}>Tech Stack:</span> {form.techStack.join(', ') || 'None'}</p>
                <p><span style={{ color: theme.muted }}>Interests:</span> {form.customInterests.join(', ') || 'None'}</p>
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
          {step < 4 ? (
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

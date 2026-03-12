'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

// --- Style constants ---
const colors = { bg: '#0a0a0a', surface: '#1a1a1a', border: '#2a2a2a', fg: '#e0e0e0', muted: '#888', accent: '#3b82f6', accentHover: '#2563eb', error: '#ef4444', success: '#22c55e' };

const s = {
  page: { minHeight: '100vh', padding: '2rem', maxWidth: '720px', margin: '0 auto' },
  title: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' },
  subtitle: { color: colors.muted, fontSize: '0.875rem', marginBottom: '2rem' },
  card: { background: colors.surface, borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '2rem', marginBottom: '1.5rem' },
  label: { display: 'block', fontSize: '0.875rem', color: colors.muted, marginBottom: '0.375rem', marginTop: '1rem' },
  input: { width: '100%', padding: '0.75rem 1rem', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.fg, fontSize: '1rem', outline: 'none' },
  textarea: { width: '100%', padding: '0.75rem 1rem', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.fg, fontSize: '1rem', outline: 'none', minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' },
  row: { display: 'flex', gap: '1rem' },
  flex1: { flex: 1 },
  btn: { padding: '0.75rem 1.5rem', background: colors.accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
  btnOutline: { padding: '0.75rem 1.5rem', background: 'transparent', color: colors.fg, border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
  stepBar: { display: 'flex', gap: '0.5rem', marginBottom: '2rem' },
  stepDot: (active, completed) => ({ flex: 1, height: '4px', borderRadius: '2px', background: completed ? colors.success : active ? colors.accent : colors.border }),
  chipContainer: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' },
  chip: (selected) => ({ padding: '0.5rem 1rem', borderRadius: '20px', border: `1px solid ${selected ? colors.accent : colors.border}`, background: selected ? colors.accent + '22' : 'transparent', color: selected ? colors.accent : colors.fg, cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.15s' }),
  tag: { display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '16px', background: colors.accent + '22', color: colors.accent, fontSize: '0.875rem' },
  tagRemove: { cursor: 'pointer', fontSize: '1rem', lineHeight: 1 },
  dropzone: (dragging) => ({ border: `2px dashed ${dragging ? colors.accent : colors.border}`, borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: dragging ? colors.accent + '08' : 'transparent', transition: 'all 0.15s' }),
  dropzoneLabel: { color: colors.muted, fontSize: '0.875rem' },
  fileName: { color: colors.success, fontSize: '0.875rem', marginTop: '0.5rem' },
  error: { color: colors.error, fontSize: '0.875rem', marginTop: '0.25rem' },
  reviewSection: { marginBottom: '1.5rem' },
  reviewLabel: { color: colors.muted, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' },
  reviewValue: { fontSize: '0.95rem' },
  footer: { display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' },
};

const FUNDING_STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'];
const TEAM_SIZES = ['1-10', '11-50', '51-200', '200+'];
const INDUSTRIES = ['AI/ML', 'Fintech', 'Healthcare', 'SaaS', 'Developer Tools', 'Security', 'Climate Tech', 'HR Tech', 'Data Infrastructure', 'Analytics'];
const LOCATIONS = ['San Francisco', 'New York', 'Austin', 'Seattle', 'Boston', 'Remote', 'Los Angeles', 'Chicago'];
const STEPS = ['Candidate Info', 'Search Parameters', 'Interests', 'Documents', 'Review'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function ChipSelect({ options, selected, onChange }) {
  const toggle = (opt) => {
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
  };
  return (
    <div style={s.chipContainer}>
      {options.map((opt) => (
        <button key={opt} type="button" style={s.chip(selected.includes(opt))} onClick={() => toggle(opt)}>{opt}</button>
      ))}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) onChange([...tags, input.trim()]);
      setInput('');
    }
  };
  return (
    <div>
      <div style={s.chipContainer}>
        {tags.map((tag) => (
          <span key={tag} style={s.tag}>
            {tag}
            <span style={s.tagRemove} onClick={() => onChange(tags.filter((t) => t !== tag))}>×</span>
          </span>
        ))}
      </div>
      <input
        style={{ ...s.input, marginTop: tags.length ? '0.5rem' : 0 }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
      />
    </div>
  );
}

function FileDropzone({ label, file, onFileChange, error }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  };

  const validateAndSet = (f) => {
    if (f.type !== 'application/pdf') {
      onFileChange(null, 'Only PDF files are accepted');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      onFileChange(null, 'File must be under 10MB');
      return;
    }
    onFileChange(f, null);
  };

  return (
    <div>
      <div
        style={s.dropzone(dragging)}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf" hidden onChange={(e) => e.target.files[0] && validateAndSet(e.target.files[0])} />
        <p style={s.dropzoneLabel}>{file ? '' : label}</p>
        {file && <p style={s.fileName}>{file.name}</p>}
      </div>
      {error && <p style={s.error}>{error}</p>}
    </div>
  );
}

export default function IntakeForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Step 1: Candidate Info
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [visaStatus, setVisaStatus] = useState('');
  const [targetStartDate, setTargetStartDate] = useState('');

  // Step 2: Search Params
  const [fundingStages, setFundingStages] = useState([]);
  const [teamSizes, setTeamSizes] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [locations, setLocations] = useState([]);

  // Step 3: Interests
  const [techStack, setTechStack] = useState([]);
  const [customInterests, setCustomInterests] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Step 4: Documents
  const [resume, setResume] = useState(null);
  const [resumeError, setResumeError] = useState('');
  const [coverLetter, setCoverLetter] = useState(null);
  const [coverLetterError, setCoverLetterError] = useState('');

  const canNext = () => {
    if (step === 0) return candidateName && candidateEmail;
    if (step === 3) return resume && coverLetter;
    return true;
  };

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');

    const formData = new FormData();
    formData.append('candidateName', candidateName);
    formData.append('candidateEmail', candidateEmail);
    formData.append('phone', phone);
    formData.append('visaStatus', visaStatus);
    formData.append('targetStartDate', targetStartDate);
    formData.append('searchParams', JSON.stringify({ fundingStages, teamSizes, industries, locations }));
    formData.append('techStack', JSON.stringify(techStack));
    formData.append('customInterests', JSON.stringify(customInterests));
    formData.append('additionalNotes', additionalNotes);
    formData.append('resume', resume);
    formData.append('coverLetter', coverLetter);

    try {
      const res = await fetch('/api/submit', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }
      const { jobId } = await res.json();
      router.push(`/admin/status/${jobId}`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>New Candidate</h1>
      <p style={s.subtitle}>Step {step + 1} of 5 — {STEPS[step]}</p>

      {/* Step indicator bar */}
      <div style={s.stepBar}>
        {STEPS.map((_, i) => (
          <div key={i} style={s.stepDot(i === step, i < step)} />
        ))}
      </div>

      {/* Step 1: Candidate Info */}
      {step === 0 && (
        <div style={s.card}>
          <label style={s.label}>Full Name *</label>
          <input style={s.input} value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Jane Doe" />
          <label style={s.label}>Email *</label>
          <input style={s.input} value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="jane@example.com" type="email" />
          <div style={s.row}>
            <div style={s.flex1}>
              <label style={s.label}>Phone</label>
              <input style={s.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
            <div style={s.flex1}>
              <label style={s.label}>Current Visa Status</label>
              <input style={s.input} value={visaStatus} onChange={(e) => setVisaStatus(e.target.value)} placeholder="e.g. Singapore citizen" />
            </div>
          </div>
          <label style={s.label}>Target Start Date</label>
          <input style={s.input} value={targetStartDate} onChange={(e) => setTargetStartDate(e.target.value)} type="date" />
        </div>
      )}

      {/* Step 2: Search Parameters */}
      {step === 1 && (
        <div style={s.card}>
          <label style={s.label}>Funding Stages</label>
          <ChipSelect options={FUNDING_STAGES} selected={fundingStages} onChange={setFundingStages} />
          <label style={s.label}>Team Sizes</label>
          <ChipSelect options={TEAM_SIZES} selected={teamSizes} onChange={setTeamSizes} />
          <label style={s.label}>Industries</label>
          <ChipSelect options={INDUSTRIES} selected={industries} onChange={setIndustries} />
          <label style={s.label}>Locations</label>
          <ChipSelect options={LOCATIONS} selected={locations} onChange={setLocations} />
        </div>
      )}

      {/* Step 3: Interests */}
      {step === 2 && (
        <div style={s.card}>
          <label style={s.label}>Tech Stack Preferences</label>
          <TagInput tags={techStack} onChange={setTechStack} placeholder="Type and press Enter (e.g. React, Python, Kubernetes)" />
          <label style={s.label}>Custom Interests</label>
          <TagInput tags={customInterests} onChange={setCustomInterests} placeholder="Type and press Enter (e.g. remote-first, climate impact)" />
          <label style={s.label}>Additional Notes</label>
          <textarea style={s.textarea} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} placeholder="What are you looking for in your next role?" />
        </div>
      )}

      {/* Step 4: Documents */}
      {step === 3 && (
        <div style={s.card}>
          <label style={s.label}>Resume (PDF) *</label>
          <FileDropzone
            label="Drag & drop resume PDF here, or click to browse"
            file={resume}
            onFileChange={(f, err) => { setResume(f); setResumeError(err || ''); }}
            error={resumeError}
          />
          <label style={{ ...s.label, marginTop: '1.5rem' }}>Cover Letter (PDF) *</label>
          <FileDropzone
            label="Drag & drop cover letter PDF here, or click to browse"
            file={coverLetter}
            onFileChange={(f, err) => { setCoverLetter(f); setCoverLetterError(err || ''); }}
            error={coverLetterError}
          />
        </div>
      )}

      {/* Step 5: Review */}
      {step === 4 && (
        <div style={s.card}>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Candidate</div>
            <div style={s.reviewValue}>{candidateName} — {candidateEmail}</div>
            {phone && <div style={{ ...s.reviewValue, color: colors.muted }}>{phone}</div>}
            {visaStatus && <div style={{ ...s.reviewValue, color: colors.muted }}>{visaStatus}</div>}
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Search Parameters</div>
            <div style={s.reviewValue}>
              {[
                fundingStages.length && `Funding: ${fundingStages.join(', ')}`,
                teamSizes.length && `Size: ${teamSizes.join(', ')}`,
                industries.length && `Industries: ${industries.join(', ')}`,
                locations.length && `Locations: ${locations.join(', ')}`,
              ].filter(Boolean).join(' • ') || 'No preferences set'}
            </div>
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Interests</div>
            <div style={s.reviewValue}>
              {[
                techStack.length && `Tech: ${techStack.join(', ')}`,
                customInterests.length && `Interests: ${customInterests.join(', ')}`,
              ].filter(Boolean).join(' • ') || 'None'}
            </div>
            {additionalNotes && <div style={{ ...s.reviewValue, color: colors.muted, marginTop: '0.25rem' }}>{additionalNotes}</div>}
          </div>
          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Documents</div>
            <div style={s.reviewValue}>Resume: {resume?.name}</div>
            <div style={s.reviewValue}>Cover Letter: {coverLetter?.name}</div>
          </div>
          {submitError && <p style={s.error}>{submitError}</p>}
        </div>
      )}

      {/* Navigation footer */}
      <div style={s.footer}>
        <button style={s.btnOutline} onClick={() => step > 0 ? setStep(step - 1) : router.push('/admin')} >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < 4 ? (
          <button style={{ ...s.btn, opacity: canNext() ? 1 : 0.5 }} disabled={!canNext()} onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button style={{ ...s.btn, opacity: submitting ? 0.7 : 1 }} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting...' : 'Submit & Start Pipeline'}
          </button>
        )}
      </div>
    </div>
  );
}

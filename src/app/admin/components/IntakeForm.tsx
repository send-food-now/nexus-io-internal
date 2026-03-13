"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const FUNDING_STAGES = ["pre-seed", "seed", "series-a", "series-b", "series-c", "growth", "public"];
const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const INDUSTRIES = [
  "AI/ML", "SaaS", "Fintech", "Healthcare", "Developer Tools",
  "Cybersecurity", "E-commerce", "EdTech", "Climate", "Biotech",
];
const LOCATIONS = [
  "San Francisco", "New York", "Austin", "Seattle", "Boston",
  "Los Angeles", "Chicago", "Remote", "International",
];

const s = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#e5e5e5",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "40px 20px",
  },
  container: {
    maxWidth: "680px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "32px",
  },
  title: { fontSize: "28px", fontWeight: 700, color: "#fff", marginBottom: "4px" },
  step: { fontSize: "13px", color: "#888" },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: "12px",
    padding: "32px",
    border: "1px solid #333",
    marginBottom: "24px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#ccc",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    backgroundColor: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#e5e5e5",
    fontSize: "14px",
    outline: "none",
    marginBottom: "16px",
    boxSizing: "border-box" as const,
  },
  chipGroup: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    marginBottom: "16px",
  },
  chip: (active: boolean) => ({
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    cursor: "pointer",
    border: active ? "1px solid #2563eb" : "1px solid #444",
    backgroundColor: active ? "#1e3a5f" : "#1a1a1a",
    color: active ? "#93c5fd" : "#aaa",
    transition: "all 0.15s",
  }),
  tagInput: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    padding: "8px",
    backgroundColor: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "8px",
    marginBottom: "16px",
    minHeight: "42px",
    alignItems: "center" as const,
  },
  tag: {
    display: "flex",
    alignItems: "center" as const,
    gap: "4px",
    padding: "4px 10px",
    borderRadius: "14px",
    backgroundColor: "#1e3a5f",
    color: "#93c5fd",
    fontSize: "13px",
  },
  tagClose: {
    cursor: "pointer",
    marginLeft: "4px",
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: 1,
  },
  tagInputField: {
    flex: 1,
    minWidth: "120px",
    backgroundColor: "transparent",
    border: "none",
    color: "#e5e5e5",
    fontSize: "14px",
    outline: "none",
  },
  dropzone: (isDragging: boolean) => ({
    border: `2px dashed ${isDragging ? "#2563eb" : "#444"}`,
    borderRadius: "12px",
    padding: "32px",
    textAlign: "center" as const,
    cursor: "pointer",
    backgroundColor: isDragging ? "#0f172a" : "#0a0a0a",
    marginBottom: "16px",
    transition: "all 0.2s",
  }),
  dropzoneText: { color: "#888", fontSize: "14px" },
  fileName: {
    fontSize: "13px",
    color: "#93c5fd",
    marginTop: "8px",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  },
  btnSecondary: {
    padding: "10px 24px",
    backgroundColor: "#1a1a1a",
    color: "#ccc",
    border: "1px solid #444",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "10px 24px",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  reviewSection: { marginBottom: "16px" },
  reviewLabel: { fontSize: "12px", color: "#888", textTransform: "uppercase" as const, marginBottom: "4px" },
  reviewValue: { fontSize: "14px", color: "#e5e5e5", marginBottom: "4px" },
  error: { color: "#ef4444", fontSize: "13px", marginBottom: "8px" },
};

type FormData = {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  fundingStages: string[];
  teamSizes: string[];
  industries: string[];
  locations: string[];
  techStack: string[];
  customInterests: string[];
  resume: File | null;
  coverLetter: File | null;
  sheetId: string;
  adminEmail: string;
};

function ChipSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt]
    );
  };

  return (
    <div>
      <label style={s.label}>{label}</label>
      <div style={s.chipGroup}>
        {options.map((opt) => (
          <span
            key={opt}
            style={s.chip(selected.includes(opt))}
            onClick={() => toggle(opt)}
          >
            {opt}
          </span>
        ))}
      </div>
    </div>
  );
}

function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput("");
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div>
      <label style={s.label}>{label}</label>
      <div style={s.tagInput}>
        {tags.map((tag) => (
          <span key={tag} style={s.tag}>
            {tag}
            <span style={s.tagClose} onClick={() => onChange(tags.filter((t) => t !== tag))}>
              x
            </span>
          </span>
        ))}
        <input
          style={s.tagInputField}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
        />
      </div>
    </div>
  );
}

function FileDropzone({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f?.type === "application/pdf") onFile(f);
    },
    [onFile]
  );

  return (
    <div>
      <label style={s.label}>{label}</label>
      <div
        style={s.dropzone(isDragging)}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
        <p style={s.dropzoneText}>
          {file ? "" : "Drop PDF here or click to upload"}
        </p>
        {file && <p style={s.fileName}>{file.name}</p>}
      </div>
    </div>
  );
}

export default function IntakeForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    linkedinUrl: "",
    fundingStages: [],
    teamSizes: [],
    industries: [],
    locations: [],
    techStack: [],
    customInterests: [],
    resume: null,
    coverLetter: null,
    sheetId: "",
    adminEmail: "",
  });

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.email.trim();
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("phone", form.phone);
      fd.append("linkedinUrl", form.linkedinUrl);
      fd.append("sheetId", form.sheetId);
      fd.append("adminEmail", form.adminEmail);
      fd.append("fundingStages", JSON.stringify(form.fundingStages));
      fd.append("teamSizes", JSON.stringify(form.teamSizes));
      fd.append("industries", JSON.stringify(form.industries));
      fd.append("locations", JSON.stringify(form.locations));
      fd.append("techStack", JSON.stringify(form.techStack));
      fd.append("customInterests", JSON.stringify(form.customInterests));
      if (form.resume) fd.append("resume", form.resume);
      if (form.coverLetter) fd.append("coverLetter", form.coverLetter);

      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Submission failed");

      router.push(`/admin/status/${data.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  };

  const steps = [
    // Step 0: Candidate Info
    <div key="info">
      <label style={s.label}>Full Name *</label>
      <input style={s.input} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Jane Doe" />
      <label style={s.label}>Email *</label>
      <input style={s.input} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="jane@example.com" type="email" />
      <label style={s.label}>Phone</label>
      <input style={s.input} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 555-0100" />
      <label style={s.label}>LinkedIn URL</label>
      <input style={s.input} value={form.linkedinUrl} onChange={(e) => update("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/janedoe" />
    </div>,

    // Step 1: Search Parameters
    <div key="search">
      <ChipSelect label="Funding Stages" options={FUNDING_STAGES} selected={form.fundingStages} onChange={(v) => update("fundingStages", v)} />
      <ChipSelect label="Team Size" options={TEAM_SIZES} selected={form.teamSizes} onChange={(v) => update("teamSizes", v)} />
      <ChipSelect label="Industries" options={INDUSTRIES} selected={form.industries} onChange={(v) => update("industries", v)} />
      <ChipSelect label="Locations" options={LOCATIONS} selected={form.locations} onChange={(v) => update("locations", v)} />
    </div>,

    // Step 2: Specific Interests
    <div key="interests">
      <TagInput label="Tech Stack" tags={form.techStack} onChange={(v) => update("techStack", v)} placeholder="Type and press Enter (e.g. React, Python, AWS)" />
      <TagInput label="Custom Interests" tags={form.customInterests} onChange={(v) => update("customInterests", v)} placeholder="Type and press Enter (e.g. remote-first, climate tech)" />
    </div>,

    // Step 3: Documents
    <div key="docs">
      <FileDropzone label="Resume (PDF)" file={form.resume} onFile={(f) => update("resume", f)} />
      <FileDropzone label="Cover Letter (PDF)" file={form.coverLetter} onFile={(f) => update("coverLetter", f)} />
      <label style={s.label}>Google Sheet ID (for results output)</label>
      <input style={s.input} value={form.sheetId} onChange={(e) => update("sheetId", e.target.value)} placeholder="spreadsheet ID from Google Sheets URL" />
      <label style={s.label}>Admin Notification Email</label>
      <input style={s.input} value={form.adminEmail} onChange={(e) => update("adminEmail", e.target.value)} placeholder="admin@example.com" type="email" />
    </div>,

    // Step 4: Review
    <div key="review">
      <div style={s.reviewSection}>
        <div style={s.reviewLabel}>Candidate</div>
        <div style={s.reviewValue}>{form.name} ({form.email})</div>
        {form.phone && <div style={s.reviewValue}>Phone: {form.phone}</div>}
        {form.linkedinUrl && <div style={s.reviewValue}>LinkedIn: {form.linkedinUrl}</div>}
      </div>
      <div style={s.reviewSection}>
        <div style={s.reviewLabel}>Search Parameters</div>
        {form.fundingStages.length > 0 && <div style={s.reviewValue}>Stages: {form.fundingStages.join(", ")}</div>}
        {form.teamSizes.length > 0 && <div style={s.reviewValue}>Team sizes: {form.teamSizes.join(", ")}</div>}
        {form.industries.length > 0 && <div style={s.reviewValue}>Industries: {form.industries.join(", ")}</div>}
        {form.locations.length > 0 && <div style={s.reviewValue}>Locations: {form.locations.join(", ")}</div>}
      </div>
      <div style={s.reviewSection}>
        <div style={s.reviewLabel}>Interests</div>
        {form.techStack.length > 0 && <div style={s.reviewValue}>Tech: {form.techStack.join(", ")}</div>}
        {form.customInterests.length > 0 && <div style={s.reviewValue}>Custom: {form.customInterests.join(", ")}</div>}
      </div>
      <div style={s.reviewSection}>
        <div style={s.reviewLabel}>Documents</div>
        <div style={s.reviewValue}>Resume: {form.resume ? form.resume.name : "Not uploaded"}</div>
        <div style={s.reviewValue}>Cover Letter: {form.coverLetter ? form.coverLetter.name : "Not uploaded"}</div>
      </div>
      {form.sheetId && (
        <div style={s.reviewSection}>
          <div style={s.reviewLabel}>Output</div>
          <div style={s.reviewValue}>Sheet ID: {form.sheetId}</div>
        </div>
      )}
    </div>,
  ];

  const stepNames = ["Candidate Info", "Search Parameters", "Interests", "Documents", "Review & Submit"];

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <h1 style={s.title}>H-1B1 Pipeline Intake</h1>
          <p style={s.step}>Step {step + 1} of {steps.length}: {stepNames[step]}</p>
        </div>

        <div style={s.card}>
          {steps[step]}
        </div>

        {error && <p style={s.error}>{error}</p>}

        <div style={s.buttonRow}>
          {step > 0 && (
            <button style={s.btnSecondary} onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              style={{
                ...s.btnPrimary,
                opacity: canNext() ? 1 : 0.5,
                cursor: canNext() ? "pointer" : "not-allowed",
              }}
              onClick={() => canNext() && setStep(step + 1)}
              disabled={!canNext()}
            >
              Next
            </button>
          ) : (
            <button
              style={{ ...s.btnPrimary, opacity: submitting ? 0.5 : 1 }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Pipeline"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

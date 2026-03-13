"use client";

import { useState, useEffect } from "react";
import type { JobStatus as JobStatusType, StageName, StageStatus } from "@/lib/types";
import { PIPELINE_STAGES } from "@/lib/types";

const STAGE_LABELS: Record<StageName, string> = {
  profile: "Profile Candidate",
  discover: "Discover Startups",
  categorize: "Categorize & Score",
  enrich: "Enrich Data",
  outreach: "Generate Outreach",
  sheets: "Write to Sheets",
  notify: "Send Notification",
};

const STATUS_COLORS: Record<StageStatus, string> = {
  pending: "#555",
  running: "#f59e0b",
  completed: "#22c55e",
  failed: "#ef4444",
};

const STATUS_ICONS: Record<StageStatus, string> = {
  pending: "\u25CB",
  running: "\u25D4",
  completed: "\u2713",
  failed: "\u2717",
};

const s = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0a",
    color: "#e5e5e5",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "40px 20px",
  },
  inner: { maxWidth: "600px", margin: "0 auto" },
  title: { fontSize: "24px", fontWeight: 700, color: "#fff", marginBottom: "4px" },
  subtitle: { fontSize: "13px", color: "#888", marginBottom: "32px" },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid #333",
    marginBottom: "24px",
  },
  stageRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 0",
    borderBottom: "1px solid #222",
  },
  stageIcon: (status: StageStatus) => ({
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    backgroundColor: `${STATUS_COLORS[status]}22`,
    color: STATUS_COLORS[status],
    border: `1px solid ${STATUS_COLORS[status]}`,
    flexShrink: 0,
  }),
  stageName: { flex: 1, fontSize: "14px", color: "#e5e5e5" },
  stageStatus: (status: StageStatus) => ({
    fontSize: "12px",
    color: STATUS_COLORS[status],
    textTransform: "uppercase" as const,
    fontWeight: 600,
  }),
  resultBox: {
    backgroundColor: "#0f2e1a",
    border: "1px solid #22c55e44",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "16px",
  },
  errorBox: {
    backgroundColor: "#2e0f0f",
    border: "1px solid #ef444444",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "16px",
  },
  link: { color: "#60a5fa", textDecoration: "underline" },
  pulse: {
    animation: "pulse 2s infinite",
  },
};

export default function JobStatusView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobStatusType | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/job-status?jobId=${jobId}`);
        if (!res.ok) {
          setError("Job not found");
          return;
        }
        const data = await res.json();
        setJob(data);

        // Stop polling when terminal
        if (data.status === "completed" || data.status === "failed") return;
      } catch {
        setError("Failed to fetch job status");
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  if (error) {
    return (
      <div style={s.container}>
        <div style={s.inner}>
          <h1 style={s.title}>Pipeline Status</h1>
          <div style={s.errorBox}>
            <p style={{ color: "#ef4444" }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={s.container}>
        <div style={s.inner}>
          <h1 style={s.title}>Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.inner}>
        <h1 style={s.title}>Pipeline Status</h1>
        <p style={s.subtitle}>Job: {jobId}</p>

        <div style={s.card}>
          {PIPELINE_STAGES.map((stage) => {
            const status = job.stages[stage];
            return (
              <div key={stage} style={s.stageRow}>
                <div style={s.stageIcon(status)}>{STATUS_ICONS[status]}</div>
                <span style={s.stageName}>{STAGE_LABELS[stage]}</span>
                <span style={s.stageStatus(status)}>{status}</span>
              </div>
            );
          })}
        </div>

        {job.status === "completed" && job.result && (
          <div style={s.resultBox}>
            <p style={{ color: "#22c55e", fontWeight: 600, marginBottom: "8px" }}>
              Pipeline Complete
            </p>
            <p style={{ color: "#a3e4b1", fontSize: "14px" }}>
              Processed {String(job.result.startupsProcessed || 0)} startups,
              wrote {String(job.result.rowsWritten || 0)} rows.
            </p>
            {typeof job.result.sheetUrl === "string" && (
              <p style={{ marginTop: "8px" }}>
                <a
                  href={String(job.result.sheetUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.link}
                >
                  Open Google Sheet
                </a>
              </p>
            )}
          </div>
        )}

        {job.status === "failed" && job.error && (
          <div style={s.errorBox}>
            <p style={{ color: "#ef4444", fontWeight: 600, marginBottom: "8px" }}>
              Pipeline Failed
            </p>
            <p style={{ color: "#fca5a5", fontSize: "14px" }}>{job.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

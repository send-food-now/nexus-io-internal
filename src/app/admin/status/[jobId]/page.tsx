"use client";

import { useParams } from "next/navigation";
import JobStatusView from "../../components/JobStatus";

export default function StatusPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  return <JobStatusView jobId={jobId} />;
}

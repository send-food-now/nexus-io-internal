import { EventSchemas, Inngest } from "inngest";
import type { PipelineEvents } from "@/lib/types";
import { updateStage, setResult, setError } from "@/lib/job-store";
import { profileCandidate } from "./functions/profile-candidate";
import { discoverStartups } from "./functions/discover-startups";
import { categorize } from "./functions/categorize";
import { enrichStartups } from "./functions/enrich-startups";
import { generateOutreach } from "./functions/generate-outreach";
import { writePipelineToSheets } from "./functions/write-sheets";
import { notifyAdmin } from "./functions/notify";

export const inngest = new Inngest({
  id: "nexus-pipeline",
  schemas: new EventSchemas().fromRecord<PipelineEvents>(),
});

export const pipelineRun = inngest.createFunction(
  { id: "nexus-pipeline-run", name: "Nexus H-1B1 Pipeline" },
  { event: "pipeline/run" },
  async ({ event, step }) => {
    const { jobId, candidate, searchParams, sheetId, adminEmail } = event.data;
    const startTime = Date.now();

    try {
      // Stage 1: Profile candidate (resume + cover letter analysis)
      updateStage(jobId, "profile", "running");
      const profiledCandidate = await step.run("profile-candidate", async () => {
        return profileCandidate(candidate);
      });
      updateStage(jobId, "profile", "completed");

      // Stage 2: Discover matching startups
      updateStage(jobId, "discover", "running");
      const startups = await step.run("discover-startups", async () => {
        return discoverStartups(profiledCandidate, searchParams);
      });
      updateStage(jobId, "discover", "completed");

      // Stage 3: Categorize and score startups
      updateStage(jobId, "categorize", "running");
      const categorized = await step.run("categorize-startups", async () => {
        return categorize(profiledCandidate, startups);
      });
      updateStage(jobId, "categorize", "completed");

      // Stage 4: Enrich startups with contacts, news, career pages
      updateStage(jobId, "enrich", "running");
      const enriched = await step.run("enrich-startups", async () => {
        return enrichStartups(categorized);
      });
      updateStage(jobId, "enrich", "completed");

      // Stage 5: Generate personalized outreach emails
      updateStage(jobId, "outreach", "running");
      const drafts = await step.run("generate-outreach", async () => {
        return generateOutreach(profiledCandidate, enriched);
      });
      updateStage(jobId, "outreach", "completed");

      // Stage 6: Write results to Google Sheets (3 tabs)
      updateStage(jobId, "sheets", "running");
      const sheetsResult = await step.run("write-to-sheets", async () => {
        return writePipelineToSheets(sheetId, enriched, drafts, candidate.email);
      });
      updateStage(jobId, "sheets", "completed");

      // Stage 7: Notify admin via email
      updateStage(jobId, "notify", "running");
      await step.run("notify-admin", async () => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        return notifyAdmin(adminEmail, sheetsResult.sheetUrl, {
          exact: enriched.filter((s) => s.category === "exact").length,
          recommended: enriched.filter((s) => s.category === "recommended").length,
          luck: enriched.filter((s) => s.category === "luck").length,
          duration: `${minutes}m ${seconds}s`,
        });
      });
      updateStage(jobId, "notify", "completed");

      const result = {
        success: true,
        startupsProcessed: enriched.length,
        rowsWritten: sheetsResult.rowsWritten,
        sheetUrl: sheetsResult.sheetUrl,
      };

      setResult(jobId, result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(jobId, message);
      throw err;
    }
  }
);

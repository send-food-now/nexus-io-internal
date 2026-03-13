import { EventSchemas, Inngest } from "inngest";
import type { PipelineEvents } from "@/lib/types";
import { researchCompanies } from "./functions/research-company";
import { enrichContacts } from "./functions/enrich-contacts";
import { generateOutreach } from "./functions/generate-outreach";
import { writePipelineToSheets } from "./functions/write-to-sheets";

export const inngest = new Inngest({
  id: "nexus-pipeline",
  schemas: new EventSchemas().fromRecord<PipelineEvents>(),
});

export const pipelineRun = inngest.createFunction(
  { id: "nexus-pipeline-run", name: "Nexus Pipeline" },
  { event: "pipeline/run" },
  async ({ event, step }) => {
    const { companies, sheetId } = event.data;

    // Step 1: Research each company
    const profiles = await step.run("research-companies", async () => {
      return researchCompanies(companies);
    });

    // Step 2: Enrich contacts for each company
    const contacts = await step.run("enrich-contacts", async () => {
      return enrichContacts(profiles);
    });

    // Step 3: Generate personalized outreach emails
    const drafts = await step.run("generate-outreach", async () => {
      return generateOutreach(profiles, contacts);
    });

    // Step 4: Write everything to Google Sheets
    const result = await step.run("write-to-sheets", async () => {
      return writePipelineToSheets(sheetId, profiles, contacts, drafts);
    });

    return { success: true, companiesProcessed: profiles.length, rowsWritten: result.rowsWritten };
  }
);

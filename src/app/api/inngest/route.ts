import { serve } from "inngest/next";
import { inngest, pipelineRun } from "@/lib/inngest/client";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pipelineRun],
});

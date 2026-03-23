import { Inngest } from 'inngest';
import { updateJobStage } from './job-store';

export const inngest = new Inngest({ id: 'nexus-pipeline' });

export const pipelineFunction = inngest.createFunction(
  { id: 'candidate-pipeline', name: 'Candidate Pipeline' },
  { event: 'candidate/submitted' },
  async ({ event, step }) => {
    const { jobId, candidateData, resumeText, coverLetterText, searchParams } = event.data;

    // Phase 2.0: Analyze Candidate
    const candidateProfile = await step.run('analyze-candidate', async () => {
      await updateJobStage(jobId, 'analyze', 'running');
      try {
        const { analyzeCandidate } = await import('./pipeline/analyze-candidate');
        const result = await analyzeCandidate({
          resumeText,
          coverLetterText,
          linkedinUrl: searchParams.linkedinUrl,
          portfolioUrl: searchParams.portfolioUrl,
          githubUrl: searchParams.githubUrl,
        });
        await updateJobStage(jobId, 'analyze', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'analyze', 'error', null, error.message);
        throw error;
      }
    });

    // Phase 2.1: Identify Opportunities
    const opportunities = await step.run('identify-opportunities', async () => {
      await updateJobStage(jobId, 'opportunities', 'running');
      try {
        const { identifyOpportunities } = await import('./pipeline/identify-opportunities');
        const result = await identifyOpportunities({ candidateProfile, searchParams });
        await updateJobStage(jobId, 'opportunities', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'opportunities', 'error', null, error.message);
        throw error;
      }
    });

    // Phase 3.0: Build Target List
    const startups = await step.run('build-target-list', async () => {
      await updateJobStage(jobId, 'targets', 'running');
      try {
        const { buildTargetList } = await import('./pipeline/build-target-list');
        const result = await buildTargetList({ candidateProfile, opportunities, searchParams });
        await updateJobStage(jobId, 'targets', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'targets', 'error', null, error.message);
        throw error;
      }
    });

    // Phase 3.1: Populate Context
    const enrichedStartups = await step.run('populate-context', async () => {
      await updateJobStage(jobId, 'context', 'running');
      try {
        const { populateContext } = await import('./pipeline/populate-context');
        const result = await populateContext({ startups, candidateProfile, opportunities });
        await updateJobStage(jobId, 'context', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'context', 'error', null, error.message);
        throw error;
      }
    });

    // Phase 4.0: Write Sheets
    const sheetsResult = await step.run('write-sheets', async () => {
      await updateJobStage(jobId, 'sheets', 'running');
      try {
        const { writeSheets } = await import('./pipeline/write-sheets');
        const result = await writeSheets({ startups: enrichedStartups, candidateData });
        await updateJobStage(jobId, 'sheets', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'sheets', 'error', null, error.message);
        throw error;
      }
    });

    // Phase 4.1: Notify (optional)
    const notifyResult = await step.run('notify', async () => {
      await updateJobStage(jobId, 'notify', 'running');
      try {
        const { notifyAdmin } = await import('./pipeline/notify');
        const result = await notifyAdmin({ jobId, candidateData, spreadsheetUrl: sheetsResult.spreadsheetUrl });
        await updateJobStage(jobId, 'notify', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'notify', 'error', null, error.message);
        throw error;
      }
    });

    return { candidateProfile, opportunities, sheetsResult, notifyResult };
  }
);

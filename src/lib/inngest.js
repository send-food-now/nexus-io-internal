import { Inngest } from 'inngest';
import { updateJobStage } from './job-store';

export const inngest = new Inngest({ id: 'nexus-pipeline' });

export const pipelineFunction = inngest.createFunction(
  { id: 'candidate-pipeline', name: 'Candidate Pipeline' },
  { event: 'candidate/submitted' },
  async ({ event, step }) => {
    const { jobId, candidateData, resumeText, coverLetterText, searchParams } = event.data;

    // Stage 1: Profile
    const candidateProfile = await step.run('profile', async () => {
      await updateJobStage(jobId, 'profile', 'running');
      try {
        const { profileCandidate } = await import('./pipeline/profile-candidate');
        const result = await profileCandidate({ resumeText, coverLetterText });
        await updateJobStage(jobId, 'profile', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'profile', 'error', null, error.message);
        throw error;
      }
    });

    // Stage 2: Discover
    const startups = await step.run('discover', async () => {
      await updateJobStage(jobId, 'discover', 'running');
      try {
        const { discoverStartups } = await import('./pipeline/discover-startups');
        const result = await discoverStartups({ candidateProfile, searchParams });
        await updateJobStage(jobId, 'discover', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'discover', 'error', null, error.message);
        throw error;
      }
    });

    // Stage 3: Categorize
    const categorizedStartups = await step.run('categorize', async () => {
      await updateJobStage(jobId, 'categorize', 'running');
      try {
        const { categorizeStartups } = await import('./pipeline/categorize-startups');
        const result = await categorizeStartups({ startups, candidateProfile });
        await updateJobStage(jobId, 'categorize', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'categorize', 'error', null, error.message);
        throw error;
      }
    });

    // Stage 4: Enrich
    const enrichedStartups = await step.run('enrich', async () => {
      await updateJobStage(jobId, 'enrich', 'running');
      try {
        const { enrichStartups } = await import('./pipeline/enrich-startups');
        const result = await enrichStartups({ categorizedStartups });
        await updateJobStage(jobId, 'enrich', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'enrich', 'error', null, error.message);
        throw error;
      }
    });

    // Stage 5: Outreach
    const outreachStartups = await step.run('outreach', async () => {
      await updateJobStage(jobId, 'outreach', 'running');
      try {
        const { generateOutreach } = await import('./pipeline/generate-outreach');
        const result = await generateOutreach({ categorizedStartups: enrichedStartups, candidateProfile });
        await updateJobStage(jobId, 'outreach', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'outreach', 'error', null, error.message);
        throw error;
      }
    });

    // Stage 6: Sheets
    const sheetsResult = await step.run('sheets', async () => {
      await updateJobStage(jobId, 'sheets', 'running');
      try {
        const { writeSheets } = await import('./pipeline/write-sheets');
        const result = await writeSheets({ categorizedStartups: outreachStartups, candidateData });
        await updateJobStage(jobId, 'sheets', 'completed', result);
        return result;
      } catch (error) {
        await updateJobStage(jobId, 'sheets', 'error', null, error.message);
        throw error;
      }
    });

    // Stage 7: Notify
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

    return { candidateProfile, sheetsResult, notifyResult };
  }
);

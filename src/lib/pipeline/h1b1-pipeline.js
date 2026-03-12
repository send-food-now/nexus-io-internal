import { inngest } from '@/lib/inngest-client';
import { updateStage } from '@/lib/job-store';
import { profileCandidate } from './profile-candidate';
import { discoverStartups } from './discover-startups';
import { categorizeStartups } from './categorize';
import { enrichStartups } from './enrich-startups';
import { generateOutreach } from './generate-outreach';
import { writeSheets } from './write-sheets';
import { notifyAdmin } from './notify';

export const h1b1Pipeline = inngest.createFunction(
  { id: 'h1b1-pipeline', name: 'H-1B1 Candidate Pipeline', retries: 1 },
  { event: 'h1b1/application.submitted' },
  async ({ event, step }) => {
    const {
      jobId,
      candidateName,
      candidateEmail,
      searchParams,
      techStack,
      customInterests,
    } = event.data;

    // Merge tech stack into search params for convenience
    const fullSearchParams = { ...searchParams, techStack, customInterests };

    // Stage 1: Profile candidate
    const profile = await step.run('profile-candidate', async () => {
      await updateStage(jobId, 'profile', 'running');
      try {
        const result = await profileCandidate(jobId);
        await updateStage(jobId, 'profile', 'completed', {
          skills: result.technicalProfile.skills?.length || 0,
          seniority: result.technicalProfile.seniority,
        });
        return result;
      } catch (err) {
        await updateStage(jobId, 'profile', 'failed', null, err.message);
        throw err;
      }
    });

    // Stage 2: Discover startups
    const rawStartups = await step.run('discover-startups', async () => {
      await updateStage(jobId, 'discover', 'running');
      try {
        const result = await discoverStartups(profile.technicalProfile, fullSearchParams);
        await updateStage(jobId, 'discover', 'completed', {
          count: result.length,
        });
        return result;
      } catch (err) {
        await updateStage(jobId, 'discover', 'failed', null, err.message);
        throw err;
      }
    });

    // Stage 3: Categorize startups
    const categorized = await step.run('categorize', async () => {
      await updateStage(jobId, 'categorize', 'running');
      try {
        const result = await categorizeStartups(rawStartups, profile.technicalProfile, fullSearchParams);
        await updateStage(jobId, 'categorize', 'completed', {
          exact: result.exact.length,
          recommended: result.recommended.length,
          luck: result.luck.length,
        });
        return result;
      } catch (err) {
        await updateStage(jobId, 'categorize', 'failed', null, err.message);
        throw err;
      }
    });

    // Stage 4: Enrich startups
    const enriched = await step.run('enrich-startups', async () => {
      await updateStage(jobId, 'enrich', 'running');
      try {
        const result = await enrichStartups(categorized);
        const total = result.exact.length + result.recommended.length + result.luck.length;
        await updateStage(jobId, 'enrich', 'completed', { enriched: total });
        return result;
      } catch (err) {
        await updateStage(jobId, 'enrich', 'failed', null, err.message);
        throw err;
      }
    });

    // Stage 5: Generate outreach
    const withOutreach = await step.run('generate-outreach', async () => {
      await updateStage(jobId, 'outreach', 'running');
      try {
        const result = await generateOutreach(enriched, profile.technicalProfile, profile.narrativeProfile);
        const total = result.exact.length + result.recommended.length + result.luck.length;
        await updateStage(jobId, 'outreach', 'completed', { generated: total });
        return result;
      } catch (err) {
        await updateStage(jobId, 'outreach', 'failed', null, err.message);
        throw err;
      }
    });

    // Stage 6: Write to Google Sheets
    const sheetResult = await step.run('write-sheets', async () => {
      await updateStage(jobId, 'sheets', 'running');
      try {
        const result = await writeSheets(withOutreach, candidateName, candidateEmail);
        await updateStage(jobId, 'sheets', 'completed', {
          spreadsheetUrl: result.spreadsheetUrl,
        });
        return result;
      } catch (err) {
        await updateStage(jobId, 'sheets', 'failed', null, err.message);
        throw err;
      }
    });

    // Stage 7: Notify admin
    await step.run('notify', async () => {
      await updateStage(jobId, 'notify', 'running');
      try {
        const stats = {
          exact: withOutreach.exact.length,
          recommended: withOutreach.recommended.length,
          luck: withOutreach.luck.length,
        };
        const result = await notifyAdmin(candidateName, sheetResult.spreadsheetUrl, stats);
        await updateStage(jobId, 'notify', 'completed', result);
        return result;
      } catch (err) {
        await updateStage(jobId, 'notify', 'failed', null, err.message);
        throw err;
      }
    });
  }
);

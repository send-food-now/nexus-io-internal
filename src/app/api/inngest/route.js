import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest-client';
import { h1b1Pipeline } from '@/lib/pipeline/h1b1-pipeline';

export const runtime = 'nodejs';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [h1b1Pipeline],
});

import { serve } from 'inngest/next';
import { inngest, pipelineFunction } from '@/lib/inngest';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pipelineFunction],
});

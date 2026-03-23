import { serve } from 'inngest/next';
import { inngest, pipelineFunction } from '@/lib/inngest';
import { operatorLensFunction } from '@/lib/fn-operator-lens';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pipelineFunction, operatorLensFunction],
});

#!/usr/bin/env node

// End-to-end pipeline test — runs all phases directly (bypasses Inngest).
// Usage: node scripts/test-pipeline.mjs
// Requires: .env.local with ANTHROPIC_API_KEY, GOOGLE_SERVICE_ACCOUNT_EMAIL,
//           GOOGLE_PRIVATE_KEY, RESEND_API_KEY, ADMIN_EMAIL

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Load .env.local
config({ path: join(rootDir, '.env.local') });

// ---------- Test Data ----------

const RESUME_TEXT = `ALEX CHEN
Senior Full-Stack Engineer | Singapore
alex.chen@email.com | github.com/alexchen

EXPERIENCE
Senior Software Engineer — Grab (2021–2024)
- Led migration of payment microservices from Node.js monolith to Go + gRPC
- Built real-time fraud detection system processing 50K transactions/sec using Kafka + Flink
- Mentored team of 5 junior engineers, ran weekly architecture reviews
- Reduced API latency by 40% via Redis caching + query optimization

Software Engineer — Shopee (2019–2021)
- Developed React + TypeScript seller dashboard serving 2M+ merchants
- Built CI/CD pipelines with GitHub Actions, Docker, Kubernetes
- Implemented A/B testing framework used across 3 product teams

EDUCATION
B.S. Computer Science — National University of Singapore (2019)

SKILLS
Languages: TypeScript, Python, Go, SQL
Frontend: React, Next.js, Tailwind CSS
Backend: Node.js, Express, FastAPI, gRPC
Data: PostgreSQL, Redis, Kafka, Apache Flink
Infra: AWS, Docker, Kubernetes, Terraform
AI/ML: PyTorch, LangChain, vector databases`;

const COVER_LETTER_TEXT = `Dear Hiring Manager,

I'm a Senior Full-Stack Engineer from Singapore with 5 years of experience building high-scale systems at Grab and Shopee. I'm seeking H-1B1 sponsorship to join a US-based startup where I can contribute to ambitious technical challenges.

At Grab, I led the payment infrastructure migration that now processes millions of daily transactions. I'm passionate about developer experience, distributed systems, and using AI to solve real problems.

I thrive in fast-paced startup environments and value engineering excellence, mentorship, and building products that matter. My goal is to join a Series A-C startup working on AI/ML infrastructure or fintech.

Best regards,
Alex Chen`;

const SEARCH_PARAMS = {
  linkedinUrl: 'https://linkedin.com/in/alexchen',
  portfolioUrl: '',
  githubUrl: 'https://github.com/alexchen',
  regions: ['US — West Coast', 'US — East Coast'],
  riskAppetite: 4,
  direction: 'double-down',
};

const CANDIDATE_DATA = {
  name: 'Alex Chen',
  email: 'alex.chen.test@example.com',
  visaStatus: 'H-1B1 Singapore',
};

// ---------- Helpers ----------

function elapsed(start) {
  return ((Date.now() - start) / 1000).toFixed(1) + 's';
}

function printResult(label, data) {
  const preview = JSON.stringify(data, null, 2);
  const lines = preview.split('\n');
  if (lines.length > 20) {
    console.log(lines.slice(0, 20).join('\n'));
    console.log(`  ... (${lines.length - 20} more lines)`);
  } else {
    console.log(preview);
  }
  console.log();
}

async function runStage(name, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STAGE: ${name}`);
  console.log('='.repeat(60));
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✓ ${name} completed in ${elapsed(start)}`);
    printResult(name, result);
    return result;
  } catch (error) {
    console.error(`✗ ${name} FAILED in ${elapsed(start)}`);
    console.error(`  Error: ${error.message}`);
    if (name.includes('Sheets')) {
      console.error(`  Hint: Run 'node scripts/test-google-auth.mjs' to diagnose Google credentials.`);
    }
    if (error.stack) console.error(error.stack);
    throw error;
  }
}

// ---------- Env Check ----------

function checkEnv() {
  const required = ['ANTHROPIC_API_KEY'];
  const optional = [
    'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY',
    'RESEND_API_KEY', 'ADMIN_EMAIL', 'SERPER_API_KEY',
  ];

  console.log('Environment check:');
  let allRequired = true;
  for (const key of required) {
    const set = !!process.env[key];
    console.log(`  ${set ? '✓' : '✗'} ${key} ${set ? '(set)' : '(MISSING — required)'}`);
    if (!set) allRequired = false;
  }
  for (const key of optional) {
    const set = !!process.env[key];
    console.log(`  ${set ? '✓' : '–'} ${key} ${set ? '(set)' : '(not set — optional)'}`);
  }

  if (!allRequired) {
    console.error('\nMissing required env vars. Copy .env.local.example to .env.local and fill in values.');
    process.exit(1);
  }

  const skipSheets = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY;
  const skipNotify = !process.env.RESEND_API_KEY || !process.env.ADMIN_EMAIL;

  if (skipSheets) console.log('\n⚠ Will SKIP Phase 4.0 (write-sheets) — no Google credentials');
  if (skipNotify) console.log('⚠ Will SKIP Phase 4.1 (notify) — no Resend credentials');

  return { skipSheets, skipNotify };
}

// ---------- Main ----------

async function main() {
  const pipelineStart = Date.now();
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    NEXUS PIPELINE — End-to-End Test          ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const { skipSheets, skipNotify } = checkEnv();

  // Phase 2.0: Analyze Candidate
  const { analyzeCandidate } = await import('../src/lib/pipeline/analyze-candidate.js');
  const candidateProfile = await runStage('2.0 Analyze Candidate', () =>
    analyzeCandidate({ resumeText: RESUME_TEXT, coverLetterText: COVER_LETTER_TEXT, linkedinUrl: SEARCH_PARAMS.linkedinUrl, portfolioUrl: SEARCH_PARAMS.portfolioUrl, githubUrl: SEARCH_PARAMS.githubUrl })
  );

  // Phase 2.1: Identify Opportunities
  const { identifyOpportunities } = await import('../src/lib/pipeline/identify-opportunities.js');
  const opportunities = await runStage('2.1 Identify Opportunities', () =>
    identifyOpportunities({ candidateProfile, searchParams: SEARCH_PARAMS })
  );

  console.log(`  Target sectors: ${opportunities.targetSectors?.map(s => s.sector).join(', ')}`);
  console.log(`  Stage filter: ${opportunities.stageFilter}`);

  // Phase 3.0: Build Target List
  const { buildTargetList } = await import('../src/lib/pipeline/build-target-list.js');
  const startups = await runStage('3.0 Build Target List', () =>
    buildTargetList({ candidateProfile, opportunities, searchParams: SEARCH_PARAMS })
  );

  console.log(`  Found ${startups.length} startups`);

  // Phase 3.1: Populate Context
  const { populateContext } = await import('../src/lib/pipeline/populate-context.js');
  const enrichedStartups = await runStage('3.1 Populate Context', () =>
    populateContext({ startups, candidateProfile, opportunities })
  );

  // Phase 4.0: Write Sheets
  let sheetsResult = null;
  if (!skipSheets) {
    const { writeSheets } = await import('../src/lib/pipeline/write-sheets.js');
    sheetsResult = await runStage('4.0 Write Sheets', () =>
      writeSheets({ startups: enrichedStartups, candidateData: CANDIDATE_DATA })
    );
    console.log(`  Spreadsheet URL: ${sheetsResult.spreadsheetUrl}`);
  } else {
    console.log('\n⏭ Skipping Phase 4.0 (write-sheets)');
  }

  // Phase 4.1: Notify
  let notifyResult = null;
  if (!skipNotify && sheetsResult) {
    const { notifyAdmin } = await import('../src/lib/pipeline/notify.js');
    notifyResult = await runStage('4.1 Notify Admin', () =>
      notifyAdmin({ jobId: 'test-run-001', candidateData: CANDIDATE_DATA, spreadsheetUrl: sheetsResult.spreadsheetUrl })
    );
  } else {
    console.log('\n⏭ Skipping Phase 4.1 (notify)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('PIPELINE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total time: ${elapsed(pipelineStart)}`);
  console.log(`Candidate: ${CANDIDATE_DATA.name}`);
  console.log(`Startups found: ${startups.length}`);
  console.log(`Enriched: ${enrichedStartups.length}`);
  if (sheetsResult) console.log(`Sheet: ${sheetsResult.spreadsheetUrl}`);
  if (notifyResult) console.log(`Email ID: ${notifyResult.emailId}`);
  console.log();
}

main().catch(err => {
  console.error('\n\nPIPELINE FAILED:', err.message);
  process.exit(1);
});

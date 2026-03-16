#!/usr/bin/env node

// End-to-end pipeline test — runs all 7 stages directly (bypasses Inngest).
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
  industries: ['AI/ML', 'Fintech', 'Developer Tools'],
  fundingStages: ['Series A', 'Series B'],
  locations: ['San Francisco', 'New York'],
  teamSizes: ['11-50', '51-200'],
  techStack: ['TypeScript', 'React', 'Node.js', 'Python', 'Kubernetes'],
  customInterests: ['real-time systems', 'payment infrastructure'],
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

  if (skipSheets) console.log('\n⚠ Will SKIP Stage 6 (write-sheets) — no Google credentials');
  if (skipNotify) console.log('⚠ Will SKIP Stage 7 (notify) — no Resend credentials');

  return { skipSheets, skipNotify };
}

// ---------- Main ----------

async function main() {
  const pipelineStart = Date.now();
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    NEXUS PIPELINE — End-to-End Test          ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const { skipSheets, skipNotify } = checkEnv();

  // Stage 1: Profile Candidate
  const { profileCandidate } = await import('../src/lib/pipeline/profile-candidate.js');
  const candidateProfile = await runStage('1. Profile Candidate', () =>
    profileCandidate({ resumeText: RESUME_TEXT, coverLetterText: COVER_LETTER_TEXT })
  );

  // Stage 2: Discover Startups
  const { discoverStartups } = await import('../src/lib/pipeline/discover-startups.js');
  const startups = await runStage('2. Discover Startups', () =>
    discoverStartups({ candidateProfile, searchParams: SEARCH_PARAMS })
  );

  console.log(`  Found ${startups.length} startups`);

  // Stage 3: Categorize
  const { categorizeStartups } = await import('../src/lib/pipeline/categorize.js');
  const categorizedStartups = await runStage('3. Categorize', () =>
    categorizeStartups({ startups, candidateProfile, searchParams: SEARCH_PARAMS })
  );

  console.log(`  Exact: ${categorizedStartups.exact.length}, Recommended: ${categorizedStartups.recommended.length}, Luck: ${categorizedStartups.luck.length}`);

  // Stage 4: Enrich
  const { enrichStartups } = await import('../src/lib/pipeline/enrich-startups.js');
  const enrichedStartups = await runStage('4. Enrich Startups', () =>
    enrichStartups({ categorizedStartups })
  );

  // Stage 5: Generate Outreach
  const { generateOutreach } = await import('../src/lib/pipeline/generate-outreach.js');
  const outreachStartups = await runStage('5. Generate Outreach', () =>
    generateOutreach({ categorizedStartups: enrichedStartups, candidateProfile })
  );

  // Stage 6: Write Sheets
  let sheetsResult = null;
  if (!skipSheets) {
    const { writeSheets } = await import('../src/lib/pipeline/write-sheets.js');
    sheetsResult = await runStage('6. Write Sheets', () =>
      writeSheets({ categorizedStartups: outreachStartups, candidateData: CANDIDATE_DATA })
    );
    console.log(`  Spreadsheet URL: ${sheetsResult.spreadsheetUrl}`);
  } else {
    console.log('\n⏭ Skipping Stage 6 (write-sheets)');
  }

  // Stage 7: Notify
  let notifyResult = null;
  if (!skipNotify && sheetsResult) {
    const { notifyAdmin } = await import('../src/lib/pipeline/notify.js');
    notifyResult = await runStage('7. Notify Admin', () =>
      notifyAdmin({ jobId: 'test-run-001', candidateData: CANDIDATE_DATA, spreadsheetUrl: sheetsResult.spreadsheetUrl })
    );
  } else {
    console.log('\n⏭ Skipping Stage 7 (notify)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('PIPELINE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total time: ${elapsed(pipelineStart)}`);
  console.log(`Candidate: ${CANDIDATE_DATA.name}`);
  console.log(`Startups found: ${startups.length}`);
  console.log(`Exact: ${outreachStartups.exact.length}, Recommended: ${outreachStartups.recommended.length}, Luck: ${outreachStartups.luck.length}`);
  if (sheetsResult) console.log(`Sheet: ${sheetsResult.spreadsheetUrl}`);
  if (notifyResult) console.log(`Email ID: ${notifyResult.emailId}`);
  console.log();
}

main().catch(err => {
  console.error('\n\nPIPELINE FAILED:', err.message);
  process.exit(1);
});

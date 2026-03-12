# H-1B1 Visa Candidate Pipeline Admin — Implementation Plan

## Context

The repo (`nexus-io-internal`) currently contains a basic Next.js 14 chat UI scaffold that will be replaced entirely. The goal is to build a complete admin pipeline for processing H-1B1 visa candidate applications: a multi-step intake form, a 7-stage background processing pipeline via Inngest, and a real-time job status UI. V1 uses mocked external APIs (Crunchbase, Apollo) with real Claude, Google Sheets, Serper, and Resend integrations.

## Architecture

- **Frontend**: App Router (`src/app/`) with `"use client"` JSX components, inline CSS objects, dark theme
- **API Routes**: App Router (`src/app/api/`) — unified routing, native `request.formData()` for uploads (no formidable needed)
- **Language**: Plain JS/JSX throughout (`tsconfig.json` already has `allowJs: true`)
- **Pipeline**: Inngest `step.run()` for each of 7 stages — independently retryable
- **Job State**: Vercel KV (Upstash Redis) — works correctly across serverless invocations
- **Auth**: Server-side password verification via API route, HTTP-only cookie session

## File Structure

```
nexus-io-internal/
  .env.example
  .gitignore
  next.config.js
  package.json
  vercel.json
  tsconfig.json
  data/
    dol-h1b1.csv
  src/
    app/
      globals.css
      layout.jsx
      page.jsx                         → redirect to /admin
      admin/
        page.jsx                       → password gate + navigation
        intake/
          page.jsx                     → 5-step intake form
        status/
          [jobId]/
            page.jsx                   → real-time pipeline status + retry
      api/
        auth/
          route.js                     → server-side password check, sets cookie
        inngest/
          route.js                     → Inngest serve handler
        submit/
          route.js                     → form upload + PDF extraction + Inngest trigger
        job-status/
          [jobId]/
            route.js                   → GET polling endpoint
        retry/
          [jobId]/
            route.js                   → POST to retry failed stage
    lib/
      job-store.js                     → Vercel KV-backed job state
      inngest-client.js                → Inngest client singleton + pipeline function
      pipeline/
        profile-candidate.js           → stage 1: Claude resume/cover analysis
        discover-startups.js           → stage 2: multi-source startup search
        categorize.js                  → stage 3: scoring + bucketing
        enrich-startups.js             → stage 4: contacts, news, careers
        generate-outreach.js           → stage 5: Claude email generation
        write-sheets.js                → stage 6: Google Sheets export
        notify.js                      → stage 7: Resend email notification
```

## Dependencies

```
Production:
  @anthropic-ai/sdk      — Claude API (profiling, scoring, outreach)
  inngest                — Background job orchestration
  @vercel/kv             — Redis-backed job state (works in serverless)
  pdf-parse              — PDF text extraction
  papaparse              — CSV parsing for DOL H-1B1 data
  resend                 — Admin email notifications
  googleapis             — Google Sheets export

Dev (keep existing):
  @types/node, @types/react, @types/react-dom, typescript
```

Removed vs original spec:
- `formidable` → replaced by native `request.formData()` in App Router
- `uuid` → replaced by built-in `crypto.randomUUID()`
- Serper calls use plain `fetch` — no SDK needed

## Implementation Phases

### Phase 1: Project Scaffolding
- Delete existing `src/app/` files (chat scaffold)
- Update `package.json` — rename to `nexus-io-pipeline`, add all deps above
- Update `next.config.js`:
  ```js
  { experimental: { serverComponentsExternalPackages: ['pdf-parse'] } }
  ```
- Update `vercel.json`:
  ```json
  { "functions": {
      "src/app/api/inngest/route.js": { "maxDuration": 300 },
      "src/app/api/submit/route.js": { "maxDuration": 60 }
  }}
  ```
- Create `.env.example`:
  ```
  ANTHROPIC_API_KEY=
  INNGEST_EVENT_KEY=
  INNGEST_SIGNING_KEY=
  KV_REST_API_URL=           # Vercel KV
  KV_REST_API_TOKEN=         # Vercel KV
  GOOGLE_SERVICE_ACCOUNT_EMAIL=
  GOOGLE_PRIVATE_KEY=
  RESEND_API_KEY=
  SERPER_API_KEY=
  ADMIN_PASSWORD=
  ADMIN_EMAIL=
  ```
- Update `.gitignore` — add `.env`
- Create `data/dol-h1b1.csv` — sample H-1B1 petition data (~50-100 rows)
- **Verify**: `npm install` succeeds, `npm run dev` starts clean

### Phase 2: Shared Infrastructure
- **`src/lib/job-store.js`**: Vercel KV-backed store
  - `createJob(jobId, candidateName)` — sets initial job state in KV with TTL 24h
  - `updateStage(jobId, stage, status, data)` — reads job, updates stage, writes back
  - `getJob(jobId)` — reads from KV, returns null if not found
  - Job shape: `{ jobId, status, stages: { profile, discover, categorize, enrich, outreach, sheets, notify }, candidateName, createdAt }`
  - Each stage: `{ status: 'pending'|'running'|'completed'|'failed', result, error }`
  - **Fallback for local dev**: If KV env vars not set, fall back to in-memory Map with a console warning

- **`src/lib/inngest-client.js`**: Singleton Inngest client (`id: 'nexus-h1b1-pipeline'`) + pipeline function stub (stages wired in Phase 5)

### Phase 3: API Routes
- **`src/app/api/auth/route.js`**: POST handler — checks `request.json().password` against `process.env.ADMIN_PASSWORD` server-side, sets HTTP-only session cookie on success, returns 401 on failure
- **`src/app/api/submit/route.js`**:
  - Use `request.formData()` for multipart parsing (no formidable)
  - Validate file sizes (max 10MB per PDF)
  - Extract PDF text via `pdf-parse` from file buffer
  - Store extracted text in Vercel KV (key: `text:{jobId}`) to avoid Inngest 512KB payload limit
  - Generate jobId via `crypto.randomUUID()`
  - Create job in store
  - Send Inngest event `'h1b1/application.submitted'` with jobId + form metadata (not full text)
  - Return `{ jobId }`
- **`src/app/api/job-status/[jobId]/route.js`**: GET handler, return job from KV store (404 if not found)
- **`src/app/api/inngest/route.js`**: `serve()` from `inngest/next`, export `{ GET, POST, PUT }`
- **`src/app/api/retry/[jobId]/route.js`**: POST handler — reads job, finds failed stage, sends new Inngest event to restart from that stage
- **Verify**: POST to `/api/submit` with curl, confirm jobId; poll `/api/job-status/[jobId]`

### Phase 4: Pipeline Stages (in dependency order)

**Stage 1 — `profile-candidate.js`**
- Input: jobId (reads extracted text from KV)
- Two Claude calls (claude-sonnet-4-20250514):
  - Technical profile system prompt:
    ```
    You are an expert technical recruiter. Analyze this resume and extract a structured profile.
    Return JSON: { skills: string[], seniority: "junior"|"mid"|"senior"|"staff"|"principal",
    domains: string[], yearsExperience: number, education: string, notableAchievements: string[] }
    ```
  - Narrative profile system prompt:
    ```
    You are a career counselor analyzing a cover letter. Extract the candidate's motivations and personality.
    Return JSON: { motivation: string, values: string[], communicationStyle: string,
    careerGoals: string, cultureFit: string[] }
    ```
- Output: `{ technicalProfile, narrativeProfile }`

**Stage 2 — `discover-startups.js`**
- Input: technicalProfile, searchParams (funding stages, team sizes, industries, locations, tech stack)
- Query 5 sources via `Promise.allSettled`:
  1. Mocked Crunchbase — hardcoded startups matching funding/industry criteria
  2. Mocked Apollo — hardcoded company list matching location/size
  3. Serper search: `"[industry] startups hiring [skills] [location] H-1B1"`
  4. Serper search: `"YC startups [industry] [tech stack]"`
  5. Parse `data/dol-h1b1.csv` via `papaparse`, filter by matching criteria
- Deduplicate by company name (normalized lowercase)
- Output: raw startup array

**Stage 3 — `categorize.js`**
- Input: raw startups, technicalProfile, searchParams
- Claude scoring system prompt:
  ```
  You are a startup-candidate matching expert. Score each startup on these dimensions (0-100):
  1. technicalFit: How well the candidate's skills match the startup's likely tech needs
  2. parameterMatch: How well the startup matches search criteria (funding, size, location, industry)
  3. visaFriendliness: Likelihood of H-1B1 sponsorship (prior sponsors score higher)
  4. trendingSignal: Recent growth indicators (funding, hiring, press)
  Return JSON array with scores and a brief rationale per startup.
  ```
- Send in batches of 10 startups per Claude call
- Bucket: Exact Match (avg ≥ 80), Recommended (avg 50-79), Luck Shot (avg < 50)
- Output: `{ exact: [...], recommended: [...], luck: [...] }`

**Stage 4 — `enrich-startups.js`**
- Input: categorized startups (all 3 buckets)
- Per startup (concurrency limit 5 via batched `Promise.all`):
  - Mocked Apollo contacts (founder, CTO, hiring manager)
  - Serper: `"[company] recent funding news"`
  - Serper: `"[company] careers jobs page"`
  - Immigrant workforce estimate (heuristic based on H-1B1 CSV presence + signals)
- Output: enriched startups with contacts, news, careersUrl, immigrantPct

**Stage 5 — `generate-outreach.js`**
- Input: enriched startups, technicalProfile, narrativeProfile
- Per startup via Claude (concurrency limit 3):
  ```
  You are an expert cold outreach copywriter for job seekers. Given this candidate profile and
  startup context, generate personalized outreach.
  Return JSON: { hook: string (1-2 sentences), fitRationale: string (2-3 sentences),
  shortEmail: string (~100 words), longEmail: string (~250 words) }
  ```
- Output: startups with `outreach` field

**Stage 6 — `write-sheets.js`**
- Input: final startup data (3 categories), candidate info
- Google Sheets API via service account
- Create spreadsheet: `"H-1B1 Pipeline — [Name] — [Date]"`
- 3 tabs: "Exact Match", "Recommended", "Worth a Shot"
- 24 columns (right-sized from original 34):
  ```
  Company Name | Domain | Industry | Location | Funding Stage | Team Size |
  Tech Fit Score | Param Match Score | Visa Score | Trending Score | Composite Score |
  Contact 1 (Name/Title/Email) | Contact 2 (Name/Title/Email) |
  Recent News | Careers URL | Immigrant Workforce % |
  Hook | Fit Rationale | Short Email | Long Email |
  Source | Category | Notes
  ```
- Apply formatting: frozen header row, bold headers, auto-resize columns
- Share with candidate (viewer) + admin (editor)
- Output: `{ spreadsheetId, spreadsheetUrl }`

**Stage 7 — `notify.js`**
- Input: candidateName, spreadsheetUrl, adminEmail, stats (counts per bucket)
- Send email via Resend with summary + sheet link
- Output: `{ emailSent: true }`

### Phase 5: Wire Inngest Orchestrator
- Update `inngest-client.js` pipeline function to import and call all 7 stage modules
- Each `step.run()`:
  ```js
  const profile = await step.run('profile-candidate', async () => {
    await updateStage(jobId, 'profile', 'running');
    try {
      const result = await profileCandidate(jobId);
      await updateStage(jobId, 'profile', 'completed', result);
      return result;
    } catch (err) {
      await updateStage(jobId, 'profile', 'failed', null, err.message);
      throw err; // Inngest handles retry
    }
  });
  ```
- **Verify**: Submit form, watch Inngest dev server (`npx inngest-cli@latest dev`) process all 7 steps

### Phase 6: Frontend (Admin UI)
- **`src/app/globals.css`**: Minimal reset + dark theme vars (`--bg: #0a0a0a`, `--fg: #e0e0e0`, `--accent: #3b82f6`, `--surface: #1a1a1a`, `--border: #2a2a2a`)
- **`src/app/layout.jsx`**: Root layout, dark theme body, metadata "Nexus H-1B1 Pipeline"
- **`src/app/page.jsx`**: Redirect to `/admin`
- **`src/app/admin/page.jsx`** (password gate):
  - POST to `/api/auth` with password
  - On success: store session token, show navigation (New Candidate → `/admin/intake`, Check Status → input for jobId)
  - Never expose password client-side (no `NEXT_PUBLIC_*`)
- **`src/app/admin/intake/page.jsx`** (5-step form):
  - Step 1 — Candidate Info: name, email, phone, visa status, target start date
  - Step 2 — Search Params: chip multi-select for funding stages (Seed, Series A, B, C, Growth), team sizes (1-10, 11-50, 51-200, 200+), industries (AI/ML, Fintech, Healthcare, SaaS, etc.), locations (SF, NYC, Austin, Seattle, Remote)
  - Step 3 — Interests: tag input for tech stack, tag input for custom interests, textarea for "what you're looking for"
  - Step 4 — Documents: two file dropzones (resume + cover letter), drag-and-drop + click-to-browse, 10MB max per file with client-side validation, show filename when selected
  - Step 5 — Review: read-only summary of all data, edit buttons per section, Submit button
  - On submit: build `FormData`, POST to `/api/submit`, redirect to `/admin/status/[jobId]`
  - All inline CSS objects, dark card backgrounds, step indicator bar at top
- **`src/app/admin/status/[jobId]/page.jsx`** (job tracker):
  - Poll `/api/job-status/[jobId]` every 5s via `useEffect` + `setInterval`
  - 7 stage cards in vertical layout: pending (gray), running (blue spinner), completed (green check), failed (red X)
  - Completed stages show summary (e.g., "Found 47 startups", "Scored 3 Exact, 12 Recommended")
  - Failed stages show error message + **Retry button** (POST to `/api/retry/[jobId]`)
  - Completion banner with Google Sheet link at bottom
  - Stop polling when all completed or terminal failure

### Phase 7: Polish
- Error boundaries on frontend pages
- Graceful "job not found" handling on status page
- Loading states during form submission
- Final `.env.example` review
- Build verification: `npm run build` passes

## Verification Plan

1. `npm run build` — no errors
2. `npm run dev` + `npx inngest-cli@latest dev` in parallel
3. Navigate to `localhost:3000/admin`, enter password
4. Fill 5-step form with test data + sample PDFs
5. Submit → observe job status page updating through all 7 stages
6. Check Inngest dev dashboard at `localhost:8288` for step execution
7. Verify Google Sheet created with 3 tabs, 24 columns, correct sharing
8. Verify admin notification email received via Resend
9. Test retry: kill API key mid-pipeline, verify failed stage shows error + retry button works

## Key Risks

| Risk | Mitigation |
|------|-----------|
| KV latency for stage updates | Acceptable (~5ms per call); polling interval is 5s |
| pdf-parse in serverless | `serverComponentsExternalPackages` + explicit `runtime = 'nodejs'` |
| Claude rate limits for batch scoring | Concurrency limit 3-5, batch calls of 10 startups |
| Inngest 512KB payload limit | Store extracted text in KV, pass reference in event |
| Google Sheets API quotas | Use `batchUpdate` for row writes |
| Large PDF uploads | Client-side + server-side 10MB limit per file |

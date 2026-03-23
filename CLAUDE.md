# H-1B1 Candidate Pipeline — Implementation Plan

## Context

The repo (`nexus-io-internal`) is an admin pipeline that processes H-1B1 visa candidate applications — from intake form through AI-powered profiling, market-aware sector targeting, multi-source startup discovery, and Google Sheets export.

**Existing infrastructure** (all configured on Vercel dashboard, env vars set):
- Inngest (pipeline orchestration)
- Google Sheets/Drive API
- Claude API credits
- Upstash Redis via Vercel KV (persistent key-value store)

## Pipeline Architecture (4 Phases, 8 Steps)

### Phase 1: Input
- **1.0 Define broad search parameters** — Preferred geography (by regions), risk appetite (6-point scale), desired direction (double-down or pivot into new space)
- **1.1 Capture candidate profile** — Upload professional work history: CV/resume + cover letter + LinkedIn URL + work portfolio URL + GitHub URL

### Phase 2: Operator Lens
- **2.0 Analyze candidate profile** — Establish understanding of the candidate's skills, experiences, and career objectives via Claude
- **2.1 Identify best-fit opportunity areas ("Where to look")** — 3 sub-steps:
  - 1a/ If doubling down → build relevant market map with the latest theses
  - 1b/ If pivoting → build adjacent market maps with the latest theses
  - 2a/ If low risk (≤3 on 6-point scale) → optimise search for late-stage firms (Series C or later)
  - 2b/ If high risk (≥4 on 6-point scale) → optimise search for early-stage firms (Series B or earlier)
  - 3/ Based on the latest market theses + risk appetite, match candidate background-to-sector (which high-potential sectors best suit the candidate?)

### Phase 3: Enrich
- **3.0 Build target list via data sources** — With best-fit sectors established, identify startups through:
  1. Databases — Crunchbase, Pitchbook
  2. Startup media — Next Play, Sourcery by Molly O'Shea, Lenny's Newsletter, etc.
  3. VC — Research papers + portfolio pages
  4. Social media — LinkedIn, X, GitHub, Hacker News
  5. Gov sources — SEC EDGAR filings (late-stage), US DOL data on H-1B1
- **3.1 Populate target list with context** — Gather relevant outreach context about identified startups

### Phase 4: Output
- **4.0 Generate Google Sheet ("How to resonate")** — Formatted output per startup:
  1. List of startups, including verified emails of relevant key personnel
  2. Candidate fit score (out of 10) based on step 2.1
  3. One-liner on strategic narrative fit
  4. Suggested email subject headlines
- **4.1 Notify (optional)** — Email admin via Resend with completion summary + spreadsheet link

## Key Technical Decisions
- Claude model: `claude-sonnet-4-20250514`
- V1: Mocked Crunchbase/Pitchbook/Apollo, real Claude/Sheets/Serper/Resend
- Inline CSS objects (no external CSS files for components)
- Vercel KV (Upstash Redis) for job store
- Inngest `step.run()` for pipeline orchestration
- Google Sheets via service account
- Admin password protection via env var
- pdf-parse for PDF text extraction (server-side only)
- Conditional pipeline logic based on risk appetite (6-point scale) and direction (double-down vs pivot)
- Fit scoring: 1-10 scale (replacing previous 3-bucket categorization)

## Data Sources (V1 Status)
| Source | Type | Status |
|--------|------|--------|
| Crunchbase | Database | Mocked |
| Pitchbook | Database | Planned |
| Startup media (Next Play, Sourcery, Lenny's) | Media | Planned |
| VC portfolio pages | Research | Planned |
| Social media (LinkedIn, X, GitHub, HN) | Social | Planned |
| SEC EDGAR filings | Gov | Planned |
| US DOL H-1B1 data | Gov | Real (CSV) |
| Serper (web search) | Search | Real (optional) |
| Apollo (contacts) | Database | Mocked |

## Rules
Before implementing or modifying any external API integration (Google Sheets,
Apollo, Serper, Resend, etc.), check if a spec exists in `docs/`. If it doesn't,
STOP and write one first. The spec must include: auth method, credential storage,
data shape in/out, error handling table, and a setup checklist. Do not proceed
with implementation until the spec file exists.

## Integration Specs
Before working on any pipeline stage, check `docs/` for the relevant integration spec:
- **write-sheets** → `docs/google-sheets-integration.md`

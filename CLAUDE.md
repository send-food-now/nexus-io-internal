# H-1B1 Candidate Pipeline — Implementation Plan

## Context

The repo (`nexus-io-internal`) is an admin pipeline that processes H-1B1 visa candidate applications — from intake form through AI-powered profiling, startup discovery, outreach generation, and Google Sheets export.

**Existing infrastructure** (all configured on Vercel dashboard, env vars set):
- Inngest (pipeline orchestration)
- Google Sheets/Drive API
- Claude API credits
- Upstash Redis via Vercel KV (persistent key-value store)

## Pipeline Stages (7)
1. **profile-candidate** — Claude extracts technical + narrative profile from resume/cover letter
2. **discover-startups** — Multi-source startup discovery (mocked Crunchbase/Apollo, real YC/Serper/DOL CSV)
3. **categorize** — Score startups on fit/visa/trending; bucket into Exact/Recommended/Luck
4. **enrich-startups** — Contacts, news, career pages per startup
5. **generate-outreach** — Claude generates personalized hooks, fit rationales, email variants
6. **write-sheets** — Google Sheets export (3 tabs, 34 columns, formatted)
7. **notify** — Email admin via Resend with completion summary

## Key Technical Decisions
- Claude model: `claude-sonnet-4-20250514`
- V1: Mocked Crunchbase/Apollo, real Claude/Sheets/Serper/Resend
- Inline CSS objects (no external CSS files for components)
- Vercel KV (Upstash Redis) for job store
- Inngest `step.run()` for pipeline orchestration
- Google Sheets via service account
- Admin password protection via env var
- pdf-parse for PDF text extraction (server-side only)

## Rules
Before implementing or modifying any external API integration (Google Sheets, 
Apollo, Serper, Resend, etc.), check if a spec exists in `docs/`. If it doesn't, 
STOP and write one first. The spec must include: auth method, credential storage, 
data shape in/out, error handling table, and a setup checklist. Do not proceed 
with implementation until the spec file exists.

## Integration Specs
Before working on any pipeline stage, check `docs/` for the relevant integration spec:
- **write-sheets** → `docs/google-sheets-integration.md`

## Debugging Rules

**Before attempting any fix, determine: is this a CODE problem or an ENVIRONMENT problem?**

Code problem = logic is wrong in the files. Fix it.
Environment problem = code is correct but something external is wrong (expired credentials, missing env vars, quota limits, wrong permissions, stale deployment). **Do not modify code. Describe the problem and tell the developer which external system to check.**

**One-attempt rule:** For any external API error, make at most one code-level fix. If it does not resolve the issue, stop and report. Do not iterate.

## Do Not Modify List
These modules are verified working. If errors appear related to them, the problem is upstream or environmental.

- `src/lib/pipeline/write-sheets.js` — Google Sheets export (JWT with domain-wide delegation)

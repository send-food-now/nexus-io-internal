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

## Integration Specs
Before working on any pipeline stage, check `docs/` for the relevant integration spec:
- **write-sheets** → `docs/google-sheets-integration.md`

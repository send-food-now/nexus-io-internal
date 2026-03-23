# Google Sheets Integration Spec — Nexus.io Pipeline Output

> Drop this file in your repo root. Reference it in every Claude Code session that touches Sheets output.
>
> **File:** `src/lib/pipeline/write-sheets.js`
> **Main export:** `writeSheets({ startups, candidateData })`
> **Returns:** `{ spreadsheetId, spreadsheetUrl }`

---

## 1. Immediate Blocker

**Error:** `The user's Drive storage quota has been exceeded.`

**Root cause:** This is a **service account Drive quota** issue, not the user's personal Google account. The pipeline creates a new spreadsheet via the Drive API on every run. Failed/debug runs still create files that accumulate in the service account's own Drive (which has a separate 15GB quota invisible from the user's personal Drive).

### Fix (in order)

1. **List and purge orphaned files.** Run this from Claude Code or a script to see what's accumulated in the service account's Drive:

```javascript
const drive = google.drive({ version: 'v3', auth: driveAuth });
const res = await drive.files.list({
  q: "trashed = false",
  fields: "files(id, name, size, createdTime)",
  orderBy: "createdTime desc",
  pageSize: 100,
});
console.log(`Total files: ${res.data.files?.length}`);
res.data.files?.forEach(f => console.log(`${f.name} — ${f.size} bytes — ${f.createdTime}`));
```

Then delete everything except the most recent valid output:

```javascript
for (const file of filesToDelete) {
  await drive.files.delete({ fileId: file.id });
}
```

2. **Review `freeDriveQuota()` (line 46)** — this function handles cleanup before each run. See Section 7 for current behavior and known limitations.

3. **Do not rewrite auth or Sheets API logic to fix this.** The write path is correct — the problem is accumulation of orphaned files.

---

## 2. Architecture Overview

The pipeline output follows a **create-per-run** pattern, not an append-to-existing-sheet pattern:

```
Pipeline run
  → freeDriveQuota(drive, impersonatingDrive)  // Delete old spreadsheets
  → Drive API: create new spreadsheet           // Named "H-1B1 Pipeline — {name} — {date}"
  → Sheets API: rename default sheet            // "Target List"
  → Sort startups by fit score descending
  → Sheets API: populate sheet                  // 23-column rows via values.update
  → Sheets API: format headers                  // Blue background, white bold text
  → Sheets API: auto-resize columns
  → Drive API: share with candidate             // Writer access to candidate email
  → Return { spreadsheetId, spreadsheetUrl }
```

Each pipeline run produces a **fresh, self-contained spreadsheet** shared with one candidate. This is intentional — each candidate gets their own file.

---

## 3. Auth Method: Dual Auth Pattern

The code uses **two separate auth instances**. Do not consolidate them.

| Auth instance | Method | Used for | Scopes |
|---------------|--------|----------|--------|
| `getAuth()` | JWT with impersonation (`subject`) | Sheets API + impersonating Drive | `spreadsheets`, `drive` |
| `getDriveAuth()` | Plain service account (no `subject`) | Drive API (create files, delete files, share) | `spreadsheets`, `drive` |

Both use the same scopes but differ in whether `subject` (impersonation via `GOOGLE_IMPERSONATE_EMAIL`) is set.

### Credential Storage

Credentials are stored as **two separate environment variables** (not a single JSON blob):

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

In code:

```javascript
email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
```

The `replace(/\\n/g, '\n')` call converts escaped newlines (from env var storage) into real newlines for the PEM key.

**Never commit credentials to the repo.**

---

## 4. Library

Use `googleapis` (the official Google Node.js client):

```bash
npm install googleapis
```

**Do not use** `google-spreadsheet` (wrapper library) — the code uses both Drive and Sheets APIs together, which the wrapper doesn't handle well.

---

## 5. Sheet Structure

### Naming convention

Each spreadsheet is named: `H-1B1 Pipeline — {candidateName} — {YYYY-MM-DD}`

Optionally placed in a configured Drive folder via `GOOGLE_DRIVE_FOLDER_ID`.

### Tab (1 per spreadsheet)

| Tab name | Contents |
|----------|----------|
| Target List | All startups, sorted by fit score descending |

### Column mapping (23 columns, A–W)

| Column | Header | Source field | Type | Notes |
|--------|--------|-------------|------|-------|
| A | Company | `name` | string | Company name |
| B | Domain | `domain` | string | Company domain |
| C | Industry | `industry` | string | |
| D | Description | `description` | string | Company description |
| E | Funding Stage | `fundingStage` | string | |
| F | Location | `location` | string | |
| G | Team Size | `teamSize` | string | |
| H | Contact 1 Name | `contacts[0].name` | string | |
| I | Contact 1 Title | `contacts[0].title` | string | |
| J | Contact 1 Email | `contacts[0].email` | string | |
| K | Contact 2 Name | `contacts[1].name` | string | |
| L | Contact 2 Title | `contacts[1].title` | string | |
| M | Contact 2 Email | `contacts[1].email` | string | |
| N | Fit Score (/10) | `fitScore` | number | 1–10 scale |
| O | Narrative Fit | `narrativeFit` | string | One-liner on strategic fit |
| P | Email Subject 1 | `emailSubjectLines[0]` | string | |
| Q | Email Subject 2 | `emailSubjectLines[1]` | string | |
| R | Email Subject 3 | `emailSubjectLines[2]` | string | |
| S | Recent News | `recentNews` | string | Semicolon-separated (joined from array of `{ title }`) |
| T | Career Page | `careerPageUrl` | string | URL |
| U | H-1B1 History | `h1b1Approvals` | string | Formatted as `"{n} approvals"` |
| V | Source | `source` | string | Comma-separated if array |
| W | Created At | auto-generated | string | ISO 8601 timestamp |

Column headers are defined in `COLUMN_HEADERS` (line 3 of write-sheets.js).

### Header formatting

Row 1: blue background (RGB: 0.231, 0.51, 0.965), white bold text. Applied via `sheets.spreadsheets.batchUpdate` with `repeatCell` request.

---

## 6. Data Shape (Pipeline → Sheets)

### Input

`writeSheets` receives:

```javascript
{
  startups: [ startupObj, startupObj, ... ],  // flat array, unsorted
  candidateData: {
    name: "Lim Zi Jian",
    email: "candidate@email.com",  // optional, used for sharing
  }
}
```

### Startup object shape

```javascript
{
  name: "Acme Corp",
  domain: "acme.com",
  industry: "AI/ML",
  description: "...",
  fundingStage: "Series B",
  location: "San Francisco, CA",
  teamSize: "50-100",
  contacts: [
    { name: "Jane Doe", title: "CTO", email: "jane@acme.com" },
    { name: "John Smith", title: "VP Eng", email: "john@acme.com" },
  ],
  fitScore: 8,
  narrativeFit: "Strong AI background aligns with their core product",
  emailSubjectLines: ["Subject 1", "Subject 2", "Subject 3"],
  recentNews: [{ title: "Acme raises Series B" }],  // or string
  careerPageUrl: "https://acme.com/careers",
  h1b1Approvals: 5,
  source: "crunchbase",  // or ["crunchbase", "serper"]
}
```

### Row conversion

`startupToRow()` (line 74) maps each startup object into a 23-element array matching `COLUMN_HEADERS`. The mapping must stay in sync with the column table above.

### Write method

The single tab is populated via `sheets.spreadsheets.values.update` (not append):

```javascript
await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: "'Target List'!A1",
  valueInputOption: 'RAW',
  requestBody: { values: rows },  // rows = [COLUMN_HEADERS, ...sortedStartupRows]
});
```

Startups are sorted by `fitScore` descending before writing. Since each spreadsheet is fresh, `update` (overwrite) is correct — not `append`.

---

## 7. Drive Cleanup: `freeDriveQuota()` — CRITICAL

This function (line 46) runs **before** creating a new spreadsheet. Its job is to prevent service account Drive quota exhaustion.

### Current behavior

1. Takes two arguments: `(drive, impersonatingDrive)` — iterates both (skipping null)
2. Queries files matching: `name contains 'H-1B1 Pipeline'` AND `mimeType = 'application/vnd.google-apps.spreadsheet'`
3. Deletes all matching files (permanent delete via `drive.files.delete`)
4. Empties trash via `drive.files.emptyTrash()`
5. Logs each deletion

### Known limitations (future improvements)

| Problem | Current state | Recommended fix |
|---------|--------------|-----------------|
| Name filter too narrow | Only deletes files matching `"H-1B1 Pipeline"` — misses files from other naming conventions or failed runs | Query `trashed = false` without name filter, then apply retention logic |
| Silent error swallow | `try/catch` logs but does not re-throw — pipeline continues even if cleanup fails | Re-throw or halt on cleanup failure |
| Pagination missing | Only checks first page (100 files) | Use `nextPageToken` to iterate all files |
| No retention policy | Deletes ALL matching files, not keeping recent N | Keep most recent N runs (suggest N = 5) |

---

## 8. Sharing

After population, the spreadsheet is shared with the candidate:

```javascript
await drive.permissions.create({
  fileId: spreadsheetId,
  requestBody: {
    type: 'user',
    role: 'writer',
    emailAddress: candidateData.email,
  },
  supportsAllDrives: true,
});
```

Only runs if `candidateData.email` is provided. Skipped otherwise.

---

## 9. Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| `Drive storage quota exceeded` | Service account Drive full from accumulated files | Run cleanup — see Section 7. **Not a code/auth issue.** |
| `No key or keyFile set` | `GOOGLE_PRIVATE_KEY` env var missing or empty | Check Vercel env vars / `.env.local` — ensure `GOOGLE_PRIVATE_KEY` is set |
| 403 Forbidden | Service account lacks Drive/Sheets permissions | Check API enablement in GCP console and service account roles |
| 401 Unauthorized | Bad credentials or impersonation misconfigured | Re-check `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` env vars; verify `GOOGLE_IMPERSONATE_EMAIL` if using impersonation |
| 429 Rate limit | Too many API calls | Retry with exponential backoff (max 3 retries) |
| 404 Not found | Spreadsheet deleted between create and populate | Should not happen in normal flow — indicates race condition or external deletion |

### Retry pattern

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error?.code === 429 && i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 10. Environment Variables

| Variable | Required | Value | Where |
|----------|----------|-------|-------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes | Service account email (e.g. `foo@project.iam.gserviceaccount.com`) | Vercel env vars / `.env.local` |
| `GOOGLE_PRIVATE_KEY` | Yes | PEM private key (with `\n` for newlines) | Vercel env vars / `.env.local` |
| `GOOGLE_IMPERSONATE_EMAIL` | No | Email to impersonate via domain-wide delegation | Vercel env vars / `.env.local` |
| `GOOGLE_DRIVE_FOLDER_ID` | No | Drive folder ID to place new spreadsheets in | Vercel env vars / `.env.local` |

Note: There is no `GOOGLE_SHEET_ID` env var — spreadsheet IDs are generated dynamically per run.

---

## 11. Execution Flow (for Claude Code reference)

```
writeSheets({ startups, candidateData })
│
├─ getAuth()          → JWT auth (with impersonation if GOOGLE_IMPERSONATE_EMAIL set)
├─ getDriveAuth()     → Plain service account auth (no impersonation)
│
├─ freeDriveQuota(drive, impersonatingDrive)
│   ├─ For each drive instance (service account + impersonating):
│   │   ├─ List files matching "H-1B1 Pipeline" spreadsheets
│   │   ├─ Delete each file (permanent)
│   │   └─ Empty trash
│   └─ Errors logged but not re-thrown (known limitation)
│
├─ drive.files.create()  → New spreadsheet: "H-1B1 Pipeline — {name} — {date}"
│
├─ Sort startups by fitScore descending
│
├─ sheets.spreadsheets.batchUpdate() → Rename default sheet to "Target List"
├─ sheets.spreadsheets.values.update() → Write headers + rows (23 columns)
├─ sheets.spreadsheets.batchUpdate() → Format header row (blue bg, white bold)
├─ sheets.spreadsheets.batchUpdate() → Auto-resize columns
│
├─ drive.permissions.create() → Share with candidate (if email provided)
│
└─ Return { spreadsheetId, spreadsheetUrl }
```

---

## 12. Setup Checklist

- [ ] Create a Google Cloud project (or use existing)
- [ ] Enable the Google Sheets API
- [ ] Enable the Google Drive API
- [ ] Create a service account and download the JSON key
- [ ] Extract `client_email` → set as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- [ ] Extract `private_key` → set as `GOOGLE_PRIVATE_KEY`
- [ ] If using impersonation: set up domain-wide delegation and set `GOOGLE_IMPERSONATE_EMAIL`
- [ ] Add env vars to Vercel dashboard (and/or `.env.local` for local dev)
- [ ] Optionally create a Drive folder and add `GOOGLE_DRIVE_FOLDER_ID`
- [ ] Verify service account Drive quota has available space (run the listing script from Section 1)

---

## 13. Rules for Claude Code

When working on this file, follow these rules:

1. **Do not change the create-per-run pattern.** Each candidate gets their own spreadsheet. This is intentional.
2. **Do not consolidate the two auth instances.** `getAuth()` and `getDriveAuth()` serve different purposes (impersonation vs plain).
3. **Always run `freeDriveQuota()` before creating files.** Never skip or comment out cleanup.
4. **Keep `startupToRow()` in sync with `COLUMN_HEADERS`.** If columns change, update both. Current: 23 columns (A–W).
5. **If you encounter a quota error, diagnose first — do not rewrite auth logic.** Quota errors are almost always about accumulated files, not bad credentials.
6. **Log before every Drive API call** (create, delete, share) so failures are traceable.

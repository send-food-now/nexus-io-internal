# Google Sheets Integration Spec — Nexus.io Pipeline Output

> Drop this file in your repo root. Reference it in every Claude Code session that touches Sheets output.
> 
> **File:** `src/lib/pipeline/write-sheets.js`  
> **Main export:** `writeSheets({ categorizedStartups, candidateData })`  
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

2. **Fix `freeDriveQuota()` (line 58)** — this function is supposed to handle cleanup but is either failing silently or filtering too narrowly. See Section 7 for required behavior.

3. **Do not rewrite auth or Sheets API logic to fix this.** The write path is likely correct — the problem is accumulation of orphaned files.

---

## 2. Architecture Overview

The pipeline output follows a **create-per-run** pattern, not an append-to-existing-sheet pattern:

```
Pipeline run
  → freeDriveQuota()        // Delete old spreadsheets from service account Drive
  → Drive API: create new spreadsheet  // Named "H-1B1 Pipeline — {name} — {date}"
  → Sheets API: create 3 tabs         // "Exact Match", "Recommended", "Luck"
  → Sheets API: populate each tab     // 34-column rows via values.update
  → Sheets API: format headers        // Blue background, white bold text
  → Sheets API: auto-resize columns
  → Drive API: share with candidate   // Writer access to candidate email
  → Return { spreadsheetId, spreadsheetUrl }
```

Each pipeline run produces a **fresh, self-contained spreadsheet** shared with one candidate. This is intentional — each candidate gets their own file.

---

## 3. Auth Method: Dual Auth Pattern

The code uses **two separate auth instances**. Do not consolidate them.

| Auth instance | Method | Used for | Scopes |
|---------------|--------|----------|--------|
| `getAuth()` | JWT with impersonation | Sheets API (read/write cell data) | `spreadsheets` |
| `getDriveAuth()` | Plain service account | Drive API (create files, delete files, share) | `drive.file`, `drive` |

### Credential Storage

Store the entire service account JSON as a single environment variable:

```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"...","..."}
```

In code, parse it:

```javascript
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
```

**Never commit the JSON key file to the repo.**

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

Optionally placed in a configured Drive folder.

### Tabs (3 per spreadsheet)

| Tab name | Contents |
|----------|----------|
| Exact Match | Startups categorized as exact match |
| Recommended | Startups categorized as recommended |
| Luck | Startups categorized as luck/long-shot |

### Column mapping (33 columns, A–AG)

| Column | Field | Type | Notes |
|--------|-------|------|-------|
| A | Company | string | Company name |
| B | Domain | string | Company domain |
| C | Industry | string | |
| D | Description | string | Company description |
| E | Funding Stage | string | |
| F | Funding Amount | string | |
| G | Team Size | string | |
| H | Location | string | |
| I | Founded | string | |
| J | Tech Stack | string | |
| K | Technical Fit Score | number | |
| L | Parameter Match Score | number | |
| M | Visa Score | number | |
| N | Trending Score | number | |
| O | Overall Score | number | |
| P | Contact 1 Name | string | |
| Q | Contact 1 Title | string | |
| R | Contact 1 Email | string | |
| S | Contact 1 LinkedIn | string | URL |
| T | Contact 2 Name | string | |
| U | Contact 2 Title | string | |
| V | Contact 2 Email | string | |
| W | Contact 2 LinkedIn | string | URL |
| X | Recent News | string | Semicolon-separated |
| Y | Career Page | string | URL |
| Z | Immigrant Workforce % | string | |
| AA | Personalized Hook | string | |
| AB | Fit Rationale | string | |
| AC | Email (Short) | string | |
| AD | Email (Long) | string | |
| AE | H-1B1 History | string | |
| AF | Category | string | "Exact Match", "Recommended", or "Luck" |
| AG | Created At | string | ISO 8601 timestamp |

Column headers are defined in `COLUMN_HEADERS` (line 3 of write-sheets.js).

### Header formatting

Row 1 of each tab: blue background (`#4472C4`), white bold text. Applied via `sheets.spreadsheets.batchUpdate` with `repeatCell` request.

---

## 6. Data Shape (Pipeline → Sheets)

### Input

`writeSheets` receives:

```javascript
{
  categorizedStartups: {
    exact: [ startupObj, startupObj, ... ],
    recommended: [ startupObj, startupObj, ... ],
    luck: [ startupObj, startupObj, ... ],
  },
  candidateData: {
    name: "Lim Zi Jian",
    email: "candidate@email.com",  // optional, used for sharing
  }
}
```

> **Note:** Keys are lowercase (`exact`, `recommended`, `luck`) — this matches the output of `categorizeStartups()` in `categorize.js` and is consistent across all downstream stages (enrich, outreach, write-sheets).

### Row conversion

`startupToRow()` (line 87) maps each startup object into a 34-element array matching `COLUMN_HEADERS`. The mapping must stay in sync with the column table above.

### Write method

Each tab is populated via `sheets.spreadsheets.values.update` (not append):

```javascript
await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `${tabName}!A1:AG${rows.length + 1}`, // +1 for header row
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [COLUMN_HEADERS, ...rows],
  },
});
```

This writes headers + data in a single call per tab. Since each spreadsheet is fresh, `update` (overwrite) is correct — not `append`.

---

## 7. Drive Cleanup: `freeDriveQuota()` — CRITICAL

This function (line 58) runs **before** creating a new spreadsheet. Its job is to prevent service account Drive quota exhaustion.

### Required behavior

1. List all files owned by the service account (not just files matching a specific name pattern)
2. Log: total file count, total size, names of files found
3. Delete files older than the most recent N runs (suggest N = 5)
4. **Must complete successfully before proceeding to spreadsheet creation**
5. If cleanup fails, **log the error and halt execution** — do not silently continue to create another file

### Common failure modes

| Problem | Symptom | Fix |
|---------|---------|-----|
| Name filter too narrow | Only deletes files matching exact pattern, misses files from earlier naming conventions or failed runs | Query `trashed = false` without name filter, then apply retention logic |
| Silent error swallow | `try/catch` with no logging — cleanup fails but pipeline proceeds | Add explicit logging and re-throw or halt |
| Pagination missing | Only checks first page of results (100 files) | Use `nextPageToken` to iterate all files |
| Trashed but not purged | Files in trash still count toward quota | Use `drive.files.delete` (permanent) not `drive.files.update({ trashed: true })` |

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
});
```

Only runs if `candidateData.email` is provided. Skipped otherwise.

---

## 9. Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| `Drive storage quota exceeded` | Service account Drive full from accumulated files | Run cleanup — see Section 7. **Not a code/auth issue.** |
| 403 Forbidden | Service account lacks Drive/Sheets permissions | Check API enablement in GCP console and service account roles |
| 401 Unauthorized | Bad credentials or impersonation misconfigured | Re-check `GOOGLE_SERVICE_ACCOUNT_KEY` env var; verify impersonation target in `getAuth()` |
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

| Variable | Value | Where |
|----------|-------|-------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full service account JSON (stringified) | Vercel env vars / `.env.local` |
| `GOOGLE_DRIVE_FOLDER_ID` | Optional — Drive folder to place new spreadsheets in | Vercel env vars / `.env.local` |

Note: There is no `GOOGLE_SHEET_ID` env var — spreadsheet IDs are generated dynamically per run.

---

## 11. Execution Flow (for Claude Code reference)

```
writeSheets({ categorizedStartups, candidateData })
│
├─ getAuth()          → JWT auth for Sheets API
├─ getDriveAuth()     → Service account auth for Drive API
│
├─ logDriveQuota()    → Log quota before cleanup
├─ freeDriveQuota()   → ⚠️ MUST succeed before continuing
│   ├─ List all service account spreadsheets (paginated, no name filter)
│   ├─ Log count, total size, file names
│   ├─ Delete all old spreadsheets
│   ├─ Empty trash
│   └─ If files.list fails → HALT (fatal)
│
├─ 2s delay           → Wait for Google quota propagation
├─ logDriveQuota()    → Log quota after cleanup
│
├─ drive.files.create()  → New spreadsheet (3 retries on quota error)
│
├─ For each tab ["Exact Match", "Recommended", "Luck"]:
│   ├─ sheets.spreadsheets.batchUpdate() → Add tab
│   ├─ populateSheet() → values.update with headers + rows
│   ├─ sheets.spreadsheets.batchUpdate() → Format header row
│   └─ sheets.spreadsheets.batchUpdate() → Auto-resize columns
│
├─ drive.permissions.create() → Share with candidate (if email provided)
├─ drive.permissions.create() → Transfer ownership to admin (prevents quota accumulation)
│
└─ Return { spreadsheetId, spreadsheetUrl }
```

---

## 12. Setup Checklist

- [ ] Create a Google Cloud project (or use existing)
- [ ] Enable the Google Sheets API
- [ ] Enable the Google Drive API
- [ ] Create a service account and download the JSON key
- [ ] If using impersonation in `getAuth()`: set up domain-wide delegation
- [ ] Add `GOOGLE_SERVICE_ACCOUNT_KEY` to Vercel env vars (or `.env.local`)
- [ ] Optionally create a Drive folder and add `GOOGLE_DRIVE_FOLDER_ID`
- [ ] Verify service account Drive quota has available space (run the listing script from Section 1)

---

## 13. Rules for Claude Code

When working on this file, follow these rules:

1. **Do not change the create-per-run pattern.** Each candidate gets their own spreadsheet. This is intentional.
2. **Do not consolidate the two auth instances.** `getAuth()` and `getDriveAuth()` serve different purposes.
3. **Always run and verify `freeDriveQuota()` before creating files.** Never skip or comment out cleanup.
4. **Keep `startupToRow()` in sync with `COLUMN_HEADERS`.** If columns change, update both.
5. **If you encounter a quota error, diagnose first — do not rewrite auth logic.** Quota errors are almost always about accumulated files, not bad credentials.
6. **Log before every Drive API call** (create, delete, share) so failures are traceable.

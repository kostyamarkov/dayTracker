# Day Tracker Application Guide

## Purpose

Day Tracker is a proposed single-page web application for recording work location by date. The intended deployment is a private Google Apps Script (GAS) web app, with records stored in a private Google Sheet and source maintained in a private GitHub repository.

The repository contains the first implementation of the calendar UI, counting rules, Apps Script server, holiday seed, local preview, and tests. It does not contain a live spreadsheet, credentials, or a deployed GAS web app. The Google setup steps below are required before connecting the production app.

## How the App Should Work

The main view shows one month at a time. The user moves between months and taps a date to choose its status. The chosen status is saved to the spreadsheet and reflected in the calendar and monthly summary.

### Date statuses

- **Unselected working day:** no color fill. Counts as a home-working day unless the user explicitly marks the day as Office.
- **Office:** yellow. Does not count as a home-working day.
- **Home:** green. Counts as a home-working day.
- **Weekend:** gray and excluded by default.
- **Holiday or leave:** gray and excluded from the home-working count. Portuguese public holidays for 2026 and 2027 are preloaded into the calendar.
- **Converted weekend:** becomes a working day; its work mode then follows the normal rules. If left unselected, it counts as home.

Color should be accompanied by readable status text or accessible labels. The interface should not make color the only way to identify a date's status.

Only national Portuguese public holidays are preloaded, for 2026 and 2027. Municipal holidays are not imported; users can mark those dates manually as holidays. Record the authoritative source for the imported dates. Until additional years are loaded, dates outside 2026 and 2027 use the normal weekday/weekend defaults unless a user marks an override.

### Monthly summary

The summary shows the number of home-working days against the monthly allowance of 10 (for example, `5 / 10`) and a progress bar. Eligible weekdays count as home unless explicitly marked Office. Weekends, holidays, and leave are excluded unless a weekend is deliberately converted to a working day.

If the count exceeds 10, display the real count (for example, `11 / 10`) and cap the progress bar at 100%. There is no office-day minimum. These rules should be confirmed before implementation.

### Tablet layouts

- **Landscape:** calendar and monthly summary can sit side by side.
- **Portrait:** stack the summary and calendar vertically; keep day buttons large enough for touch and avoid horizontal page scrolling.
- Date controls and the status picker should support touch and keyboard interaction.

## Proposed Architecture

```text
Browser (HTML Service page, hosted by the GAS web app)
  Calendar UI and month summary
            | google.script.run (asynchronous RPC)
            v
Google Apps Script server functions
  Validation, counting rules, access checks, spreadsheet adapter
            | Spreadsheet service
            v
Private Google Sheet
  Holidays tab + Days tab
- **Sheets is suitable at this scale, but is not a transactional database.** Keep reads/writes to small ranges and use batch range operations rather than per-cell service calls. Use a script lock around shared read-modify-write operations if more than one request can update the same records. Store stable date keys and update existing rows. Apps Script and Google services have quotas and execution limits that can change; handle service failures and inspect the Apps Script Executions dashboard. This app should remain well below those limits if it loads/saves one month at a time.
- **Deployment versions matter.** The `/dev` test URL is for script editors and runs the latest saved code; users should use the deployed `/exec` URL. Publish code changes by creating/updating a deployment version. Use `clasp` or another documented workflow to sync repository source to the GAS project, but never commit credentials or live deployment secrets.

The spreadsheet ID and deployment settings belong in server-side configuration (for example, Script Properties). Script Properties are configuration storage, not a reason to grant broad editor access: project editors can manage the project and its configuration. Never place OAuth tokens or privileged credentials in HTML/JavaScript served to the browser or in Git, even in a private repository.

Official references: [Web apps](https://developers.google.com/apps-script/guides/web), [HTML Service best practices](https://developers.google.com/apps-script/guides/html/best-practices), [HTML Service restrictions](https://developers.google.com/apps-script/guides/html/restrictions), [client/server communication](https://developers.google.com/apps-script/guides/html/communication), [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas), and [LockService](https://developers.google.com/apps-script/reference/lock/lock-service).

## Proposed Repository Layout

```text
dayTracker/
  docs/
    implementation-plan.md   # Approved work sequence and acceptance criteria
    application-guide.md     # This overview and orientation guide
  gas/
    Code.gs                  # GAS entry point, spreadsheet setup, read/write RPC
    DayRules.gs              # Pure date/status/counting rules
    PortugueseHolidays.gs    # 2026-2027 national holiday seed
    Index.html               # HtmlService page template
    Styles.html              # Responsive calendar styles
    Client.html              # Browser calendar and google.script.run client
    Version.html             # Generated application version label
    appsscript.json          # GAS manifest (Europe/Lisbon, V8 runtime)
  tests/
    dayRules.test.js         # Local tests for counting and holiday dates
  tools/
    preview-server.js        # In-memory local UI preview; does not use Google
  package.json               # Local test and preview commands
  .clasp.json.example        # Non-secret example of local GAS project mapping
```

This is a source-repository layout, not a claim that GAS runs these folders as a local web server. GAS executes uploaded `.gs` files and serves HTML Service files. The current frontend is already plain HtmlService HTML/CSS/JavaScript; no bundler or framework is required. A tool such as `clasp` syncs the `gas/` directory with the Apps Script project.

## Responsibilities by Area

- **`gas/Index.html`, `Styles.html`, `Client.html`**: HtmlService template, responsive browser UI, and `google.script.run` calls. The browser never accesses the spreadsheet directly.
- **`gas/Code.gs`**: `doGet`, `initializeDayTracker`, monthly data retrieval, status updates, server validation, batched sheet reads/writes, and script locking.
- **`gas/Code.gs`**: `doGet`, private `initializeDayTracker_`, the public month-read/status-save RPCs, server validation, batched sheet reads/writes, and script locking. Only `getMonthData` and `saveDayStatus` should be callable from the browser.
- **`gas/Code.gs`**: `doGet`, the editor-visible `initializeDayTracker` setup entry point (delegating to private `initializeDayTracker_`), month-read/status-save RPCs, server validation, batched sheet reads/writes, and script locking. The setup entry point is also callable by the signed-in deployer; keep the web app restricted to that account.
4. In the Apps Script editor, select `initializeDayTracker` (without a trailing underscore) from the function selector and click **Run** once. Grant the requested spreadsheet authorization if prompted. This creates `Holidays` and `Days`, seeds 26 national holiday dates for 2026 and 2027 without overwriting existing rows, and keeps each tab's date column as text.
- **`gas/DayRules.gs`**: private date validation, weekday/weekend defaults, status overrides, and home-day counting.
- **`gas/PortugueseHolidays.gs`**: private deterministic seed dates for Portuguese national holidays for 2026 and 2027; municipal holidays are entered manually as day overrides.
- **`tests/`**: focused checks for counting rules and seeded national holidays.
- **`tools/preview-server.js`**: temporary, in-memory preview for UI work. Its saved changes disappear when the process stops and it is not the production storage layer.
- **`docs/`**: product rules, implementation steps, setup/deployment, and operational notes.

## Data Model Proposal

Keep preloaded national holidays separate from personal day-status overrides so users can change their work status without erasing the source calendar. A possible spreadsheet design has a `Holidays` tab seeded with national dates for 2026 and 2027 and a `Days` tab for personal overrides, including manually marked municipal holidays.

Possible `Holidays` fields:

| Field | Meaning |
| --- | --- |
| `date` | Stable date key, such as ISO `YYYY-MM-DD` |
| `name` | Holiday name |
| `scope` | `national` (the preloaded calendar includes national holidays only) |
| `source` | Authoritative source reference used to verify the date |

Store one row per date that has an explicit personal override in `Days`. A possible record is:

| Field | Meaning |
| --- | --- |
| `date` | Stable date key, such as ISO `YYYY-MM-DD`, interpreted in the agreed user timezone |
| `dayType` | `working`, `weekend`, `holiday`, or `leave`; a matching preloaded holiday makes the date non-working by default |
| `workMode` | `unselected`, `office`, or `home`; meaningful for working days |
| `updatedAt` | Optional timestamp useful for diagnostics |

Default dates need not have `Days` rows if the app can derive weekdays as working/unselected and Saturdays/Sundays as weekend. The `Holidays` tab is preloaded with verified national Portuguese holidays for 2026 and 2027; records identify the source and national scope. Store manually marked municipal holidays and other personal exceptions as `Days` records with `dayType` set to `holiday`. Confirm the timezone policy and authoritative source during planning.
Default dates need not have `Days` rows if the app can derive weekdays as working/unselected and Saturdays/Sundays as weekend. The `Holidays` tab is preloaded with the 26 verified national Portuguese holidays for 2026 and 2027; records identify the official source and national scope. Store manually marked municipal holidays and other personal exceptions as `Days` records with `dayType` set to `holiday`. The GAS manifest uses the `Europe/Lisbon` timezone.

## Setup and Security Notes
3. Run `npm run push:gas` to generate the app version from the latest Git commit and upload the contents of `gas/`. In Apps Script Project Settings (the gear icon), add the Script Property `SPREADSHEET_ID` with the private spreadsheet ID. Do not put that ID in client HTML/JavaScript. Before the first Git commit, version generation uses the local generation time as a temporary fallback.

The source is implemented, but no application setup, production spreadsheet, GAS project, or deployment has been performed. To connect the production app:

1. Create a private Google Sheet in the personal Google account that will own the deployment. Copy its spreadsheet ID from the URL (the part between `/d/` and `/edit`).
2. Create a standalone Apps Script project, then configure the local `clasp` client against it. Copy `.clasp.json.example` to `.clasp.json`, replace the placeholder with the Apps Script project ID, and run `clasp login` locally. `.clasp.json` is ignored by Git.
3. Run `clasp push` to upload the contents of `gas/`. In Apps Script Project Settings (the gear icon), add the Script Property `SPREADSHEET_ID` with the private spreadsheet ID as its value. Do not put that ID in client HTML/JavaScript.
4. Open the Apps Script project in the browser. In the top toolbar, select `initializeDayTracker_` from the function selector next to **Debug**, then click **Run**. On the first run, review and grant the requested spreadsheet authorization for your own script. This creates `Holidays` and `Days`, seeds 26 national holiday dates for 2026 and 2027 without overwriting existing rows, and keeps each tab's date column as text. The trailing underscore marks this as a server-private helper; run it from the editor, not through the browser UI.
5. Confirm `Holidays` and `Days` headers and date values in the spreadsheet. Manually mark municipal holidays with `dayType=holiday` in `Days`; use `leave` for personal leave. The preview server stores records only in memory and is not involved in this setup.
6. Deploy as a web app that executes as the deployer and limit access to the deploying account. This matches the confirmed single-user requirement; do not select anonymous/public access. If account-level deployment policy does not permit this, stop and choose an approved account/access method before deployment.
7. Test the `/dev` URL while signed in as a script editor. Create a versioned `/exec` deployment only after tests pass. When code changes, use `clasp push`, then update the deployment to a new version.

Local commands: `npm test` runs the domain/holiday tests; `npm run dev` starts the non-persistent preview at `http://127.0.0.1:4173`.

Do not commit access tokens, service-account keys, real spreadsheet IDs, or other secrets. Do not expose server-side configuration to the browser. Restrict Apps Script project editor access, since editors can modify and redeploy the server code. Verify the deployment identity and sharing permissions before relying on spreadsheet access controls.

## Current Status

The initial implementation and local tests exist. The production app remains disconnected until the owner creates/configures the private spreadsheet and Apps Script project, supplies local `clasp` authentication, and deploys it from their Google account.
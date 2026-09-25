# Day Tracker Implementation Plan

## Goal

Build a private, tablet-friendly web app for tracking office and home working days. The app is served by a private Google Apps Script (GAS) project and stores its data in a private Google Sheet. The GitHub repository contains the application source and documentation.

Application work was approved and started. The initial calendar/counting implementation exists; the remaining steps below describe follow-up work through private deployment and acceptance testing.

## Product Rules to Confirm

1. The monthly allowance is 10 home-working days. There is no minimum office attendance requirement.
2. For each eligible working day, an explicit **Office** selection means the day does not count as home. **Home** and **Unselected** both count as home.
3. Saturdays and Sundays are non-working by default and do not count. A user can convert one to a working day; after conversion, its selected work mode determines how it is counted, with **Unselected** counting as home.
4. Portuguese public holidays are preloaded for 2026 and 2027. Holidays and leave are excluded from the count. They need an explicit non-working status so that they are not mistaken for unselected working days.
5. Over-limit months remain visible (for example, `11 / 10`); the progress bar is capped at 100% while the numeric count is not.
6. A date has one effective day type: working day, weekend/holiday/leave. Working days also have one work mode: unselected, office, or home. The interface may show these as a combined status and color.

## Steps

### 1. Approve the rules and scope

- Confirmed: single user, personal Google account, and access restricted to the deploying account.
- Confirmed: display counts above 10 and cap the progress bar at 100%; do not block status selection.
- Confirmed: preload national Portuguese public holidays only for 2026 and 2027. Do not preload municipal holidays; allow manual holiday entries. Source: the Portuguese Labour Code, Article 234, in Diário da República.
- Confirmed: dates outside the seeded years use ordinary weekday/weekend defaults unless manually overridden.

**Status:** complete.

### 2. Define the user flow and tablet layout

- Design a single-page monthly calendar with previous/next month controls and a clear month/year heading.
- Use a compact monthly home-day summary and progress bar beside the calendar on wide screens.
- On a portrait iPad layout, place the summary above or below the calendar so the calendar remains usable without horizontal scrolling.
- Make each date a stable-size touch target. Distinguish weekdays, weekends, holidays, leave, office, home, and unselected working days without relying on color alone.
- On date activation, open an accessible menu or popover to choose a status. Support keyboard dismissal and touch interaction.

**Deliverable:** responsive wireframe and interaction specification for portrait and landscape.

### 3. Choose and document the technical structure

- Use Google Apps Script as the server/runtime and Google Sheets as persistent storage.
- Serve the UI from a GAS web app using `doGet()` and HtmlService; do not assume Apps Script provides a Node.js server or generic static hosting. Decide how local HTML/CSS/JS source is included or bundled into HtmlService files and synced to GAS (for example, with `clasp`).
- Keep browser UI code separate from GAS server functions and define a narrow `google.script.run` interface for reading a month and updating a date. Treat calls as asynchronous, pass ISO date strings/plain serializable objects rather than `Date` instances, and prevent out-of-order saves from overwriting newer state.
- Confirm the deployment identity (execute as deployer or accessing user), allowed audience, OAuth scopes, spreadsheet sharing, and any Workspace administrator restrictions before relying on access controls.
- Keep secrets and privileged identifiers out of browser code and Git. Restrict Apps Script project editors; use server-side configuration such as Script Properties for deployment settings.
- Check HTML Service iframe/HTTPS restrictions and verify the app in iPad Safari before committing to external libraries or browser APIs.

**Deliverable:** agreed file layout, data contract, and deployment approach.

### 4. Set up the repository and GAS project

- Create the source folders, dependency/build configuration only if required by the chosen deployment approach, and a sample configuration that contains no secrets.
- Create or configure a standalone GAS web-app project and private spreadsheet outside the browser bundle. Confirm Apps Script is enabled for the deployment account.
- Add setup instructions for authorizing the script and granting access to the intended users.
- Define spreadsheet headers, date representation, holiday source/scope metadata, and how missing dates are interpreted.
- Seed the spreadsheet with the verified Portuguese holiday dates for 2026 and 2027. Keep imported calendar dates distinct from personal day-status overrides, and record the source and scope so the seed can be audited or updated.
- Verify local-to-GAS file mapping, test `/dev` with script editors, then create a restricted versioned `/exec` deployment for intended users.
- Verify local-to-GAS file mapping, test `/dev` with script editors, then create a restricted versioned `/exec` deployment for the deploying account only.

**Deliverable:** a deployable application shell, documented setup, and verified 2026–2027 Portuguese holiday data.

### 5. Implement and test the counting rules

- Implement a single domain-level function that determines eligible working dates and monthly home-day count.
- Exclude weekend, preloaded holiday, and leave dates; include eligible weekdays unless they are explicitly marked Office.
- Treat a converted weekend as a working day and apply its selected work mode.
- Calculate the progress percentage as `min(homeDays / allowance, 1) * 100`, while displaying the true count even when it exceeds the allowance.
- Add focused tests for month boundaries, leap years, preloaded 2026–2027 holiday dates, weekends, leave, unselected dates, office dates, converted weekends, and over-limit counts.

**Deliverable:** tested counting logic independent of the calendar UI and spreadsheet adapter.

### 6. Implement spreadsheet persistence in GAS

- Add GAS functions to load month records and save a date's status.
- Validate dates and allowed status values on the server; do not trust client-submitted data.
- Use a stable date key and update an existing date rather than creating duplicate records.
- Read and write ranges in batches; do not make one spreadsheet service call per calendar cell. Use `LockService` around shared read-modify-write operations and handle lock timeouts and service/quota failures.
- Return actionable errors to the UI and avoid silently losing edits.
- Test empty sheets, existing records, repeated updates, invalid values, and concurrent or rapid edits as appropriate to the confirmed user count.

**Deliverable:** reliable month read/write operations backed by the private spreadsheet.

### 7. Build the calendar and status editor

- Render the selected month with correct leading/trailing dates and touch-friendly day buttons.
- Provide statuses for unselected working day, office, home, weekend/non-working, holiday, and leave; provide an explicit action to convert a weekend into a working day.
- Keep status text or an equivalent accessible label available in addition to color: unselected has no fill, office is yellow, home is green, and non-working dates are gray.
- Refresh the count and progress bar immediately after a change, then persist it and show save/error state.
- Implement month navigation and load the destination month's records.

**Deliverable:** functional single-page calendar connected to the GAS data interface.

### 8. Verify responsive behavior and accessibility

- Check the app in iPad-sized portrait and landscape viewports, plus a narrower mobile viewport and a desktop viewport.
- Verify that date buttons, status choices, navigation, and summary do not overlap or require precision tapping.
- Check keyboard access, focus visibility, accessible names, contrast, and non-color status cues.
- Confirm month changes and status editing work after reload and across devices using the same authorized account.

**Deliverable:** tested layouts and resolved usability issues.

### 9. Deploy privately and complete acceptance testing

- Deploy the GAS web app with the narrowest practical access setting; verify who the deployment runs as, who can open it, whether Workspace policy allows it, and that users receive only the versioned `/exec` URL.
- Configure spreadsheet access and script properties without placing secrets in Git or client JavaScript.
- Verify redeployment procedure: saved source changes do not automatically update a versioned `/exec` deployment; publish a new version and re-test it.
- Run end-to-end acceptance cases for a normal month, a month with holidays/leave, a converted weekend, month navigation, and an over-limit month.
- Document deployment, authorization, backup, and recovery steps.

**Deliverable:** private working deployment and operational documentation.

## Approval Gate

The user approved implementation. Continue with the remaining steps; pause and ask the user if an unresolved account, data, or product decision blocks progress. Do not deploy until the owner has configured their private Google project and spreadsheet.

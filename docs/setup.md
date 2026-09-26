# Day Tracker: Setup and Deployment Guide

This guide provides step-by-step instructions to set up Day Tracker for production use. It covers local configuration, Google Cloud project creation, Apps Script deployment, and acceptance testing.

## Prerequisites

- A personal Google account with Google Drive, Google Sheets, and Google Apps Script access enabled
- Node.js 18+ and npm installed locally
- `clasp` CLI (installed as a dev dependency; run with `npm run clasp`)
- Git repository cloned

## Overview

Day Tracker consists of:
- **Local source code** (this repository)
- **Private Google Sheet** for persistent storage (Holidays and Days tabs)
- **Google Apps Script project** that runs the server-side logic
- **Web app deployment** that users access through a browser

The architecture ensures secrets (spreadsheet ID) remain on the server and are never exposed in Git or client code.

---

## Part 1: Local Setup

### Step 1.1: Clone and Install Dependencies

```bash
git clone https://github.com/kostyamarkov/dayTracker.git
cd dayTracker
npm install
```

### Step 1.2: Test the Local Preview

The preview server allows you to test the UI and counting logic without Google services:

```bash
npm run dev
```

Open `http://127.0.0.1:4173` in your browser. The preview is in-memory and changes do not persist.

### Step 1.3: Run Local Tests

Verify the counting rules and Portuguese holiday dates:

```bash
npm run test
```

Expected output: all tests pass, confirming date parsing, weekday/weekend logic, holiday seeding, and over-limit handling.

---

## Part 2: Google Cloud Project Setup

### Step 2.1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **NEW PROJECT**.
3. Enter project name: `day-tracker` (or similar).
4. Click **CREATE** and wait for the project to be initialized.
5. Select the new project.

### Step 2.2: Enable Google Sheets and Google Apps Script APIs

In the Cloud Console:

1. Search for **"Google Sheets API"** in the search bar.
2. Click the result and press **ENABLE**.
3. Search for **"Google Apps Script API"** and **ENABLE** it.
4. (Optionally) Create an OAuth 2.0 credential if prompted, but it is not required for single-user deployment.

### Step 2.3: Create a Private Google Sheet

1. Go to [Google Drive](https://drive.google.com/).
2. Click **+ New** → **Google Sheets** → **Blank spreadsheet**.
3. Name it `Day Tracker Data` (or similar).
4. Open the sheet and note the **Spreadsheet ID** from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
   - Copy the part between `/d/` and `/edit`.
5. **Do not share this sheet publicly.** It is private to your account.

### Step 2.4: Create a Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com/).
2. Click **+ New project**.
3. Name it `Day Tracker` (or similar).
4. In the left sidebar, click **Project Settings** (gear icon).
5. At the bottom under **Script ID**, copy the **Script ID**. You will need it in Step 3.

---

## Part 3: Connect Local Code to Google Apps Script

### Step 3.1: Configure clasp

1. In the repository root, copy the example configuration:
   ```bash
   cp .clasp.json.example .clasp.json
   ```

2. Open `.clasp.json` and replace the placeholder with your Apps Script project ID:
   ```json
   {
     "scriptId": "YOUR_APPS_SCRIPT_ID_HERE",
     "rootDir": "gas"
   }
   ```

3. Verify the configuration:
   ```bash
   npm run clasp -- --version
   ```

### Step 3.2: Authenticate clasp with Google

Run the login command:

```bash
npm run clasp -- login
```

A browser window will open. Sign in with your Google account and grant clasp permission to access your Google Account and Google Apps Script projects.

---

## Part 4: Upload Code to Google Apps Script

### Step 4.1: Push Code to GAS

```bash
npm run push:gas
```

This command:
1. Generates `gas/Version.html` with the latest Git commit hash
2. Uploads all files from the `gas/` folder to your Apps Script project

After the upload, refresh your [Apps Script editor](https://script.google.com/) to see the updated code.

### Step 4.2: Verify the Upload

In the Apps Script editor:
- Left sidebar should show: `Code.gs`, `DayRules.gs`, `PortugueseHolidays.gs`, `Index.html`, `Styles.html`, `Client.html`, `Version.html`, `appsscript.json`
- Click on `Code.gs` to verify the server functions are present

---

## Part 5: Configure Spreadsheet Access

### Step 5.1: Add Script Property

In the Apps Script editor:

1. Click **Project Settings** (gear icon) in the left sidebar.
2. Scroll to **Script Properties**.
3. Click **Add Script Property**:
   - **Key:** `SPREADSHEET_ID`
   - **Value:** paste the Spreadsheet ID from Step 2.3
4. Click **SAVE SCRIPT PROPERTY**.

⚠️ **Security Note:** The Spreadsheet ID is stored server-side in Google's secure configuration, not in Git or client code.

### Step 5.2: Initialize the Spreadsheet

In the Apps Script editor:

1. At the top, open the **Select function** dropdown (currently showing "Select function").
2. Choose **`initializeDayTracker`** (without underscore).
3. Click the **Run** button (play icon).
4. On the first run, a popup will ask you to authorize the script:
   - Click **Review permissions**
   - Select your Google account
   - Click **Allow** to grant the script access to Google Sheets
5. After authorization, the script runs and creates/initializes the spreadsheet.

### Step 5.3: Verify the Spreadsheet

Go to your Google Sheet (`Day Tracker Data`):

- **Holidays tab:** Contains national Portuguese holidays for 2026 and 2027 with source metadata
- **Days tab:** Empty by default; will store personal day-status overrides
- Both tabs should have frozen headers (row 1)

The spreadsheet is now ready for the web app to read and write data.

---

## Part 6: Create a Web App Deployment

### Step 6.1: Deploy as a Web App

In the Apps Script editor:

1. Click **Deploy** (top right) → **New deployment**.
2. Select **Type:** → click the dropdown and choose **Web app**.
3. Fill in the fields:
   - **Execute as:** Your Google Account (the deployer)
   - **Who has access:** Only myself
4. Click **Deploy**.
5. A popup will show the deployment URL, similar to:
   ```
   https://script.google.com/macros/d/{DEPLOYMENT_ID}/usercopy
   ```
   or
   ```
   https://script.google.com/macros/s/{DEPLOYMENT_ID}/usercopy
   ```

**Copy and save this URL for later testing.**

### Step 6.2: Test the /dev URL

While signed in as a script editor, test the development version:

1. In the Apps Script editor, click **Deploy** → view all deployments.
2. Find the row with **Type: Web app** and click the **URL** (or use the `/dev` variant: replace `/usercopy` with `/dev`).
3. The app should load and show the current month.
4. Try clicking a date to open the status editor dialog.
5. Select a status (e.g., "Office") and click to save.
6. Confirm the change persists and the count updates.

If errors occur, check the browser console (F12) and the Apps Script execution logs (**Executions** tab in the editor).

---

## Part 7: Create a Versioned Deployment

Once testing passes, create a versioned deployment for production use:

### Step 7.1: Create New Version

In the Apps Script editor:

1. Click **Deploy** (top right) → **All deployments**.
2. Click **Create deployment** (if not already done) or select an existing Web app deployment.
3. For production, create a new **Web app** deployment with:
   - **Execute as:** Your Google Account
   - **Who has access:** Only myself
4. Each deployment gets a unique URL; bookmark this URL for daily use.

### Step 7.2: Update Deployments After Code Changes

When you update the code:

1. Run `npm run push:gas` to upload changes to Apps Script.
2. In the Apps Script editor, click **Deploy** → **All deployments**.
3. Click the pencil icon next to the production deployment.
4. Click **Create new version** to save a new version of the code.
5. The old version URL remains active; the new version URL is provided after deployment.
6. Update your bookmark to the new URL.

⚠️ **Important:** Versioned deployments do not auto-update. You must manually create a new version for each code change.

---

## Part 8: Acceptance Testing

### Test Case 1: Normal Month

1. Open the app in your browser.
2. Navigate to the current month.
3. The calendar should display all dates with weekdays unselected (no fill) and weekends in gray.
4. Click a weekday and select **Home**. Verify the count increases.
5. Click the same date and select **Office**. Verify the count decreases.

### Test Case 2: Month with Holidays

1. Verify that Portuguese public holidays (e.g., January 1, December 25) appear in gray.
2. Hover over or tap a holiday; the label should show "Holiday".
3. Verify holidays do not count toward the home-day allowance.

### Test Case 3: Manually Marked Leave

1. Click a weekday and select **Leave**.
2. The date should appear in gray and not count.
3. Navigate away and back; the status should persist.

### Test Case 4: Converted Weekend

1. Click a Saturday or Sunday.
2. Click **Converted weekend** (if available in the UI) or select **Unselected** from a weekend.
3. The date should now count as working; if left unselected, it counts as home.
4. Verify the count updates.

### Test Case 5: Month Navigation

1. Click **Previous month** and **Next month** buttons.
2. Navigate across multiple months (including year boundaries).
3. Data from each month should persist and be correctly displayed.

### Test Case 6: Over-Limit Month

1. Mark 11 or more days as home in a single month.
2. Verify the count shows `11 / 10` (not capped at 10).
3. Verify the progress bar is capped at 100% visually.
4. Verify you can still change statuses (no blocking).

### Test Case 7: Cross-Device Consistency

1. Open the app on your phone, tablet, and desktop.
2. Change a status on one device.
3. Reload the app on another device.
4. Verify the change is visible (data fetched from the spreadsheet).

### Test Case 8: Accessibility

1. Disable CSS in your browser (to check color is not the only cue).
2. Verify date statuses are still distinguishable by text label.
3. Use keyboard navigation (Tab, Enter) to select dates.
4. Verify screen reader compatibility (check `aria-*` attributes in the HTML).

---

## Part 9: Operations

### Local Development Cycle

To iterate during development:

1. Edit the source files in `gas/`, `tests/`, or `tools/`.
2. Run `npm run dev` to test the UI locally.
3. Run `npm test` to verify counting logic.
4. Run `npm run push:gas` to upload to Apps Script.
5. Test in the `/dev` URL in the Apps Script editor.
6. When ready, create a new versioned deployment.

### Backup and Recovery

**Backup the spreadsheet:**
- Google Sheets automatically versions changes; use **File** → **Version history** to view or restore previous versions.
- Manually download the sheet as CSV or Excel: **File** → **Download** for offline archival.

**Restore from backup:**
- In the Apps Script editor, run `initializeDayTracker` again to reset the sheet structure if needed.
- Manually re-enter data if the sheet becomes corrupted.

### Updating the App

To deploy a new version:

1. Make changes to `gas/` files.
2. Commit and push to Git.
3. Run `npm run push:gas`.
4. Test in the `/dev` URL.
5. Create a new versioned deployment as described in Step 7.

### Monitoring and Troubleshooting

**Check execution logs:**
- In the Apps Script editor, click **Executions** (sidebar).
- View logs for recent function calls, including errors and timestamps.

**Common issues:**
- **"Spreadsheet not found":** Verify `SPREADSHEET_ID` in Script Properties (Step 5.1).
- **"Authorization required":** Run `initializeDayTracker` once and grant permissions (Step 5.2).
- **Changes not saving:** Check the browser console for client-side errors; check Apps Script logs for server errors.
- **Slow load times:** Sheets API calls can be slow for the first request; subsequent calls are faster.

---

## Part 10: Security Checklist

- ✅ Spreadsheet ID is stored in Script Properties (server-side), not in Git or client code.
- ✅ `.clasp.json` is in `.gitignore`; credentials are not committed.
- ✅ Apps Script executes with your account permissions; the app is restricted to you only.
- ✅ Browser code (HTML/CSS/JS) never directly accesses the spreadsheet; all access goes through `google.script.run` RPC.
- ✅ Server-side validation rejects invalid dates and statuses.
- ✅ Script Properties are not exposed in browser code.

---

## Summary

You have successfully:
1. ✅ Set up local development environment
2. ✅ Created a Google Cloud project and enabled required APIs
3. ✅ Created a private Google Sheet for data storage
4. ✅ Created and configured a Google Apps Script project
5. ✅ Connected local code to Apps Script via clasp
6. ✅ Uploaded code and initialized the spreadsheet
7. ✅ Deployed the app as a private web app
8. ✅ Tested core functionality
9. ✅ Established a process for updates and operations

The app is now ready for daily use. Access the deployment URL bookmarked in Step 6.1 to begin tracking your work-from-home days.

---

## Support and References

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [HTML Service Guide](https://developers.google.com/apps-script/guides/html)
- [Google Sheets API Reference](https://developers.google.com/sheets/api)
- [clasp CLI Documentation](https://github.com/google/clasp)
- [Portuguese Labour Code - Article 234](https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475)

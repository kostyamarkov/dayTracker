const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const outputPath = path.join(__dirname, '..', 'gas', 'Version.html');

function formatCommitTimestamp(timestamp) {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Unsupported Git timestamp: ${timestamp}`);
  }
  const [, year, month, day, hour, minute] = match;
  return `${day}-${month}-${year}-${hour}-${minute}`;
}

function getVersionTimestamp() {
  try {
    const commitTimestamp = execFileSync('git', ['log', '-1', '--format=%cI'], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (commitTimestamp) {
      return { timestamp: formatCommitTimestamp(commitTimestamp), source: 'latest commit' };
    }
  } catch {
    // Use the local generation time until the repository has its first commit.
  }

  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return {
    timestamp: `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}-${pad(now.getHours())}-${pad(now.getMinutes())}`,
    source: 'generation time (no Git commit exists yet)'
  };
}

const version = getVersionTimestamp();
fs.writeFileSync(outputPath, `<span class="app-version">App version: ${version.timestamp}</span>\n`);
console.log(`Updated app version from ${version.source}: ${version.timestamp}`);
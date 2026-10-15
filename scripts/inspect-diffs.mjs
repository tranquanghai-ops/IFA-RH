import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchLatestConferencesFromDrive, mapJsonConferenceToRawRow } from '../src/services/researchDriveJsonService.ts';
import { computeOpportunityDiff } from '../src/utils/researchDedupe.ts';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const headers = new Headers(opts?.headers || {});
  if (!headers.has('Referer')) {
    headers.set('Referer', 'https://ifa-rh.web.app');
  }
  if (!headers.has('Origin')) {
    headers.set('Origin', 'https://ifa-rh.web.app');
  }
  return originalFetch(url, { ...opts, headers });
};

const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const token = cfg.tokens.access_token;
const BASE_URL = 'https://firestore.googleapis.com/v1/projects/ifa-rh/databases/(default)/documents';

function decodeValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue?.fields || {});
  return null;
}

function decodeFields(fields) {
  const result = {};
  for (const [k, v] of Object.entries(fields || {})) {
    result[k] = decodeValue(v);
  }
  return result;
}

async function main() {
  const driveResult = await fetchLatestConferencesFromDrive({});
  const rows = driveResult.payload.conferences.map((c, idx) => mapJsonConferenceToRawRow(c, idx, driveResult.payload.runId));

  const res = await fetch(`${BASE_URL}/opportunities?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const opps = (data.documents || []).map(d => ({
    id: d.name.split('/').pop(),
    ...decodeFields(d.fields)
  }));

  const codeToOppId = {
    TN0001: 'opp_ietbhec_2027',
    TN0002: 'opp_celg_2026',
    TN0003: 'opp_ciemb_2026',
    TN0004: 'opp_letj_2027',
    TN0005: 'opp_icisn_2027',
    TN0006: 'opp_neu_duongdai_2026',
    TN0007: 'E3zjQ9KZxXarkH8R2CEM',
    QT0003: 'opp_global_south_2026',
  };

  for (const row of rows) {
    const oppId = codeToOppId[row.conferenceCode];
    if (!oppId) continue;
    const opp = opps.find(o => o.id === oppId);
    if (!opp) {
      console.log(`Opp not found for ${row.conferenceCode} (${oppId})`);
      continue;
    }
    const diff = computeOpportunityDiff(opp, row);
    console.log(`\n========================================`);
    console.log(`CODE: ${row.conferenceCode} | Opp: ${opp.id} | hasChanges: ${diff.hasChanges}`);
    for (const d of diff.diffSummary) {
      console.log(`  FIELD: ${d.field}`);
      console.log(`    OLD in Opp   : ${JSON.stringify(d.oldValue)}`);
      console.log(`    NEW in Spark : ${JSON.stringify(d.newValue)}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

async function getCollection(col) {
  const res = await fetch(`${BASE_URL}/${col}?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`${col} failed: ${await res.text()}`);
  const data = await res.json();
  return (data.documents || []).map(d => {
    const id = d.name.split('/').pop();
    return { id, ...decodeFields(d.fields) };
  });
}

async function main() {
  const opps = await getCollection('opportunities');
  const cands = await getCollection('opportunityCandidates');

  console.log(`\n=== OPPORTUNITIES (${opps.length} docs) ===`);
  for (const o of opps) {
    console.log(`- ID: ${o.id} | Status: ${o.status} | Code: ${o.conferenceCode || 'NONE'} | Cat: ${o.category || 'NONE'} | CandId: ${o.candidateId || 'NONE'} | Title: ${o.title?.substring(0, 50)}...`);
  }

  console.log(`\n=== CANDIDATES (${cands.length} docs) ===`);
  for (const c of cands) {
    console.log(`- ID: ${c.id} | Status: ${c.status} | Type: ${c.changeType || 'create'} | Code: ${c.conferenceCode || 'NONE'} | OppId: ${c.publishedOpportunityId || 'NONE'} | Res: ${c.resolutionType || 'NONE'} | Title: ${c.title?.substring(0, 45)}...`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

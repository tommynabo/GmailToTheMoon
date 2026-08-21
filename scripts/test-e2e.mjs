import { Client } from 'pg';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(p) {
  try {
    const c = readFileSync(p, 'utf8');
    for (const l of c.split('\n')) {
      const t = l.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i<0) continue;
      const k = t.slice(0,i).trim();
      const v = t.slice(i+1).trim().replace(/^[\"']|[\"']\$/g,'');
      if (k && !process.env[k]) process.env[k]=v;
    }
  } catch {}
}
loadEnv(resolve(__dirname, '../.env'));

const DB_URL = process.env.DATABASE_URL;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

const ACTOR_ID   = 'scraperlink~google-search-results-serp-scraper';
const APIFY_BASE = 'https://api.apify.com/v2';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,10}/g;

function extractEmails(text) {
  const matches = text.match(EMAIL_REGEX) ?? [];
  return [...new Set(
    matches.map(e => e.toLowerCase()).filter(e => !e.includes('example.com') && e.includes('@'))
  )];
}

function extractIgHandle(url) {
  try {
    if (!url.includes('instagram.com')) return null;
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    const handle = parts[0].replace(/^@/, '').toLowerCase();
    const SKIP = new Set(['p', 'reel', 'explore', 'accounts', 'tv', 'stories', 'tags', 'about']);
    if (SKIP.has(handle) || handle.length < 2 || handle.length > 30) return null;
    return handle;
  } catch {
    return null;
  }
}

async function runTest() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('✅ Connected to Neon DB');

  const keyword = "Business Coach";
  const searchQuery = `site:instagram.com "${keyword}" ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com")`;

  console.log(`\n🚀 Starting Apify test with: ${searchQuery}`);
  
  const startRes = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs?timeout=120&memory=512`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${APIFY_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: searchQuery, limit: "20" }),
  });
  const startData = await startRes.json();
  const runId = startData.data.id;
  const datasetId = startData.data.defaultDatasetId;
  console.log(`  Run ID: ${runId}`);

  let status = '';
  for(let i=0; i<30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs/${runId}`, {
      headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
    });
    const pollData = await pollRes.json();
    status = pollData.data.status;
    console.log(`  Poll ${i+1}: ${status}`);
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) break;
  }

  if (status !== 'SUCCEEDED') {
    console.error('❌ Actor failed:', status);
    await client.end();
    return;
  }

  const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?limit=15`, {
    headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
  });
  const datasetItems = await itemsRes.json();
  const items = [];
  for (const d of datasetItems) {
    if (d.results && Array.isArray(d.results)) {
      items.push(...d.results);
    } else {
      items.push(d);
    }
  }
  console.log(`\n✅ Actor succeeded. Items extracted: ${items.length}`);

  let inserted = 0;
  for (const item of items) {
    const textToSearch = [
      item.title ?? '', item.description ?? '', item.snippet ?? '',
      item.url ?? '', item.link ?? '',
    ].join(' ');

    const emails = extractEmails(textToSearch);
    const igHandle = extractIgHandle(item.url ?? item.link ?? '');
    
    if (emails.length === 0 && !igHandle) continue;

    const email = emails[0] ?? null;
    console.log(`  --> Found: email=${email}, ig=${igHandle}`);

    try {
      const res = await client.query(`
        INSERT INTO leads (email, ig_handle, source, ai_summary, status)
        VALUES ($1, $2, $3, $4, 'new')
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [
        email ?? `noemail-${igHandle ?? Date.now()}@placeholder.internal`,
        igHandle ?? null,
        'instagram',
        ((item.title ?? '') + ' — ' + (item.description ?? item.snippet ?? '')).slice(0, 255),
      ]);
      if (res.rowCount > 0) inserted++;
    } catch(e) {
      if (e.code !== '23505') console.error('Insert error:', e.message);
    }
  }

  console.log(`\n✅ Test complete! Inserted ${inserted} new leads.`);
  
  const dbLeads = await client.query('SELECT email, ig_handle FROM leads ORDER BY created_at DESC LIMIT 5');
  console.log('\n--- Latest 5 Leads in DB ---');
  console.table(dbLeads.rows);

  await client.end();
}

runTest().catch(console.error);

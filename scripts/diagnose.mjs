import { Client } from 'pg';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch(e) {
    console.warn('Could not load .env:', e.message);
  }
}

loadEnv(resolve(__dirname, '../.env'));

const DB_URL = process.env.DATABASE_URL;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

console.log('='.repeat(60));
console.log('GmailToTheMoon — AUTOPILOT DIAGNOSTIC');
console.log('='.repeat(60));
console.log('\n📋 ENV CHECK');
console.log('  DATABASE_URL:', DB_URL ? `✅ SET (${DB_URL.slice(0,50)}...)` : '❌ MISSING');
console.log('  APIFY_API_TOKEN:', APIFY_TOKEN ? `✅ SET (${APIFY_TOKEN.slice(0,20)}...)` : '❌ MISSING');

// ─── DB DIAGNOSTIC ───────────────────────────────────────────────
async function runDbDiagnostic() {
  if (!DB_URL) {
    console.error('\n❌ Cannot connect to DB — DATABASE_URL missing');
    return;
  }
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
    console.log('\n✅ DB connected successfully');

    // Count leads
    const leadsRes = await client.query('SELECT COUNT(*) as total FROM leads');
    const newLeadsRes = await client.query("SELECT COUNT(*) as total FROM leads WHERE created_at >= NOW() - INTERVAL '24 hours'");
    console.log(`\n📊 LEADS:`);
    console.log(`  Total: ${leadsRes.rows[0].total}`);
    console.log(`  Last 24h: ${newLeadsRes.rows[0].total}`);

    // Search tasks
    const tasksRes = await client.query(`
      SELECT id, query, status, apify_run_id, leads_found, created_at, completed_at
      FROM search_tasks 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log(`\n🔍 SEARCH TASKS (last 10):`);
    if (tasksRes.rows.length === 0) {
      console.log('  ⚠️  NO SEARCH TASKS FOUND — The cron has never run or failed silently');
    } else {
      for (const row of tasksRes.rows) {
        console.log(`  [${row.status.toUpperCase()}] "${row.query}"`);
        console.log(`     ID: ${row.id}`);
        console.log(`     Apify Run ID: ${row.apify_run_id || '❌ NULL — actor never started'}`);
        console.log(`     Leads found: ${row.leads_found}`);
        console.log(`     Created: ${row.created_at}`);
        console.log(`     Completed: ${row.completed_at || 'NOT YET'}`);
      }
    }

    // Running tasks stuck
    const stuckRes = await client.query(`
      SELECT COUNT(*) as total FROM search_tasks 
      WHERE status = 'running' AND created_at < NOW() - INTERVAL '1 hour'
    `);
    if (parseInt(stuckRes.rows[0].total) > 0) {
      console.log(`\n⚠️  STUCK TASKS: ${stuckRes.rows[0].total} tasks stuck in 'running' for >1h`);
      console.log('   → Webhook is NOT being called by Apify (or is failing)');
    }

  } catch(e) {
    console.error('\n❌ DB ERROR:', e.message);
  } finally {
    await client.end();
  }
}

// ─── APIFY DIAGNOSTIC ─────────────────────────────────────────────
async function runApifyDiagnostic() {
  if (!APIFY_TOKEN) {
    console.error('\n❌ Cannot test Apify — APIFY_API_TOKEN missing');
    return;
  }

  console.log('\n🤖 APIFY TEST — Checking actor exists and token is valid');
  
  // 1. Check account
  try {
    const meRes = await fetch('https://api.apify.com/v2/users/me', {
      headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
    });
    const me = await meRes.json();
    if (me.data) {
      console.log(`  ✅ Apify account: ${me.data.username} | Plan: ${me.data.plan?.id || 'unknown'}`);
    } else {
      console.log('  ❌ Apify token INVALID:', JSON.stringify(me));
    }
  } catch(e) {
    console.error('  ❌ Apify /users/me error:', e.message);
  }

  // 2. Check actor validity — test a DRY RUN with 0 results
  console.log('\n🎭 Testing actor: apify/google-search-scraper');
  try {
    const testInput = {
      queries: 'site:instagram.com "B2B Consultant" "@gmail.com" test',
      resultsPerPage: 1,
      maxPagesPerQuery: 1,
    };
    const startRes = await fetch('https://api.apify.com/v2/acts/apify~google-search-scraper/runs?timeout=30&memory=128', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testInput),
    });
    const startData = await startRes.json();
    
    if (startData.data?.id) {
      console.log(`  ✅ Actor started! Run ID: ${startData.data.id}`);
      console.log(`  ℹ️  Status: ${startData.data.status}`);
      
      // Wait for completion
      console.log('  ⏳ Waiting up to 60s for actor to complete...');
      const runId = startData.data.id;
      let finalStatus = '';
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 4000));
        const statusRes = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}`, {
          headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
        });
        const statusData = await statusRes.json();
        finalStatus = statusData.data?.status || '';
        console.log(`  ... poll ${i+1}: ${finalStatus}`);
        if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(finalStatus)) break;
      }
      
      if (finalStatus === 'SUCCEEDED') {
        const dsId = startData.data.defaultDatasetId;
        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?limit=5`, {
          headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
        });
        const items = await itemsRes.json();
        console.log(`\n  📦 Results (up to 5 items):`);
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((item, i) => {
            console.log(`    [${i+1}] URL: ${item.url || item.link || 'N/A'}`);
            console.log(`         Title: ${(item.title || '').slice(0, 80)}`);
            console.log(`         Snippet: ${(item.snippet || item.description || '').slice(0, 100)}`);
          });
        } else {
          console.log('    ⚠️  0 items returned — search query returned no results');
          console.log('    Raw:', JSON.stringify(items).slice(0, 300));
        }
      } else {
        console.log(`  ❌ Actor finished with status: ${finalStatus}`);
      }
      
      // Abort to save credits
      await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}/abort`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
      });
    } else {
      console.log('  ❌ Actor failed to start:', JSON.stringify(startData).slice(0, 400));
    }
  } catch(e) {
    console.error('  ❌ Apify actor test error:', e.message);
  }
}

await runDbDiagnostic();
await runApifyDiagnostic();

console.log('\n' + '='.repeat(60));
console.log('DIAGNOSTIC COMPLETE');
console.log('='.repeat(60));

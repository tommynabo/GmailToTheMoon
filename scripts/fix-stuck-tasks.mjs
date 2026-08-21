import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  } catch(e) { /* ignore */ }
}

loadEnv(resolve(__dirname, '../.env'));

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('❌ DATABASE_URL missing'); process.exit(1); }

const client = new Client({ connectionString: DB_URL });

try {
  await client.connect();
  console.log('✅ Connected to Neon DB');

  // 1. Mark stuck tasks as failed
  const fixResult = await client.query(`
    UPDATE search_tasks 
    SET status = 'failed', completed_at = NOW()
    WHERE status = 'running' AND created_at < NOW() - INTERVAL '30 minutes'
    RETURNING id, query, created_at
  `);
  console.log(`\n🔧 Fixed ${fixResult.rowCount} stuck tasks:`);
  for (const row of fixResult.rows) {
    console.log(`   - "${row.query}" (created: ${row.created_at})`);
  }

  // 2. Show current state
  const summary = await client.query(`
    SELECT status, COUNT(*) as count FROM search_tasks GROUP BY status
  `);
  console.log('\n📊 Current search_tasks state:');
  for (const row of summary.rows) {
    console.log(`   ${row.status}: ${row.count}`);
  }

  console.log('\n✅ DB cleanup complete');
} catch(e) {
  console.error('❌ Error:', e.message);
} finally {
  await client.end();
}

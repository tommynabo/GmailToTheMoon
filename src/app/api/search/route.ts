import { NextResponse } from 'next/server';
import { Client } from 'pg';

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const ACTOR_ID   = 'scraperlink~google-search-results-serp-scraper';
const APIFY_BASE = 'https://api.apify.com/v2';
const POLL_INTERVAL_MS = 4_000;
const MAX_WAIT_MS = 3 * 60 * 1000; // 3 minutos
const RESULTS_LIMIT = 20; // Límite anticréditos (sólo permite: 10, 20, 30, 40, 50, 100)

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,10}/g;

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  return [...new Set(
    matches.map(e => e.toLowerCase()).filter(e => !e.includes('example.com') && e.includes('@'))
  )];
}

function extractIgHandle(url: string): string | null {
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

async function apifyStart(token: string, input: unknown): Promise<{ runId: string; datasetId: string }> {
  const url = `${APIFY_BASE}/acts/${ACTOR_ID}/runs?timeout=120&memory=512`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json() as any;
  if (!data?.data?.id || !data?.data?.defaultDatasetId) {
    throw new Error(`Apify start failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
}

async function apifyPoll(token: string, runId: string): Promise<string> {
  const res = await fetch(`${APIFY_BASE}/acts/${ACTOR_ID}/runs/${runId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json() as any;
  return data?.data?.status ?? 'UNKNOWN';
}

async function apifyGetItems(token: string, datasetId: string): Promise<any[]> {
  const url = `${APIFY_BASE}/datasets/${datasetId}/items?limit=${RESULTS_LIMIT}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── HANDLER ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let dbClient: Client | undefined;
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) return NextResponse.json({ error: 'APIFY_API_TOKEN not configured' }, { status: 500 });

    const body = await req.json();
    const { query, platform = 'instagram' } = body;
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

    // Construir Google Dork según plataforma
    const searchQuery = platform === 'instagram'
      ? `site:instagram.com "${query}" ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com" OR "@outlook.com")`
      : `site:linkedin.com/in "${query}"`;

    // ─ 1. Crear task en DB ────────────────────────────────────────────────
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();

    const taskResult = await dbClient.query(
      `INSERT INTO search_tasks (query, platform, status) VALUES ($1, $2, 'running') RETURNING id`,
      [query, platform]
    );
    const taskId = taskResult.rows[0].id as string;

    // ─ 2. Lanzar actor ───────────────────────────────────────────────────
    const { runId, datasetId } = await apifyStart(token, {
      keyword: searchQuery,
      limit: String(RESULTS_LIMIT),
    });

    await dbClient.query(
      `UPDATE search_tasks SET apify_run_id = $1 WHERE id = $2`,
      [runId, taskId]
    );

    // ─ 3. Polling ────────────────────────────────────────────────────────
    const deadline = Date.now() + MAX_WAIT_MS;
    let finalStatus = '';
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      finalStatus = await apifyPoll(token, runId);
      if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(finalStatus)) break;
    }

    if (!['SUCCEEDED', 'TIMED-OUT'].includes(finalStatus)) {
      await dbClient.query(`UPDATE search_tasks SET status = 'failed', completed_at = NOW() WHERE id = $1`, [taskId]);
      return NextResponse.json({ error: `Actor did not succeed: ${finalStatus}` }, { status: 500 });
    }

    // ─ 4. Procesar resultados ────────────────────────────────────────────
    const datasetItems = await apifyGetItems(token, datasetId);
    const items = [];
    for (const d of datasetItems) {
      if (d.results && Array.isArray(d.results)) {
        items.push(...d.results);
      } else {
        items.push(d);
      }
    }

    let leadsInserted = 0;

    for (const item of items) {
      const textToSearch = [
        item.title ?? '', item.description ?? '', item.snippet ?? '',
        item.url ?? '', item.link ?? '',
      ].join(' ');

      const emails = extractEmails(textToSearch);
      const igHandle = extractIgHandle(item.url ?? item.link ?? '');
      if (emails.length === 0 && !igHandle) continue;

      const email = emails[0] ?? null;
      try {
        const result = await dbClient.query(`
          INSERT INTO leads (email, ig_handle, source, ai_summary, status)
          VALUES ($1, $2, $3, $4, 'new')
          ON CONFLICT (email) DO NOTHING
          RETURNING id
        `, [
          email ?? `noemail-${igHandle ?? Date.now()}@placeholder.internal`,
          igHandle ?? null,
          platform,
          ((item.title ?? '') + ' — ' + (item.description ?? item.snippet ?? '')).slice(0, 255),
        ]);
        if (result.rowCount && result.rowCount > 0) leadsInserted++;
      } catch (insertErr: any) {
        if (insertErr.code !== '23505') console.error('[Search] Insert error:', insertErr.message);
      }
    }

    // ─ 5. Completar task ─────────────────────────────────────────────────
    await dbClient.query(
      `UPDATE search_tasks SET status = 'completed', leads_found = $1, completed_at = NOW() WHERE id = $2`,
      [leadsInserted, taskId]
    );

    return NextResponse.json({ success: true, taskId, runId, itemsProcessed: items.length, leadsInserted });

  } catch (error: any) {
    console.error('[API Search] Error:', error.message);
    if (dbClient) {
      try { await dbClient.end(); } catch { /* ignore */ }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (dbClient) {
      try { await dbClient.end(); } catch { /* ignore */ }
    }
  }
}

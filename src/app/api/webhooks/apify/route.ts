import { NextResponse } from 'next/server';
import { Client } from 'pg';

/**
 * Apify Webhook — ACTOR.RUN.SUCCEEDED
 *
 * Este endpoint es un fallback. El cron principal (`/api/cron/daily-search`)
 * ya procesa los resultados de forma self-contained mediante polling.
 *
 * Si quieres usarlo directamente desde Apify, configura el webhook en:
 * https://console.apify.com → Settings → Webhooks → Add Webhook
 *   - Event: ACTOR.RUN.SUCCEEDED
 *   - URL: https://TU_DOMINIO.vercel.app/api/webhooks/apify
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,10}/g;

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

export async function POST(req: Request) {
  let dbClient: Client | undefined;
  try {
    const token = process.env.APIFY_API_TOKEN;
    const body = await req.json();

    const { eventType, eventData } = body;

    if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
      return NextResponse.json({ success: true, message: `Ignored: ${eventType}` });
    }

    if (!token) throw new Error('APIFY_API_TOKEN is missing');

    const runId: string = eventData?.actorRunId;
    const datasetId: string = eventData?.defaultDatasetId;
    if (!runId || !datasetId) {
      return NextResponse.json({ error: 'Missing actorRunId or defaultDatasetId' }, { status: 400 });
    }

    // ─ Find associated task ────────────────────────────────────────────────
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();

    const taskResult = await dbClient.query(
      `SELECT id, platform FROM search_tasks WHERE apify_run_id = $1 LIMIT 1`,
      [runId]
    );

    if (taskResult.rows.length === 0) {
      // No matching task — could be a manual run or an orphan. Just acknowledge.
      console.warn('[Webhook] No task found for runId:', runId);
      return NextResponse.json({ success: true, message: 'No matching task' });
    }

    const taskId: string = taskResult.rows[0].id;
    const platform: string = taskResult.rows[0].platform ?? 'instagram';

    // ─ Fetch results from Apify ────────────────────────────────────────────
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=100`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const items: any[] = await itemsRes.json().then(d => Array.isArray(d) ? d : []).catch(() => []);
    console.log(`[Webhook] Items received: ${items.length} for task ${taskId}`);

    // ─ Process & insert leads ─────────────────────────────────────────────
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
        if (insertErr.code !== '23505') console.error('[Webhook] Insert error:', insertErr.message);
      }
    }

    // ─ Update task ────────────────────────────────────────────────────────
    await dbClient.query(
      `UPDATE search_tasks SET status = 'completed', leads_found = $1, completed_at = NOW() WHERE id = $2`,
      [leadsInserted, taskId]
    );

    console.log(`[Webhook] Done. Leads inserted: ${leadsInserted}`);
    return NextResponse.json({ success: true, leadsInserted });

  } catch (error: any) {
    console.error('[Webhook] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (dbClient) {
      try { await dbClient.end(); } catch { /* ignore */ }
    }
  }
}

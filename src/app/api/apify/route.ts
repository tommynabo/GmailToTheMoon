import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';

export async function POST(req: Request) {
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Apify token not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { path, method = 'GET', body: apifyBody } = body;

    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const client = new ApifyClient({ token });

    // ── POST acts/{actorId}/runs → start run
    const startMatch = path.match(/^acts\/([^/?]+)\/runs(\?(.*))?$/);
    if (startMatch && method === 'POST') {
      const actorId = startMatch[1];
      const qs = new URLSearchParams(startMatch[3] ?? '');
      const timeout = qs.has('timeout') ? parseInt(qs.get('timeout')!) : undefined;
      const memory  = qs.has('memory')  ? parseInt(qs.get('memory')!)  : undefined;

      const runInfo = await client.actor(actorId).start(apifyBody ?? {}, { timeout, memory });
      return NextResponse.json({ data: runInfo }, { status: 201 });
    }

    // ── GET acts/{actorId}/runs/{runId} → poll run status
    const statusMatch = path.match(/^acts\/[^/]+\/runs\/([^/?]+)/);
    if (statusMatch && method === 'GET') {
      const runInfo = await client.run(statusMatch[1]).get();
      return NextResponse.json({ data: runInfo });
    }

    // ── GET datasets/{datasetId}/items → fetch results
    const datasetMatch = path.match(/^datasets\/([^/?]+)\/items(\?(.*))?$/);
    if (datasetMatch && method === 'GET') {
      const qs    = new URLSearchParams(datasetMatch[3] ?? '');
      const limit = qs.has('limit') ? parseInt(qs.get('limit')!) : undefined;
      const result = await client.dataset(datasetMatch[1]).listItems({ limit });
      return NextResponse.json(result.items);
    }

    // ── POST actor-runs/{runId}/abort → abort run
    const abortMatch = path.match(/^actor-runs\/([^/]+)\/abort$/);
    if (abortMatch && method === 'POST') {
      const runInfo = await client.run(abortMatch[1]).abort();
      return NextResponse.json({ data: runInfo });
    }

    return NextResponse.json({ error: 'Unsupported path' }, { status: 404 });

  } catch (error: any) {
    console.error('[API Apify] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

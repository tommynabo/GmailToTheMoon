import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { Client } from 'pg';

export async function POST(req: Request) {
  let dbClient;
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Apify token not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { query, platform } = body;

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Connect to Neon DB
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();

    // 1. Create search task in DB
    const taskResult = await dbClient.query(
      `INSERT INTO search_tasks (query, platform, status) VALUES ($1, $2, 'running') RETURNING id`,
      [query, platform]
    );
    const taskId = taskResult.rows[0].id;

    // 2. Trigger Apify Actor
    const client = new ApifyClient({ token });
    
    // Using a Google Search Scraper or Instagram Scraper as the base for the Dorks method
    // Replace 'apify/google-search-scraper' with your specific Actor ID if needed.
    const actorId = platform === 'instagram' 
      ? 'apify/google-search-scraper' 
      : 'apify/google-search-scraper';
      
    const searchDork = platform === 'instagram'
      ? `site:instagram.com "${query}" ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com")`
      : `site:linkedin.com/in "${query}"`;

    const runInfo = await client.actor(actorId).start({
      queries: searchDork,
      resultsPerPage: 100,
      maxPagesPerQuery: 1,
      // Pass our search task ID so Apify can send it back in a webhook (if we configure webhooks in Apify)
      // Alternatively, the webhook can just be configured globally.
      customData: { taskId }
    });

    // 3. Update task with Apify Run ID
    await dbClient.query(
      `UPDATE search_tasks SET apify_run_id = $1 WHERE id = $2`,
      [runInfo.id, taskId]
    );

    return NextResponse.json({ success: true, taskId, runId: runInfo.id });

  } catch (error: any) {
    console.error('[API Search] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
}

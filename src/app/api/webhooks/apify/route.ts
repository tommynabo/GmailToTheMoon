import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { Client } from 'pg';

export async function POST(req: Request) {
  let dbClient;
  try {
    const token = process.env.APIFY_API_TOKEN;
    const body = await req.json();
    
    // Apify sends information about the run in the webhook payload
    const { eventType, eventData } = body;
    
    if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
      return NextResponse.json({ success: true, message: 'Ignored non-success event' });
    }
    
    const runId = eventData.actorRunId;
    
    // Connect to DB
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();

    // Find the associated search task
    const taskResult = await dbClient.query(
      `SELECT id, platform FROM search_tasks WHERE apify_run_id = $1 LIMIT 1`,
      [runId]
    );
    
    if (taskResult.rows.length === 0) {
      return NextResponse.json({ error: 'Search task not found for runId: ' + runId }, { status: 404 });
    }
    
    const taskId = taskResult.rows[0].id;
    const platform = taskResult.rows[0].platform;

    // Fetch results from Apify
    const client = new ApifyClient({ token });
    const { items } = await client.dataset(eventData.defaultDatasetId).listItems();
    
    let leadsInserted = 0;

    // Process and insert leads (Anti-Duplicate logic via ON CONFLICT DO NOTHING)
    for (const item of items) {
      // Extract emails using a simple regex from snippet or description
      const textToSearch = JSON.stringify(item);
      const emails = textToSearch.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const email = emails.length > 0 ? emails[0].toLowerCase() : null;
      
      // Extract IG handle from URL if platform is instagram
      let igHandle = null;
      if (platform === 'instagram' && item.url) {
        const match = item.url.match(/instagram\.com\/([^/?]+)/);
        if (match) igHandle = match[1];
      }

      if (!email && !igHandle) continue; // Skip if we have neither email nor handle

      try {
        const result = await dbClient.query(`
          INSERT INTO leads (
            email, 
            ig_handle,
            source,
            ai_summary,
            status,
            campaign_id
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (ig_handle) DO NOTHING
          RETURNING id
        `, [
          email || \`pending-\${igHandle}@placeholder.com\`, // Temporary email if null but we have IG
          igHandle,
          platform,
          item.title || item.snippet,
          'new',
          taskId
        ]);

        if (result.rowCount > 0) {
          leadsInserted++;
        }
      } catch (insertError: any) {
        // Fallback constraint violation check just in case (e.g. if email conflicts)
        if (insertError.code !== '23505') { 
          console.error('Error inserting lead:', insertError);
        }
      }
    }

    // Update search task
    await dbClient.query(
      `UPDATE search_tasks 
       SET status = 'completed', leads_found = $1, completed_at = NOW() 
       WHERE id = $2`,
      [leadsInserted, taskId]
    );

    return NextResponse.json({ success: true, leadsInserted });

  } catch (error: any) {
    console.error('[API Apify Webhook] Error:', error.message);
    
    // Update task status to failed if possible
    if (dbClient) {
      try {
        // Assuming we could extract runId from body to find the task, omitted for brevity in error block
      } catch (e) {}
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
}

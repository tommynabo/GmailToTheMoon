import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { Client } from 'pg';

// Lista rotativa de nichos/keywords
const KEYWORDS = [
  "B2B Consultant",
  "Agency Founder",
  "Growth Partner",
  "B2B Coach",
  "SaaS Founder",
  "Marketing Consultant"
];

export async function GET(req: Request) {
  // 1. Verificación de Seguridad de Vercel Cron
  // En producción, Vercel envía el header 'x-vercel-cron'
  const isCron = req.headers.get('x-vercel-cron') === '1';
  
  if (!isCron && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let dbClient;
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Apify token not configured' }, { status: 500 });
    }

    // 2. Elegir una keyword basada en el día actual (rotativa)
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24
    );
    const query = KEYWORDS[dayOfYear % KEYWORDS.length];
    const platform = 'instagram';

    // 3. Crear la tarea en la BD
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();

    const taskResult = await dbClient.query(
      `INSERT INTO search_tasks (query, platform, status) VALUES ($1, $2, 'running') RETURNING id`,
      [query, platform]
    );
    const taskId = taskResult.rows[0].id;

    // 4. Iniciar búsqueda en Apify
    const client = new ApifyClient({ token });
    const actorId = 'apify/google-search-scraper';
    const searchDork = `site:instagram.com "${query}" ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com")`;

    const runInfo = await client.actor(actorId).start({
      queries: searchDork,
      resultsPerPage: 200,
      maxPagesPerQuery: 2, 
      customData: { taskId }
    });

    // 5. Actualizar la tarea con el run_id
    await dbClient.query(
      `UPDATE search_tasks SET apify_run_id = $1 WHERE id = $2`,
      [runInfo.id, taskId]
    );

    return NextResponse.json({ 
      success: true, 
      message: `Daily search launched for '${query}'`,
      taskId, 
      runId: runInfo.id 
    });

  } catch (error: any) {
    console.error('[CRON Daily Search] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
}

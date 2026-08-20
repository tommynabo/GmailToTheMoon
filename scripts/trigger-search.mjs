import { ApifyClient } from 'apify-client';
import pg from 'pg';

const { Client } = pg;

async function triggerSearch() {
  let dbClient;
  try {
    console.log('🚀 Iniciando primera búsqueda del Autopilot...');

    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error('APIFY_API_TOKEN is missing');

    const query = "B2B Consultant";
    const platform = "instagram";

    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();
    console.log('✅ Conectado a la base de datos Neon');

    const taskResult = await dbClient.query(
      `INSERT INTO search_tasks (query, platform, status) VALUES ($1, $2, 'running') RETURNING id`,
      [query, platform]
    );
    const taskId = taskResult.rows[0].id;
    console.log(`✅ Tarea de búsqueda creada en DB con ID: ${taskId}`);

    const client = new ApifyClient({ token });
    const actorId = 'apify/google-search-scraper';
    const searchDork = `site:instagram.com "${query}" ("@gmail.com" OR "@yahoo.com" OR "@hotmail.com")`;

    console.log(`🤖 Disparando actor de Apify (${actorId}) con dork: ${searchDork}`);
    const runInfo = await client.actor(actorId).start({
      queries: searchDork,
      resultsPerPage: 200,
      maxPagesPerQuery: 2,
      customData: { taskId }
    });

    console.log(`✅ Actor de Apify disparado exitosamente. Run ID: ${runInfo.id}`);

    await dbClient.query(
      `UPDATE search_tasks SET apify_run_id = $1 WHERE id = $2`,
      [runInfo.id, taskId]
    );
    console.log(`✅ Tarea de búsqueda actualizada con Run ID. Todo listo.`);

  } catch (error) {
    console.error('❌ Error ejecutando la búsqueda inicial:', error);
  } finally {
    if (dbClient) {
      await dbClient.end();
      console.log('🔌 Conexión a DB cerrada.');
    }
  }
}

triggerSearch();

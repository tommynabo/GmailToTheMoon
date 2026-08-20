import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const connectionString = 'postgresql://neondb_owner:npg_pRlFtbUr60Bn@ep-purple-bonus-awscjbbg-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to Neon Database successfully.');

    const sqlPath = path.join(process.cwd(), 'supabase', 'schema.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Remove Supabase specific RLS policies if any fail, but they should be fine as standard PostgreSQL
    console.log('Executing schema.sql...');
    await client.query(sql);
    console.log('Schema executed successfully.');

  } catch (err) {
    console.error('Error executing schema:', err);
  } finally {
    await client.end();
  }
}

main();

import Sidebar from '@/components/Sidebar';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

async function getInteractions() {
  let dbClient;
  try {
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();
    
    const result = await dbClient.query(`
      SELECT ai.*, l.email, l.first_name 
      FROM ai_interactions ai
      JOIN leads l ON ai.lead_id = l.id
      ORDER BY ai.created_at DESC LIMIT 50
    `);
    return result.rows;
  } catch (error) {
    console.error('Error fetching interactions:', error);
    return [];
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
}

export default async function AISetterPage() {
  const interactions = await getInteractions();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-1">AI Setter Intelligence</h2>
          <p className="text-gray-400">Monitor conversations and intent classifications.</p>
        </header>

        <div className="glass-card mb-8 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
          <h3 className="text-lg font-semibold mb-4 text-blue-400">System Prompt Configuration</h3>
          <p className="text-sm text-gray-300 mb-4">
            El AI Setter está operando bajo la identidad de <strong className="text-white">Arquitecto de Sistemas B2B</strong>.
            Está optimizado para vender la implementación asimétrica a agencias y consultores B2B.
          </p>
          <button className="btn-secondary text-sm">Edit Core Prompt</button>
        </div>

        <div className="glass-card">
          <h3 className="text-xl font-semibold mb-6">Recent Interactions</h3>
          <div className="space-y-4">
            {interactions.length > 0 ? (
              interactions.map((interaction: any) => (
                <div key={interaction.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-blue-400 text-sm">{interaction.email}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                      interaction.intent_type === 'INTERESTED' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      interaction.intent_type === 'OBJECTION' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                      interaction.intent_type === 'NOT_INTERESTED' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-gray-500/20 text-gray-300 border-gray-500/30'
                    }`}>
                      {interaction.intent_type}
                    </span>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Prospect Replied:</p>
                    <p className="text-sm text-gray-200 italic border-l-2 border-gray-600 pl-3">"{interaction.user_reply}"</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-500/70 mb-1">AI Responded:</p>
                    <p className="text-sm text-white border-l-2 border-blue-500 pl-3">{interaction.ai_response || '(No response generated)'}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No AI interactions recorded yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

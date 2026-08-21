import Sidebar from '@/components/Sidebar';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

async function getLeads() {
  let dbClient;
  try {
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();
    
    // Fetch last 50 leads
    const result = await dbClient.query("SELECT * FROM leads ORDER BY created_at DESC LIMIT 50");
    return result.rows;
  } catch (error) {
    console.error('Error fetching leads:', error);
    return [];
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
}

export default async function PipelinePage() {
  const leads = await getLeads();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-1">Pipeline</h2>
          <p className="text-gray-400">Manage your active prospects and their current status.</p>
        </header>

        <div className="glass-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-black/20">
                <tr>
                  <th className="px-6 py-3 rounded-tl-lg">Prospect</th>
                  <th className="px-6 py-3">Platform Handle</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Instantly Status</th>
                  <th className="px-6 py-3 rounded-tr-lg">Added On</th>
                </tr>
              </thead>
              <tbody>
                {leads.length > 0 ? (
                  leads.map((lead: any) => (
                    <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">
                          {(lead.first_name || lead.last_name) 
                            ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() 
                            : 'Prospect from Instagram'}
                        </div>
                        <div className="text-xs text-gray-400">{lead.email || 'No email yet'}</div>
                      </td>
                      <td className="px-6 py-4 text-blue-400 font-mono text-xs">
                        {lead.ig_handle ? (
                          <a href={`https://instagram.com/${lead.ig_handle}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                            @{lead.ig_handle}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        ) : (
                          lead.source
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${
                          lead.status === 'new' ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' :
                          lead.status === 'interested' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        }`}>
                          {lead.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">{lead.instantly_status}</td>
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No leads found in the pipeline.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

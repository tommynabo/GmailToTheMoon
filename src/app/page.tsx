import { Search } from 'lucide-react';
import { Client } from 'pg';
import Sidebar from '@/components/Sidebar';

// Forzar renderizado dinámico para que las métricas estén siempre actualizadas
export const dynamic = 'force-dynamic';

async function getMetrics() {
  let dbClient;
  try {
    dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();

    const leadsCountRes = await dbClient.query("SELECT COUNT(*) FROM leads");
    const emailsVerifiedRes = await dbClient.query("SELECT COUNT(*) FROM leads WHERE status != 'new' AND email IS NOT NULL");
    const pushedRes = await dbClient.query("SELECT COUNT(*) FROM leads WHERE instantly_status = 'pushed'");
    const activeSearchesRes = await dbClient.query("SELECT * FROM search_tasks WHERE status = 'running' ORDER BY created_at DESC");

    return {
      totalLeads: parseInt(leadsCountRes.rows[0].count) || 0,
      verifiedEmails: parseInt(emailsVerifiedRes.rows[0].count) || 0,
      pushedToInstantly: parseInt(pushedRes.rows[0].count) || 0,
      activeSearches: activeSearchesRes.rows
    };
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return { totalLeads: 0, verifiedEmails: 0, pushedToInstantly: 0, activeSearches: [] };
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
}

export default async function Home() {
  const metrics = await getMetrics();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-1">Search Autopilot</h2>
            <p className="text-gray-400">Extract high-ticket B2B founders and consultants.</p>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <Search size={18} />
            Start New Search
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Total Leads Found" value={metrics.totalLeads.toLocaleString()} change="En DB" />
          <StatCard title="Verified & Valid" value={metrics.verifiedEmails.toLocaleString()} change="En DB" />
          <StatCard title="Pushed to Instantly" value={metrics.pushedToInstantly.toLocaleString()} change="En DB" />
        </div>

        <div className="glass-card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Active Search Campaigns</h3>
            <span className="text-xs font-medium px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
              Running
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-black/20">
                <tr>
                  <th className="px-6 py-3 rounded-tl-lg">Query / Keyword</th>
                  <th className="px-6 py-3">Platform</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 rounded-tr-lg">Leads Found</th>
                </tr>
              </thead>
              <tbody>
                {metrics.activeSearches.length > 0 ? (
                  metrics.activeSearches.map((search: any) => (
                    <tr key={search.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{search.query}</td>
                      <td className="px-6 py-4">{search.platform}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          Scraping...
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-blue-400">{search.leads_found}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No active searches at the moment.
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



function StatCard({ title, value, change }: { title: string, value: string, change: string }) {
  return (
    <div className="glass-card flex flex-col">
      <span className="text-gray-400 text-sm font-medium mb-2">{title}</span>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-white">{value}</span>
        <span className="text-xs font-semibold mb-1 text-blue-400">
          {change}
        </span>
      </div>
    </div>
  );
}

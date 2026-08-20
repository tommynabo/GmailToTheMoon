import Sidebar from '@/components/Sidebar';

export default function CampaignsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-1">Campaigns (Instantly)</h2>
          <p className="text-gray-400">View and manage your active email sequences.</p>
        </header>

        <div className="glass-card flex flex-col items-center justify-center p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Instantly.ai Connection</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            The Instantly API integration is configured for sending leads. In the next phase, we will fetch campaign metrics directly into this dashboard.
          </p>
          <button className="btn-secondary">Sync Campaigns</button>
        </div>
      </main>
    </div>
  );
}

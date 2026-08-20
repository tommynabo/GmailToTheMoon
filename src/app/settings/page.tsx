import Sidebar from '@/components/Sidebar';

export default function SettingsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-1">System Settings</h2>
          <p className="text-gray-400">Manage API keys, integrations, and global variables.</p>
        </header>

        <div className="max-w-3xl space-y-6">
          <div className="glass-card">
            <h3 className="text-lg font-semibold mb-4 text-white">Environment Status</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-sm font-medium text-gray-300">Database (Neon)</span>
                <span className="text-xs font-bold px-2 py-1 bg-green-500/20 text-green-400 rounded-full">Connected</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-sm font-medium text-gray-300">OpenAI API (AI Setter)</span>
                <span className="text-xs font-bold px-2 py-1 bg-green-500/20 text-green-400 rounded-full">Connected</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-sm font-medium text-gray-300">Apify API (Autopilot)</span>
                <span className="text-xs font-bold px-2 py-1 bg-green-500/20 text-green-400 rounded-full">Connected</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                <span className="text-sm font-medium text-gray-300">Instantly API</span>
                <span className="text-xs font-bold px-2 py-1 bg-green-500/20 text-green-400 rounded-full">Connected</span>
              </div>
            </div>
          </div>
          
          <div className="glass-card border border-red-500/20">
            <h3 className="text-lg font-semibold mb-2 text-red-400">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-4">Actions here can result in data loss.</p>
            <button className="bg-red-500/10 text-red-500 border border-red-500/30 font-medium py-2 px-4 rounded-lg hover:bg-red-500/20 transition-colors">
              Reset Pipeline Database
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

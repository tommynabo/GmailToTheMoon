import { Bot, LineChart, Settings, Users, Zap, Mail, Search } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-white/10 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Zap className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">GmailToTheMoon</h1>
            <p className="text-xs text-blue-400 font-medium">B2B System Architect</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem icon={<Search size={18} />} label="Autopilot" active />
          <NavItem icon={<Users size={18} />} label="Pipeline" />
          <NavItem icon={<Bot size={18} />} label="AI Setter" />
          <NavItem icon={<Mail size={18} />} label="Campaigns" />
          <NavItem icon={<LineChart size={18} />} label="Analytics" />
        </nav>

        <div className="p-4">
          <NavItem icon={<Settings size={18} />} label="Settings" />
        </div>
      </aside>

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
          <StatCard title="Total Leads Found" value="12,450" change="+12%" />
          <StatCard title="Emails Verified" value="8,920" change="+8%" />
          <StatCard title="Pushed to Instantly" value="8,105" change="+15%" />
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
                  <th className="px-6 py-3">Target</th>
                  <th className="px-6 py-3">Platform</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 rounded-tr-lg">Leads Found</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">B2B Consultant OR Growth Partner</td>
                  <td className="px-6 py-4">Founders (1-15 emp)</td>
                  <td className="px-6 py-4">LinkedIn</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      Scraping...
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-blue-400">4,210</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">Marketing Agency Owner</td>
                  <td className="px-6 py-4">Agencies (+10k/mo)</td>
                  <td className="px-6 py-4">Instagram</td>
                  <td className="px-6 py-4 text-gray-400">Completed</td>
                  <td className="px-6 py-4 font-mono text-blue-400">8,240</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <a
      href="#"
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </a>
  );
}

function StatCard({ title, value, change }: { title: string, value: string, change: string }) {
  const isPositive = change.startsWith('+');
  return (
    <div className="glass-card flex flex-col">
      <span className="text-gray-400 text-sm font-medium mb-2">{title}</span>
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold text-white">{value}</span>
        <span className={`text-xs font-semibold mb-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {change}
        </span>
      </div>
    </div>
  );
}

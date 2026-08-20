"use client";

import { Bot, LineChart, Settings, Users, Zap, Mail, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 glass border-r border-white/10 flex flex-col shrink-0">
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
        <NavItem href="/" icon={<Search size={18} />} label="Autopilot" active={pathname === '/'} />
        <NavItem href="/pipeline" icon={<Users size={18} />} label="Pipeline" active={pathname === '/pipeline'} />
        <NavItem href="/ai-setter" icon={<Bot size={18} />} label="AI Setter" active={pathname === '/ai-setter'} />
        <NavItem href="/campaigns" icon={<Mail size={18} />} label="Campaigns" active={pathname === '/campaigns'} />
        <NavItem href="/analytics" icon={<LineChart size={18} />} label="Analytics" active={pathname === '/analytics'} />
      </nav>

      <div className="p-4">
        <NavItem href="/settings" icon={<Settings size={18} />} label="Settings" active={pathname === '/settings'} />
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, active = false }: { href: string, icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}

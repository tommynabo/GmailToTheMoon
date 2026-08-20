"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError('Contraseña incorrecta. Acceso denegado.');
      }
    } catch (err) {
      setError('Error conectando al servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115] bg-[radial-gradient(at_0%_0%,rgba(59,130,246,0.15)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(139,92,246,0.15)_0px,transparent_50%)]">
      <div className="glass-card w-full max-w-md p-8 shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.6)] mb-4">
            <Zap className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">GmailToTheMoon</h1>
          <p className="text-sm text-gray-400 mt-1">Ingresa tu clave maestra</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="password"
              placeholder="Contraseña..."
              className="input-glass w-full text-center text-lg py-3 tracking-widest"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          
          {error && <p className="text-red-400 text-sm text-center font-medium animate-pulse">{error}</p>}
          
          <button
            type="submit"
            disabled={loading || !password}
            className="btn-primary w-full py-3 text-lg font-semibold flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Acceder al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}

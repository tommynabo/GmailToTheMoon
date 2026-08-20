import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Rutas públicas que no necesitan login
  const isPublicPath = path === '/login' || path.startsWith('/api/setter') || path.startsWith('/api/apify') || path.startsWith('/api/instantly-add-lead');

  const token = request.cookies.get('auth_token')?.value || '';
  const isAuthenticated = token === process.env.ADMIN_PASSWORD;

  // Redirigir al login si no está autenticado y la ruta no es pública
  if (!isPublicPath && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  // Redirigir al dashboard si ya está autenticado e intenta ir a /login
  if (isPublicPath && path === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/pipeline',
    '/ai-setter',
    '/campaigns',
    '/analytics',
    '/settings',
    '/login'
  ],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas o de sistema/recursos estáticos
  const isPublicRoute =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/SGPI-CFIS') ||
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname.startsWith('/api');

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Obtener los tokens de las cookies
  const accessToken = request.cookies.get('sgpi_access_token')?.value;
  const refreshToken = request.cookies.get('sgpi_refresh_token')?.value;

  // Redirigir si no hay tokens
  if (!accessToken && !refreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('reason', 'sin_sesion');
    return NextResponse.redirect(url);
  }

  // Si hay accessToken, verificar si está expirado localmente
  if (accessToken) {
    try {
      const payload = decodeJwtPayload(accessToken);
      if (payload && payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          // Si hay refreshToken, dejamos pasar para que el cliente refresque la sesión silenciosamente
          if (refreshToken) {
            return NextResponse.next();
          }
          
          const url = request.nextUrl.clone();
          url.pathname = '/auth/login';
          url.searchParams.set('reason', 'sesion_expirada');
          return NextResponse.redirect(url);
        }
      }
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('reason', 'token_invalido');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

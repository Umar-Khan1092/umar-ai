import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // We only intercept the login page for device entry
  if (url.pathname === '/login' || url.pathname === '/') {
    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isCapacitor = /Capacitor/i.test(userAgent);
    
    // Check if the PWA has verified it is running in standalone mode
    const isVerifiedPWA = request.cookies.get('is_standalone_pwa')?.value === 'true';

    // If it's a mobile device, but NOT the Capacitor App and NOT the installed PWA
    if (isMobile && !isCapacitor && !isVerifiedPWA) {
      const redirectUrl = new URL('/device-entry', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login'],
};

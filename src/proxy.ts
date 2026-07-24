import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // We only intercept the login page for device entry
  if (url.pathname === '/login' || url.pathname === '/') {
    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    // Check if user explicitly chose to continue in browser
    const bypassCookie = request.cookies.get('bypass_device_entry')?.value;

    if (isMobile && bypassCookie !== 'true') {
      const redirectUrl = new URL('/device-entry', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login'],
};
